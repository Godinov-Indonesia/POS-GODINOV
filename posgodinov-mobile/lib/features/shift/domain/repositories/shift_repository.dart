import 'package:posgodinov_mobile/features/shift/domain/entities/shift.dart';
import 'package:posgodinov_mobile/features/shift/domain/shift_math.dart';

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
  Future<Shift> open({
    required String staffId,
    required int openingBalanceMinor,
  });

  /// Baris kas shift berjalan — dasar hitungan `expected_balance` di P-12.
  Future<List<CashLine>> cashLinesOf(String shiftId);

  /// Menutup shift dengan uang fisik hasil hitung kasir.
  ///
  /// `expected_balance` dan `discrepancy` dihitung **di sini**, bukan diterima
  /// dari UI: keduanya adalah angka yang muncul di dashboard pemilik
  /// ([02 §2.11]), dan rumusnya tidak boleh punya dua tempat tinggal.
  ///
  /// Shift yang ditutup **kembali masuk antrean sinkronisasi** — penutupan
  /// adalah pengiriman kedua yang membawa angka kas sesungguhnya.
  Future<Shift> close({
    required String shiftId,
    required int closingBalanceMinor,
  });
}
