import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/tables/security_events_table.dart';

part 'security_event_dao.g.dart';

/// Akses `security_events` — kanal audit yang ikut antre sync ([11 §1] R9).
@DriftAccessor(tables: <Type>[SecurityEvents])
class SecurityEventDao extends DatabaseAccessor<AppDatabase>
    with _$SecurityEventDaoMixin {
  SecurityEventDao(super.db);

  Future<void> record(SecurityEventsCompanion event) =>
      into(db.securityEvents).insert(event);

  /// Antrean sinkronisasi, urut kronologis.
  ///
  /// Batasnya lebih besar dari batas transaksi: peristiwa keamanan berukuran
  /// kecil, dan menahannya di perangkat justru menunda satu-satunya sinyal yang
  /// dimiliki pemilik tentang apa yang terjadi saat perangkat offline.
  Future<List<LocalSecurityEvent>> pending({int limit = 500}) {
    return (select(db.securityEvents)
          ..where(($SecurityEventsTable e) =>
              e.synced.equals(false) & e.quarantined.equals(false))
          ..orderBy(<OrderClauseGenerator<$SecurityEventsTable>>[
            ($SecurityEventsTable e) => OrderingTerm.asc(e.clientCreatedAt),
          ])
          ..limit(limit))
        .get();
  }

  /// Peristiwa `CRITICAL` yang belum tersinkron.
  ///
  /// Dipakai StatusBar untuk menyatakan bahwa perangkat menyimpan temuan yang
  /// belum sampai ke pemilik.
  Stream<int> watchPendingCriticalCount() {
    final Expression<int> count = db.securityEvents.id.count();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.securityEvents)
          ..addColumns(<Expression<Object>>[count])
          ..where(
            db.securityEvents.synced.equals(false) &
                db.securityEvents.severity
                    .equalsValue(SecuritySeverity.critical),
          );

    return query.map((TypedResult row) => row.read(count) ?? 0).watchSingle();
  }

  Future<void> markSynced(String id) {
    return (update(db.securityEvents)
          ..where(($SecurityEventsTable e) => e.id.equals(id)))
        .write(
      const SecurityEventsCompanion(
        synced: Value<bool>(true),
        syncError: Value<String?>(null),
        syncAttempts: Value<int>(0),
      ),
    );
  }

  Future<void> markFailed(String id, DateTime attemptedAt, String reason) {
    return db.transaction(() async {
      final LocalSecurityEvent? row = await (select(db.securityEvents)
            ..where(($SecurityEventsTable e) => e.id.equals(id)))
          .getSingleOrNull();
      if (row == null) return;

      await (update(db.securityEvents)
            ..where(($SecurityEventsTable e) => e.id.equals(id)))
          .write(
        SecurityEventsCompanion(
          synced: const Value<bool>(false),
          syncError: Value<String?>(reason),
          syncAttempts: Value<int>(row.syncAttempts + 1),
          lastSyncAttemptAt: Value<DateTime?>(attemptedAt),
        ),
      );
    });
  }

  /// Memindahkan baris ke KARANTINA ([11 §4.3]).
  ///
  /// Dipanggil ketika server menolak dengan `retryable: false`. Barisnya
  /// **tidak dihapus** — datanya tetap utuh dan muncul di P-13 sebagai "Butuh
  /// tindakan". Yang berubah hanya keanggotaannya di antrean, supaya satu baris
  /// cacat permanen berhenti menahan seluruh baris di belakangnya.
  Future<void> markQuarantined(String id, DateTime at, String reason) {
    return (update(db.securityEvents)..where(($SecurityEventsTable t) => t.id.equals(id)))
        .write(
      SecurityEventsCompanion(
        quarantined: const Value<bool>(true),
        synced: const Value<bool>(false),
        syncError: Value<String?>(reason),
        lastSyncAttemptAt: Value<DateTime?>(at),
      ),
    );
  }

  /// Jumlah baris yang menuntut tindakan manusia.
  Stream<int> watchQuarantinedCount() {
    final Expression<int> count = db.securityEvents.id.count();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.securityEvents)
          ..addColumns(<Expression<Object>>[count])
          ..where(db.securityEvents.quarantined.equals(true));

    return query.map((TypedResult row) => row.read(count) ?? 0).watchSingle();
  }

}
