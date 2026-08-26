import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/tables/void_logs_table.dart';

part 'void_log_dao.g.dart';

/// Akses `void_logs` — butir 5, 6, 13, 15 ([11 §M13]).
@DriftAccessor(tables: <Type>[VoidLogs])
class VoidLogDao extends DatabaseAccessor<AppDatabase>
    with _$VoidLogDaoMixin {
  VoidLogDao(super.db);

  Future<void> insertLog(VoidLogsCompanion log) =>
      into(db.voidLogs).insert(log);

  /// Antrean sinkronisasi, urut kronologis.
  ///
  /// Memakai indeks `idx_void_queue (synced, client_created_at)`.
  Future<List<LocalVoidLog>> pending({
    int limit = SyncLimits.maxTransactionsPerBatch,
  }) {
    return (select(db.voidLogs)
          ..where(($VoidLogsTable v) =>
              v.synced.equals(false) & v.quarantined.equals(false),)
          ..orderBy(<OrderClauseGenerator<$VoidLogsTable>>[
            ($VoidLogsTable v) => OrderingTerm.asc(v.clientCreatedAt),
          ])
          ..limit(limit))
        .get();
  }

  /// Seluruh pembatalan pada satu shift, terbaru dulu.
  Stream<List<LocalVoidLog>> watchByShift(String shiftId) {
    return (select(db.voidLogs)
          ..where(($VoidLogsTable v) => v.shiftId.equals(shiftId))
          ..orderBy(<OrderClauseGenerator<$VoidLogsTable>>[
            ($VoidLogsTable v) => OrderingTerm.desc(v.clientCreatedAt),
          ]))
        .watch();
  }

  /// Nilai rupiah (**sen**) yang dibatalkan pada satu shift.
  ///
  /// Angka inilah yang dibaca laporan kecurangan pemilik: kasir dengan rasio
  /// void tinggi terhadap penjualan adalah sinyal pertama yang dicari auditor.
  Future<int> voidedValueOfShift(String shiftId) async {
    final Expression<int> total = db.voidLogs.valueAmountMinor.sum();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.voidLogs)
          ..addColumns(<Expression<Object>>[total])
          ..where(db.voidLogs.shiftId.equals(shiftId));

    final TypedResult row = await query.getSingle();
    return row.read(total) ?? 0;
  }

  /// Berapa kali kasir menurunkan kuantitas melewati ambang pada shift ini.
  ///
  /// Dipakai M13.4 untuk menampilkan konteks saat meminta otoritas supervisor.
  Future<int> cartLineVoidCountOfShift(String shiftId) async {
    final Expression<int> count = db.voidLogs.id.count();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.voidLogs)
          ..addColumns(<Expression<Object>>[count])
          ..where(
            db.voidLogs.shiftId.equals(shiftId) &
                db.voidLogs.scope.equalsValue(VoidScope.cartLine),
          );

    final TypedResult row = await query.getSingle();
    return row.read(count) ?? 0;
  }

  Future<void> markSynced(String id) {
    return (update(db.voidLogs)..where(($VoidLogsTable v) => v.id.equals(id)))
        .write(
      const VoidLogsCompanion(
        synced: Value<bool>(true),
        syncError: Value<String?>(null),
        syncAttempts: Value<int>(0),
      ),
    );
  }

  Future<void> markFailed(String id, DateTime attemptedAt, String reason) {
    return db.transaction(() async {
      final LocalVoidLog? row = await (select(db.voidLogs)
            ..where(($VoidLogsTable v) => v.id.equals(id)))
          .getSingleOrNull();
      if (row == null) return;

      await (update(db.voidLogs)..where(($VoidLogsTable v) => v.id.equals(id)))
          .write(
        VoidLogsCompanion(
          synced: const Value<bool>(false),
          syncError: Value<String?>(reason),
          syncAttempts: Value<int>(row.syncAttempts + 1),
          lastSyncAttemptAt: Value<DateTime?>(attemptedAt),
        ),
      );
    });
  }

  /// Menandai bahwa struk pembatalan benar-benar tercetak (butir 6).
  Future<void> markReceiptPrinted(String id, DateTime printedAt) {
    return (update(db.voidLogs)..where(($VoidLogsTable v) => v.id.equals(id)))
        .write(
      VoidLogsCompanion(
        receiptPrinted: const Value<bool>(true),
        receiptPrintedAt: Value<DateTime?>(printedAt),
      ),
    );
  }

  /// Memindahkan baris ke KARANTINA ([11 §4.3]).
  ///
  /// Dipanggil ketika server menolak dengan `retryable: false`. Barisnya
  /// **tidak dihapus** — datanya tetap utuh dan muncul di P-13 sebagai "Butuh
  /// tindakan". Yang berubah hanya keanggotaannya di antrean, supaya satu baris
  /// cacat permanen berhenti menahan seluruh baris di belakangnya.
  Future<void> markQuarantined(String id, DateTime at, String reason) {
    return (update(db.voidLogs)..where(($VoidLogsTable t) => t.id.equals(id)))
        .write(
      VoidLogsCompanion(
        quarantined: const Value<bool>(true),
        synced: const Value<bool>(false),
        syncError: Value<String?>(reason),
        lastSyncAttemptAt: Value<DateTime?>(at),
      ),
    );
  }

  /// Jumlah baris yang menuntut tindakan manusia.
  Stream<int> watchQuarantinedCount() {
    final Expression<int> count = db.voidLogs.id.count();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.voidLogs)
          ..addColumns(<Expression<Object>>[count])
          ..where(db.voidLogs.quarantined.equals(true));

    return query.map((TypedResult row) => row.read(count) ?? 0).watchSingle();
  }

}
