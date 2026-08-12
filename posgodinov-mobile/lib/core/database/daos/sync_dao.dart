import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/tables/sync_logs_table.dart';
import 'package:posgodinov_mobile/core/database/tables/sync_meta_table.dart';

part 'sync_dao.g.dart';

@DriftAccessor(tables: <Type>[SyncMeta, SyncLogs])
class SyncDao extends DatabaseAccessor<AppDatabase> with _$SyncDaoMixin {
  SyncDao(super.db);

  // ── Kunci–nilai ────────────────────────────────────────────────────────────

  Future<String?> readMeta(String key) async {
    final SyncMetaEntry? row = await (select(db.syncMeta)
          ..where(($SyncMetaTable m) => m.key.equals(key)))
        .getSingleOrNull();
    return row?.value;
  }

  Future<void> writeMeta(String key, String value, DateTime now) {
    return into(db.syncMeta).insertOnConflictUpdate(
      SyncMetaCompanion(
        key: Value<String>(key),
        value: Value<String>(value),
        updatedAt: Value<DateTime>(now),
      ),
    );
  }

  // ── Backoff ────────────────────────────────────────────────────────────────

  /// Kapan mesin sync boleh mencoba lagi. Epoch bila belum pernah gagal.
  Future<DateTime> backoffUntil() async {
    final String? raw = await readMeta(SyncMetaKeys.backoffUntil);
    final int? ms = raw == null ? null : int.tryParse(raw);
    if (ms == null) return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
    return DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
  }

  Future<int> consecutiveFailures() async {
    final String? raw = await readMeta(SyncMetaKeys.consecutiveFailures);
    return raw == null ? 0 : int.tryParse(raw) ?? 0;
  }

  /// Menaikkan hitungan kegagalan dan menetapkan jendela backoff berikutnya.
  ///
  /// **Tanpa batas percobaan.** Interval berhenti bertambah di 5 menit dan mesin
  /// terus mencoba selamanya — ini data keuangan, menyerah bukan pilihan
  /// ([09 §6.4]).
  Future<void> recordFailure(DateTime now, Duration nextDelay) {
    return db.transaction(() async {
      final int failures = await consecutiveFailures() + 1;
      await writeMeta(
        SyncMetaKeys.consecutiveFailures,
        failures.toString(),
        now,
      );
      await writeMeta(
        SyncMetaKeys.backoffUntil,
        now.add(nextDelay).millisecondsSinceEpoch.toString(),
        now,
      );
    });
  }

  Future<void> clearBackoff(DateTime now) {
    return db.transaction(() async {
      await writeMeta(SyncMetaKeys.consecutiveFailures, '0', now);
      await writeMeta(SyncMetaKeys.backoffUntil, '0', now);
    });
  }

  // ── Umur master data ───────────────────────────────────────────────────────

  Future<DateTime?> masterDataSyncedAt() async {
    final String? raw = await readMeta(SyncMetaKeys.masterDataSyncedAt);
    final int? ms = raw == null ? null : int.tryParse(raw);
    return ms == null
        ? null
        : DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
  }

  /// Master data ditarik ulang bila lebih tua dari
  /// [SyncLimits.masterDataMaxAge] ([04 §A.2]).
  Future<bool> isMasterDataStale(DateTime now) async {
    final DateTime? syncedAt = await masterDataSyncedAt();
    if (syncedAt == null) return true;
    return now.difference(syncedAt) > SyncLimits.masterDataMaxAge;
  }

  // ── Jejak diagnosis ────────────────────────────────────────────────────────

  Future<void> writeLog(SyncLogsCompanion log) => into(db.syncLogs).insert(log);

  Stream<List<SyncLog>> watchRecentLogs({int limit = 30}) {
    return (select(db.syncLogs)
          ..orderBy(<OrderClauseGenerator<$SyncLogsTable>>[
            ($SyncLogsTable l) => OrderingTerm.desc(l.startedAt),
          ])
          ..limit(limit))
        .watch();
  }

  /// Memangkas jejak lama — diagnostik, bukan data keuangan.
  Future<int> pruneLogs({int keep = 200}) async {
    final List<SyncLog> rows = await (select(db.syncLogs)
          ..orderBy(<OrderClauseGenerator<$SyncLogsTable>>[
            ($SyncLogsTable l) => OrderingTerm.desc(l.startedAt),
          ])
          ..limit(1, offset: keep))
        .get();

    if (rows.isEmpty) return 0;

    final DateTime cutoff = rows.first.startedAt;
    return (delete(db.syncLogs)
          ..where(($SyncLogsTable l) => l.startedAt.isSmallerOrEqualValue(cutoff)))
        .go();
  }
}
