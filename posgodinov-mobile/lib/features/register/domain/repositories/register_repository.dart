import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/sale_transaction.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/tender_draft.dart';

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
  /// [tenders] adalah rincian pembayaran — **sumber kebenaran pada v2**
  /// (butir 8, [11 §3.2]).
  ///
  /// Kosong berarti pembayaran metode tunggal; implementasi mensintesis satu
  /// baris tender dari [paymentMethod] supaya invarian
  /// `Σ tenders = total_amount` berlaku untuk SETIAP transaksi, berapa pun
  /// jalur yang melahirkannya.
  ///
  /// Dua tender atau lebih membuat `payment_method` bernilai `SPLIT` —
  /// ringkasan, bukan cara membayar.
  Future<SaleTransaction> completeSale({
    required String shiftId,
    required List<CartLine> lines,
    required PaymentMethod paymentMethod,
    required int cashReceivedMinor,
    String customerName,
    List<TenderDraft> tenders,
  });

  /// Mencatat pembatalan **baris keranjang** — butir 5 ([11 §M13.4]).
  ///
  /// ═══════════════════════════════════════════════════════════════════════
  /// PENURUNAN BESAR ADALAH PEMBATALAN, BUKAN KOREKSI
  /// ═══════════════════════════════════════════════════════════════════════
  ///
  /// Barang yang sudah masuk keranjang lalu lenyap dalam jumlah besar adalah
  /// bentuk kecurangan paling murah yang ada: tidak ada transaksi, tidak ada
  /// stok bergerak, tidak ada satu pun baris yang dapat diperiksa. Butir 5
  /// menutupnya dengan menuntut alasan tercatat begitu penurunan gabungan
  /// melewati `config.void_threshold_qty`.
  ///
  /// ⚠️ `items_snapshot` WAJIB terisi. Baris keranjang **tidak pernah ada di
  /// server** — ia lenyap begitu keranjang dikosongkan — sehingga snapshot ini
  /// satu-satunya salinan isi yang akan pernah dilihat auditor.
  ///
  /// Struk pembatalan diantrekan **setelah** log tertulis (butir 6, aturan R6):
  /// kegagalan cetak tidak pernah menggulung pembatalan yang sudah sah.
  Future<void> recordCartLineVoid({
    required String shiftId,
    required String staffId,
    required CartLine line,
    required int quantityBefore,
    required int quantityAfter,
    required String reasonCode,
    required String reasonNotes,
    String? authorizedBy,
    String cashierName,
    String? authorizedByName,
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

  /// **BUTIR 13 — tidak ada penghapusan tanpa jejak** ([11 §M13.5]).
  ///
  /// Metode `discard` yang lama DIHAPUS, bukan dipertahankan berdampingan:
  /// jalur yang masih ada akan dipakai lagi oleh orang yang tidak tahu mengapa
  /// ia tidak boleh dipakai.
  ///
  /// Pesanan tertahan **tidak pernah ada di server**. Menghapusnya berarti
  /// isinya lenyap tanpa jejak — tidak ada transaksi, tidak ada stok bergerak,
  /// tidak ada baris untuk diaudit. Itulah persis bentuk kecurangan yang butir
  /// 13 dibangun untuk menutupnya: menahan pesanan besar, menerima uangnya,
  /// lalu membuang pesanannya.
  ///
  /// Karena itu pembatalan menulis `void_logs` ber-scope `HELD_ORDER` beserta
  /// `items_snapshot` UTUH — snapshot itu satu-satunya salinan isi pesanan yang
  /// akan pernah dilihat auditor.
  Future<void> cancel({
    required String id,
    required String shiftId,
    required String staffId,
    required String reasonCode,
    required String reasonNotes,
    String? authorizedBy,
    String cashierName,
    String? authorizedByName,
  });
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
