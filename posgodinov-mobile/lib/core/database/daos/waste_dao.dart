import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/tables/wastes_table.dart';

part 'waste_dao.g.dart';

@DriftAccessor(tables: <Type>[Wastes])
class WasteDao extends DatabaseAccessor<AppDatabase> with _$WasteDaoMixin {
  WasteDao(super.db);

  Future<void> insertWaste(WastesCompanion waste) =>
      into(db.wastes).insert(waste);

  /// Antrean waste yang belum tersinkron, urut kronologis.
  Future<List<LocalWaste>> pending() {
    return (select(db.wastes)
          ..where(($WastesTable w) =>
              w.synced.equals(false) & w.quarantined.equals(false))
          ..orderBy(<OrderClauseGenerator<$WastesTable>>[
            ($WastesTable w) => OrderingTerm.asc(w.clientCreatedAt),
          ]))
        .get();
  }

  Stream<List<LocalWaste>> watchRecent({int limit = 50}) {
    return (select(db.wastes)
          ..orderBy(<OrderClauseGenerator<$WastesTable>>[
            ($WastesTable w) => OrderingTerm.desc(w.clientCreatedAt),
          ])
          ..limit(limit))
        .watch();
  }

  Future<void> markSynced(String id) {
    return (update(db.wastes)..where(($WastesTable w) => w.id.equals(id))).write(
      const WastesCompanion(
        synced: Value<bool>(true),
        syncError: Value<String?>(null),
        syncAttempts: Value<int>(0),
      ),
    );
  }

  Future<void> markFailed(String id, DateTime attemptedAt, String reason) {
    return db.transaction(() async {
      final LocalWaste? row = await (select(db.wastes)
            ..where(($WastesTable w) => w.id.equals(id)))
          .getSingleOrNull();
      if (row == null) return;

      await (update(db.wastes)..where(($WastesTable w) => w.id.equals(id)))
          .write(
        WastesCompanion(
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
    return (update(db.wastes)..where(($WastesTable t) => t.id.equals(id)))
        .write(
      WastesCompanion(
        quarantined: const Value<bool>(true),
        synced: const Value<bool>(false),
        syncError: Value<String?>(reason),
        lastSyncAttemptAt: Value<DateTime?>(at),
      ),
    );
  }

  /// Jumlah baris yang menuntut tindakan manusia.
  Stream<int> watchQuarantinedCount() {
    final Expression<int> count = db.wastes.id.count();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.wastes)
          ..addColumns(<Expression<Object>>[count])
          ..where(db.wastes.quarantined.equals(true));

    return query.map((TypedResult row) => row.read(count) ?? 0).watchSingle();
  }

}
