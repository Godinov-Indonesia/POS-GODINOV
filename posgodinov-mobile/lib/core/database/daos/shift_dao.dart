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

  /// Menutup shift — **Blind Closing**, butir 9 ([11 §M15.3]).
  ///
  /// ═══════════════════════════════════════════════════════════════════════
  /// TIGA ANGKA MASUK. NOL ANGKA DIHITUNG.
  /// ═══════════════════════════════════════════════════════════════════════
  ///
  /// Parameter `expectedBalanceMinor` dan `discrepancyMinor` yang dulu ada di
  /// sini SENGAJA dihapus, bukan dijadikan opsional. Wewenang menghitungnya
  /// pindah ke `ShiftReconcileService` di server (aturan R3/R4), dan parameter
  /// opsional akan tetap diisi oleh pemanggil lama yang tidak dibaca ulang
  /// siapa pun — lalu angkanya merambat kembali ke server.
  ///
  /// `closingBalanceMinor` v1 diisi dari deklarasi laci selama jendela
  /// deprekasi M18: laporan lama membacanya, dan membiarkannya nol membuat
  /// seluruh shift v2 tampak kosong di laporan yang belum dimigrasi.
  ///
  /// Seluruh nominal **sen**.
  Future<void> closeShift({
    required String id,
    required int declaredCashMinor,
    required int declaredEdcMinor,
    required int declaredQrisMinor,
    required DateTime clientClosedAt,
    bool blindClose = true,
    String? closedBy,
  }) {
    return (update(db.shifts)..where(($ShiftsTable s) => s.id.equals(id))).write(
      ShiftsCompanion(
        status: const Value<ShiftStatus>(ShiftStatus.closed),
        declaredCashMinor: Value<int>(declaredCashMinor),
        declaredEdcTotalMinor: Value<int>(declaredEdcMinor),
        declaredQrisTotalMinor: Value<int>(declaredQrisMinor),
        blindClose: Value<bool>(blindClose),
        closedBy: Value<String?>(closedBy),

        // Jendela deprekasi — lihat catatan di atas.
        closingBalanceMinor: Value<int>(declaredCashMinor),

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

  /// Memindahkan baris ke KARANTINA ([11 §4.3]).
  ///
  /// Dipanggil ketika server menolak dengan `retryable: false`. Barisnya
  /// **tidak dihapus** — datanya tetap utuh dan muncul di P-13 sebagai "Butuh
  /// tindakan". Yang berubah hanya keanggotaannya di antrean, supaya satu baris
  /// cacat permanen berhenti menahan seluruh baris di belakangnya.
  Future<void> markQuarantined(String id, DateTime at, String reason) {
    return (update(db.shifts)..where(($ShiftsTable t) => t.id.equals(id)))
        .write(
      ShiftsCompanion(
        quarantined: const Value<bool>(true),
        synced: const Value<bool>(false),
        syncError: Value<String?>(reason),
        lastSyncAttemptAt: Value<DateTime?>(at),
      ),
    );
  }

  /// Jumlah baris yang menuntut tindakan manusia.
  Stream<int> watchQuarantinedCount() {
    final Expression<int> count = db.shifts.id.count();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.shifts)
          ..addColumns(<Expression<Object>>[count])
          ..where(db.shifts.quarantined.equals(true));

    return query.map((TypedResult row) => row.read(count) ?? 0).watchSingle();
  }

}
