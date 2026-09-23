import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';

/// Aritmetika keranjang — **seluruhnya `int` sen, seluruhnya fungsi murni**.
///
/// Dart murni tanpa Flutter, sehingga dapat diuji tanpa binding widget. Widget
/// **tidak pernah** menghitung uang sendiri; ia menerima hasil dari sini
/// ([06 §2.5] aturan 6).
abstract final class CartMath {
  /// Jumlah seluruh baris.
  static int subtotal(List<CartLine> lines) =>
      lines.fold(0, (int sum, CartLine l) => sum + l.lineTotalMinor);

  /// Total tagihan.
  ///
  /// Sama dengan [subtotal]: backend **tidak memiliki** konsep pajak maupun
  /// diskon ([03 §14]). Fungsi terpisah tetap disediakan agar penambahan
  /// keduanya kelak hanya menyentuh satu tempat.
  static int total(List<CartLine> lines) => subtotal(lines);

  /// Jumlah item (menjumlahkan kuantitas, bukan menghitung baris).
  static int itemCount(List<CartLine> lines) =>
      lines.fold(0, (int sum, CartLine l) => sum + l.quantity);

  /// Kembalian. **Negatif berarti uang pelanggan kurang** — pemanggil wajib
  /// menonaktifkan tombol selesaikan ([06 §4.6.5]).
  static int change({
    required int totalMinor,
    required int cashReceivedMinor,
  }) =>
      cashReceivedMinor - totalMinor;

  /// `true` bila pembayaran tunai mencukupi.
  static bool isCashSufficient({
    required int totalMinor,
    required int cashReceivedMinor,
  }) =>
      cashReceivedMinor >= totalMinor;
}
