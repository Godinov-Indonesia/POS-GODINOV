import 'package:posgodinov_mobile/core/config/constants.dart';

/// Data struk audit — **bebas dari Drift, Flutter, dan ESC/POS**.
///
/// Tiga dokumen yang tidak pernah dipegang pelanggan, melainkan disimpan
/// bersama laporan shift ([11 §M14.2–M14.4]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// MENGAPA KERTAS, BUKAN SEKADAR BARIS BASIS DATA
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Baris `void_logs` baru terlihat pemilik setelah sinkronisasi, dan pada outlet
/// dengan jaringan buruk itu bisa berjam-jam kemudian. Kertas terlihat SEKETIKA
/// oleh siapa pun yang berdiri di konter — termasuk supervisor yang kebetulan
/// lewat. Itulah nilai sesungguhnya struk pembatalan: ia mengubah pembatalan
/// dari peristiwa yang hanya diketahui pelakunya menjadi peristiwa yang
/// meninggalkan benda fisik di laci.
library;

/// Satu baris item pada struk audit.
class AuditReceiptLine {
  const AuditReceiptLine({
    required this.productName,
    required this.quantity,
    required this.unitPriceMinor,
    this.restock = true,
    this.wasteReasonCode,
  });

  final String productName;
  final int quantity;

  /// **INTEGER SEN** — harga ASAL, bukan harga hari ini.
  final int unitPriceMinor;

  /// Hanya bermakna pada struk retur. `false` = barang tidak kembali ke stok.
  final bool restock;

  /// Hanya bermakna bila [restock] `false`.
  final String? wasteReasonCode;

  int get lineTotalMinor => unitPriceMinor * quantity;
}

/// **M14.2** — Struk Pembatalan, dipakai KETIGA cakupan void.
///
/// Satu model untuk ketiganya bukan penghematan: tiga tata letak berbeda akan
/// menyimpang, dan yang menyimpang adalah yang paling jarang diperiksa —
/// pembatalan baris keranjang, yang justru paling sering dipakai untuk
/// kecurangan.
class CancelReceiptData {
  const CancelReceiptData({
    required this.outletName,
    required this.issuedAt,
    required this.scope,
    required this.cashierName,
    required this.reasonCode,
    required this.lines,
    required this.totalCancelledMinor,
    this.originalCode,
    this.heldCartLabel,
    this.authorizedByName,
    this.reasonNotes = '',
    this.isReprint = false,
  });

  final String outletName;
  final DateTime issuedAt;
  final VoidScope scope;

  /// Kode struk asal — hanya pada [VoidScope.transaction].
  final String? originalCode;

  /// Label pesanan tertahan — hanya pada [VoidScope.heldOrder].
  final String? heldCartLabel;

  final String cashierName;

  /// `null` bila kebijakan outlet tidak mewajibkan otoritas.
  final String? authorizedByName;

  final String reasonCode;
  final String reasonNotes;
  final List<AuditReceiptLine> lines;

  /// **INTEGER SEN** — nilai yang dibatalkan.
  final int totalCancelledMinor;

  final bool isReprint;
}

/// **M14.3** — Struk Pembuangan.
///
/// Ditandatangani **penyaksi**, bukan pelapor. Pembuangan yang hanya
/// ditandatangani orang yang melaporkannya tidak membuktikan apa pun: seluruh
/// nilai kontrolnya justru ada pada kehadiran orang kedua.
class WasteReceiptData {
  const WasteReceiptData({
    required this.outletName,
    required this.issuedAt,
    required this.productName,
    required this.quantity,
    required this.reasonCode,
    required this.staffName,
    this.unit = 'pcs',
    this.reasonNotes = '',
    this.isReprint = false,
  });

  final String outletName;
  final DateTime issuedAt;
  final String productName;
  final int quantity;
  final String unit;
  final String reasonCode;
  final String reasonNotes;
  final String staffName;
  final bool isReprint;
}

/// **M14.4** — Struk Retur.
///
/// Dua tanda tangan, dan keduanya wajib: **pelanggan** membuktikan uang atau
/// barang benar-benar diserahkan kepadanya, **pemberi otoritas** membuktikan
/// toko menyetujuinya. Satu tanda tangan saja menyisakan salah satu dari dua
/// pertanyaan itu tanpa jawaban, dan keduanya muncul justru saat ada sengketa.
class ReturnReceiptData {
  const ReturnReceiptData({
    required this.outletName,
    required this.issuedAt,
    required this.returnCode,
    required this.originalCode,
    required this.cashierName,
    required this.reasonCode,
    required this.refundMethod,
    required this.refundAmountMinor,
    required this.lines,
    this.authorizedByName,
    this.reasonNotes = '',
    this.isReprint = false,
  });

  final String outletName;
  final DateTime issuedAt;

  /// Kode retur ini.
  final String returnCode;

  /// Kode struk penjualan aslinya.
  final String originalCode;

  final String cashierName;
  final String? authorizedByName;
  final String reasonCode;
  final String reasonNotes;
  final RefundMethod refundMethod;

  /// **INTEGER SEN**
  final int refundAmountMinor;

  final List<AuditReceiptLine> lines;
  final bool isReprint;
}

/// Label Bahasa Indonesia untuk kamus beku [ReasonCodes].
///
/// Peta terpisah dari kamusnya: kode adalah kontrak lintas platform yang tidak
/// boleh berubah, label adalah teks yang boleh diperbaiki kapan saja.
abstract final class ReasonLabels {
  static const Map<String, String> voidReasons = <String, String>{
    'CUSTOMER_CANCEL': 'Pelanggan membatalkan',
    'WRONG_ITEM': 'Item salah',
    'WRONG_QTY': 'Jumlah salah',
    'PRICE_DISPUTE': 'Selisih harga',
    'TRAINING': 'Latihan / uji coba',
    'SYSTEM_ERROR': 'Kesalahan sistem',
    'DUPLICATE_ENTRY': 'Input ganda',
    'OTHER': 'Lainnya',
  };

  static const Map<String, String> returnReasons = <String, String>{
    'DEFECTIVE': 'Barang rusak',
    'WRONG_ITEM_DELIVERED': 'Salah barang diserahkan',
    'CUSTOMER_CHANGED_MIND': 'Pelanggan berubah pikiran',
    'EXPIRED': 'Kedaluwarsa',
    'SIZE_EXCHANGE': 'Tukar ukuran',
    'OTHER': 'Lainnya',
  };

  static const Map<String, String> wasteReasons = <String, String>{
    'EXPIRED': 'Kedaluwarsa',
    'SPOILED': 'Basi / rusak',
    'BROKEN': 'Pecah / patah',
    'SPILLED': 'Tumpah',
    'STAFF_MEAL': 'Konsumsi staf',
    'SAMPLE_TASTING': 'Sampel / tester',
    'PRODUCTION_ERROR': 'Kesalahan produksi',
    'OTHER': 'Lainnya',
  };

  /// Label cakupan void, dibaca supervisor pada struk.
  static const Map<VoidScope, String> voidScopes = <VoidScope, String>{
    VoidScope.cartLine: 'Penurunan Kuantitas',
    VoidScope.heldOrder: 'Pesanan Tertahan',
    VoidScope.transaction: 'Transaksi',
  };
}

/// Data struk tutup shift — **butir 9** ([11 §M15.3]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// HANYA ANGKA DEKLARASI. TIDAK ADA YANG LAIN.
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Kelas ini **tidak memiliki** field untuk ekspektasi, selisih, total
/// penjualan, maupun jumlah transaksi — dan ketiadaannya adalah penegakan,
/// bukan kelalaian. Tidak ada parameter opsional yang dapat diisi seseorang di
/// kemudian hari "sekadar untuk melengkapi struk".
///
/// Menyembunyikan ekspektasi di layar lalu mencetaknya di kertas hanya
/// memindahkan kebocorannya ke media yang lebih sulit ditarik kembali: struk
/// yang sudah keluar tidak dapat disunting, dan kasir yang membacanya sebelum
/// shift berikutnya sudah tahu persis angka apa yang harus ia deklarasikan
/// besok.
class ShiftReportData {
  const ShiftReportData({
    required this.outletName,
    required this.shiftId,
    required this.cashierName,
    required this.openedAt,
    required this.closedAt,
    required this.declaredCashMinor,
    required this.declaredEdcMinor,
    required this.declaredQrisMinor,
    required this.blindClose,
    this.closedByName,
    this.isReprint = false,
  });

  final String outletName;
  final String shiftId;
  final String cashierName;
  final DateTime openedAt;
  final DateTime closedAt;

  /// Tiga angka yang berasal dari kasir. Tidak ada yang keempat.
  final int declaredCashMinor;
  final int declaredEdcMinor;
  final int declaredQrisMinor;

  /// `false` menandai shift yang ditutup PAKSA oleh supervisor — angkanya bukan
  /// hasil hitungan siapa pun, dan kertasnya harus mengatakan itu.
  final bool blindClose;

  /// Nama supervisor pada Force Close.
  final String? closedByName;

  final bool isReprint;
}
