import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/tables/shifts_table.dart';

part 'shift_dao.g.dart';

@DriftAccessor(tables: <Type>[Shifts])
class ShiftDao extends DatabaseAccessor<AppDatabase> with _$ShiftDaoMixin {
  ShiftDao(super.db);

  Future<void> insertShift(ShiftsCompanion shift) =>
      into(db.shifts).insert(shift);

  /// Shift yang sedang berjalan, bila ada. Dipakai gerbang navigasi P-04.
  Future<LocalShift?> openShift() {
    return (select(db.shifts)
          ..where(($ShiftsTable s) => s.status.equalsValue(ShiftStatus.open))
          ..orderBy(<OrderClauseGenerator<$ShiftsTable>>[
            ($ShiftsTable s) => OrderingTerm.desc(s.clientOpenedAt),
          ])
          ..limit(1))
        .getSingleOrNull();
  }

  Stream<LocalShift?> watchOpenShift() {
    return (select(db.shifts)
          ..where(($ShiftsTable s) => s.status.equalsValue(ShiftStatus.open))
          ..limit(1))
        .watchSingleOrNull();
  }

  /// Shift belum tersinkron — termasuk yang masih `OPEN`.
  ///
  /// Shift yang baru dibuka pun ikut dikirim agar transaksi anaknya punya induk
  /// di server sebelum sampai ([03 §2.3]).
  Future<List<LocalShift>> pending() {
    return (select(db.shifts)
          ..where(($ShiftsTable s) => s.synced.equals(false))
          ..orderBy(<OrderClauseGenerator<$ShiftsTable>>[
            ($ShiftsTable s) => OrderingTerm.asc(s.clientOpenedAt),
          ]))
        .get();
  }

  /// Shift induk dari sekumpulan transaksi dalam satu batch.
  ///
  /// **ATURAN KRITIS** ([09 §6.1]): shift induk selalu ikut dikirim walau sudah
  /// ditandai tersinkron. Kegagalan shift tidak dilaporkan per-ID, sehingga
  /// sebuah shift bisa saja tidak pernah benar-benar tersimpan meski kita
  /// menandainya. Mengirim ulang aman — upsert backend hanya menyentuh kolom
  /// penutupan ([02 §2.11]).
  Future<List<LocalShift>> byIds(Iterable<String> ids) {
    if (ids.isEmpty) return Future<List<LocalShift>>.value(const <LocalShift>[]);
    return (select(db.shifts)
          ..where(($ShiftsTable s) => s.id.isIn(ids.toList(growable: false))))
        .get();
  }

  /// Menutup shift dengan angka hasil hitung kasir. Seluruh nominal **sen**.
  Future<void> closeShift({
    required String id,
    required int closingBalanceMinor,
    required int expectedBalanceMinor,
    required int discrepancyMinor,
    required DateTime clientClosedAt,
  }) {
    return (update(db.shifts)..where(($ShiftsTable s) => s.id.equals(id))).write(
      ShiftsCompanion(
        status: const Value<ShiftStatus>(ShiftStatus.closed),
        closingBalanceMinor: Value<int>(closingBalanceMinor),
        expectedBalanceMinor: Value<int>(expectedBalanceMinor),
        discrepancyMinor: Value<int>(discrepancyMinor),
        clientClosedAt: Value<DateTime?>(clientClosedAt),
        // Shift yang ditutup WAJIB kembali ke antrean: penutupan adalah
        // sinkronisasi kedua yang membawa angka kas sesungguhnya.
        synced: const Value<bool>(false),
      ),
    );
  }

  Future<void> markSynced(String id) {
    return (update(db.shifts)..where(($ShiftsTable s) => s.id.equals(id))).write(
      const ShiftsCompanion(
        synced: Value<bool>(true),
        syncError: Value<String?>(null),
        syncAttempts: Value<int>(0),
      ),
    );
  }

  Future<void> markFailed(String id, DateTime attemptedAt, String reason) {
    return db.transaction(() async {
      final LocalShift? row = await (select(db.shifts)
            ..where(($ShiftsTable s) => s.id.equals(id)))
          .getSingleOrNull();
      if (row == null) return;

      await (update(db.shifts)..where(($ShiftsTable s) => s.id.equals(id)))
          .write(
        ShiftsCompanion(
          synced: const Value<bool>(false),
          syncError: Value<String?>(reason),
          syncAttempts: Value<int>(row.syncAttempts + 1),
          lastSyncAttemptAt: Value<DateTime?>(attemptedAt),
        ),
      );
    });
  }
}
