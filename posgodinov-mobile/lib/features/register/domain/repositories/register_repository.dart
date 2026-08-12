import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/sale_transaction.dart';

/// Kontrak persistensi transaksi penjualan.
abstract interface class RegisterRepository {
  /// Menyimpan transaksi **beserta seluruh itemnya secara atomik**.
  ///
  /// Dipanggil **sebelum** perintah cetak dikirim. Uang sudah diterima; sebuah
  /// printer yang bermasalah bukan alasan menghilangkan penjualan
  /// ([09 §7.3]).
  ///
  /// UUID transaksi dibuat di dalam implementasi dan dikembalikan lewat
  /// [SaleTransaction.id] — pemanggil tidak boleh membuatnya sendiri agar tidak
  /// ada dua sumber UUID.
  Future<SaleTransaction> completeSale({
    required String shiftId,
    required List<CartLine> lines,
    required PaymentMethod paymentMethod,
    required int cashReceivedMinor,
    String customerName,
  });
}

/// Kontrak pesanan ditahan (P-08).
///
/// > **Murni lokal.** Backend tidak mengenal konsep pesanan tertahan
/// > ([03 §14]); tidak ada satu pun metode di sini yang menyentuh jaringan.
abstract interface class HeldCartRepository {
  /// Menahan keranjang berjalan.
  Future<String> hold({
    required List<CartLine> lines,
    required String label,
  });

  /// Daftar pesanan tertahan, terbaru lebih dulu.
  Stream<List<HeldCartSummary>> watchAll();

  /// Mengambil kembali pesanan dan **menghapusnya** dari daftar tahan.
  Future<List<CartLine>> resume(String id);

  Future<void> discard(String id);
}

/// Ringkasan pesanan tertahan untuk daftar P-08.
class HeldCartSummary {
  const HeldCartSummary({
    required this.id,
    required this.label,
    required this.totalMinor,
    required this.itemCount,
    required this.heldAt,
  });

  final String id;
  final String label;
  final int totalMinor;
  final int itemCount;
  final DateTime heldAt;
}
