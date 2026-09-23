import 'package:posgodinov_mobile/core/config/constants.dart';

/// Satu baris yang dipilih untuk diretur.
///
/// Tinggal di **domain** karena ia melintasi batas: layar retur menyusunnya,
/// repositori memakainya. Objek nilai yang hanya hidup di `data/` akan memaksa
/// presentation mengimpor lapisan data untuk sekadar menyebut tipenya —
/// pelanggaran `presentation_no_data` ([09 §2.2]).
class ReturnLineDraft {
  const ReturnLineDraft({
    required this.transactionItemId,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPriceMinor,
    required this.restock,
    this.wasteReasonCode,
  });

  final String transactionItemId;
  final String productId;
  final String productName;
  final int quantity;
  final int unitPriceMinor;

  /// `false` untuk barang rusak: uang kembali ke pelanggan, stok **tidak**.
  final bool restock;

  /// Wajib bila [restock] `false`.
  final String? wasteReasonCode;

  int get lineTotalMinor => unitPriceMinor * quantity;
}

/// Kontrak penulisan retur — **butir 15** ([11 §M13.3]).
///
/// Dideklarasikan di domain dan diimplementasikan di data, seperti seluruh
/// repositori lain ([01 §1]). Layar retur bergantung pada kontrak ini, bukan
/// pada `ReturnRepositoryImpl`: yang terakhir menyeret drift dan `PrintQueue`
/// masuk ke pohon widget.
abstract interface class ReturnRepository {
  /// Kuantitas yang **sudah** diretur per `transaction_item_id`.
  ///
  /// Sumber `alreadyReturned` untuk `decideCancellation`. Membaca dari retur
  /// lokal saja bersifat optimistis: retur dari perangkat lain baru terlihat
  /// setelah sinkronisasi. Server tetap penegak terakhir dengan
  /// `SELECT … FOR UPDATE` ([11 §3.4]).
  Future<Map<String, int>> returnedQuantities(String transactionId);

  /// Menyimpan retur beserta itemnya, atomik. Mengembalikan `return_id`.
  ///
  /// ⚠️ `refundAmount` **dihitung di implementasi**, bukan diterima dari UI.
  /// Nilai yang datang dari layar dapat menyimpang dari item yang benar-benar
  /// dipilih, dan selisihnya baru terlihat saat rekonsiliasi kas.
  Future<String> saveReturn({
    required String originalTransactionId,
    required String shiftId,
    required String staffId,
    required RefundMethod refundMethod,
    required String reasonCode,
    required String reasonNotes,
    required List<ReturnLineDraft> lines,
    required Map<String, int> originalQuantities,
    String? authorizedBy,
    String cashierName = '',
    String? authorizedByName,
    String originalCode = '',
  });
}
