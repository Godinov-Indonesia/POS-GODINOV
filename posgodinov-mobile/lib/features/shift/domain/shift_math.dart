import 'package:posgodinov_mobile/core/config/constants.dart';

/// Ringkasan satu transaksi yang relevan bagi hitungan kas.
///
/// Sengaja **bukan** entitas transaksi penuh: hitungan shift hanya peduli pada
/// tiga hal, dan mempersempitnya membuat fungsi di bawah dapat diuji tanpa
/// merakit objek besar.
class CashLine {
  const CashLine({
    required this.totalMinor,
    required this.method,
    required this.status,
  });

  final int totalMinor;
  final PaymentMethod method;
  final TransactionStatus status;
}

/// Aritmetika penutupan shift — **fungsi murni, integer sen**.
///
/// # Mengapa ini penting
///
/// Server **tidak menghitung ulang** `expected_balance` maupun `discrepancy`;
/// keduanya dipercaya apa adanya dari klien ([02 §2.11]). Nilai `discrepancy`
/// inilah yang dijumlahkan pada dashboard pemilik sebagai indikator selisih
/// kas — jadi rumus di berkas ini adalah satu-satunya sumber angka yang akan
/// dipakai pemilik untuk menilai kasirnya.
abstract final class ShiftMath {
  /// `opening + Σ(transaksi COMPLETED bermetode CASH)`.
  ///
  /// **Hanya `CASH` yang dihitung** ([04 §A.3]). QRIS, debit, dan transfer
  /// tidak pernah masuk laci; memasukkannya membuat setiap shift tampak
  /// kekurangan uang sebesar total pembayaran non-tunai.
  ///
  /// Transaksi `CANCELLED` juga dikecualikan — uangnya sudah dikembalikan.
  static int expectedBalance({
    required int openingBalanceMinor,
    required List<CashLine> lines,
  }) {
    return lines
        .where(
          (CashLine l) =>
              l.status == TransactionStatus.completed &&
              cashMethods.contains(l.method),
        )
        .fold(openingBalanceMinor, (int sum, CashLine l) => sum + l.totalMinor);
  }

  /// `closing − expected`.
  ///
  /// **Negatif berarti kas kurang** — uang fisik lebih sedikit daripada yang
  /// seharusnya. Positif berarti lebih.
  static int discrepancy({
    required int closingBalanceMinor,
    required int expectedBalanceMinor,
  }) =>
      closingBalanceMinor - expectedBalanceMinor;

  /// Total penjualan tunai saja, tanpa modal awal — ditampilkan sebagai baris
  /// terpisah di P-12 supaya kasir dapat memeriksa hitungannya sendiri.
  static int cashSales(List<CashLine> lines) => expectedBalance(
        openingBalanceMinor: 0,
        lines: lines,
      );

  /// Total penjualan non-tunai, untuk informasi.
  ///
  /// **Tidak** memengaruhi laci sama sekali.
  static int nonCashSales(List<CashLine> lines) => lines
      .where(
        (CashLine l) =>
            l.status == TransactionStatus.completed &&
            !cashMethods.contains(l.method),
      )
      .fold(0, (int sum, CashLine l) => sum + l.totalMinor);

  /// Jumlah transaksi yang dihitung sebagai penjualan.
  static int completedCount(List<CashLine> lines) => lines
      .where((CashLine l) => l.status == TransactionStatus.completed)
      .length;
}
