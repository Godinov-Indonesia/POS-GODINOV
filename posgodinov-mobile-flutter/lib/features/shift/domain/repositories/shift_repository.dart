import 'package:posgodinov_mobile/features/shift/domain/entities/shift.dart';

abstract interface class ShiftRepository {
  /// Shift yang sedang berjalan, atau `null` bila kasir belum membuka shift.
  Future<Shift?> currentOpenShift();

  /// Aliran shift berjalan — dipakai StatusBar dan gerbang navigasi.
  Stream<Shift?> watchOpenShift();

  /// Membuka shift baru.
  ///
  /// UUID dibuat di sisi klien dan **tidak pernah** diregenerasi, termasuk saat
  /// pengiriman ulang ([03 §2.3]).
  ///
  /// Shift langsung masuk antrean sinkronisasi walau masih `OPEN`: transaksi
  /// memiliki foreign key ke `shifts(id)`, sehingga induknya harus sudah ada di
  /// server sebelum anaknya tiba ([09 §6.1]).
  /// [masterDataVersion] dan [deviceId] **wajib** sejak M15.1/M15.2
  /// (butir 10 & 12). Keduanya bukan metadata pelengkap:
  ///
  ///   · `master_data_version` adalah bukti bahwa katalog yang dipakai
  ///     berjualan hari ini benar-benar yang terbaru. Server MENOLAK shift
  ///     `OPEN` tanpanya.
  ///   · `device_id` adalah yang dikunci `uq_shift_open_per_device`.
  ///
  /// Keduanya diteruskan pemanggil dari putusan gerbang, BUKAN dibaca sendiri
  /// di sini — nilai bawaan yang diam-diam benar akan membuat gerbangnya dapat
  /// dilewati hanya dengan lupa meneruskan argumen.
  Future<Shift> open({
    required String staffId,
    required int openingBalanceMinor,
    required int? masterDataVersion,
    required String deviceId,
    bool blindClose = true,
  });

  /// Menutup shift — **Blind Closing**, butir 9 ([11 §M15.3]).
  ///
  /// ⚠️ Tidak menerima dan tidak menghitung `expected_balance` maupun
  /// `discrepancy`. Keduanya milik `ShiftReconcileService` di server, dan
  /// itulah seluruh maksud butir 9: orang yang paling berkepentingan agar
  /// selisihnya nol tidak boleh menjadi orang yang menghitungnya.
  ///
  /// Shift yang ditutup **kembali masuk antrean sinkronisasi** — penutupan
  /// adalah pengiriman kedua yang membawa angka kas sesungguhnya.
  Future<Shift> close({
    required String shiftId,
    required int declaredCashMinor,
    required int declaredEdcMinor,
    required int declaredQrisMinor,
    bool blindClose = true,
    String? closedBy,
  });
}
