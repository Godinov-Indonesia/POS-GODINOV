import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';

/// Satu baris riwayat transaksi.
///
/// Dipakai untuk kedua tab P-09 — "Hari Ini" yang dibaca dari SQLite lokal, dan
/// "Sebelumnya" yang ditarik dari server. Bentuknya sengaja sama supaya daftar
/// dan aksi cetak ulang tidak perlu bercabang.
class HistoryEntry extends Equatable {
  const HistoryEntry({
    required this.id,
    required this.shiftId,
    required this.totalMinor,
    required this.paymentMethod,
    required this.status,
    required this.clientCreatedAt,
    required this.isLocal,
    this.customerName = '',
    this.cancelNotes = '',
    this.synced = true,
    this.lines = const <HistoryLine>[],
    this.receiptPrintedAt,
    this.itemIds = const <String>[],
  });

  final String id;
  final String shiftId;
  final int totalMinor;
  final PaymentSummary paymentMethod;
  final TransactionStatus status;
  final DateTime clientCreatedAt;

  /// `true` bila baris berasal dari basis data perangkat.
  ///
  /// Hanya baris lokal yang dapat di-void dan dicetak ulang: mencetak ulang
  /// struk dari server berarti merakit ulang data yang item-nya tidak lengkap.
  final bool isLocal;

  final String customerName;
  final String cancelNotes;

  /// Selalu `true` untuk baris server — ia ada di sana justru karena tersinkron.
  final bool synced;

  final List<HistoryLine> lines;

  /// **DISKRIMINATOR VOID vs RETUR** (butir 15, [11 §2.1]).
  ///
  /// `null` = struk belum pernah terbit → wilayah VOID.
  /// Terisi = dokumen sudah berpindah ke pelanggan → wilayah RETUR.
  final DateTime? receiptPrintedAt;

  /// `transaction_items.id` per baris, sejajar urutan [lines].
  ///
  /// Dibutuhkan alur Retur: batas retur dihitung per BARIS item, dan baris itu
  /// diidentifikasi oleh id-nya — bukan oleh produk, karena satu produk dapat
  /// muncul di dua baris dengan harga snapshot berbeda.
  final List<String> itemIds;

  /// `true` untuk `voided` MAUPUN `cancelled` (warisan v1).
  ///
  /// Memeriksa salah satunya saja akan membuat transaksi lama tampak masih
  /// dapat dibatalkan, dan server memotong stok dua kali ([11 §2.1]).
  bool get isCancelled => status.isCancellation;

  /// ⚠️ **Bukan penentu jalur pembatalan.** Keputusan Void-vs-Retur hidup di
  /// `core/pos/cancellation_policy.dart` dan HANYA di sana ([11 §M13.1]).
  /// Getter ini semata menyaring baris server yang itemnya tidak lengkap.
  bool get canCancel => isLocal && !isCancelled;

  /// Delapan karakter pertama UUID, huruf besar ([06 §2.6]).
  String get shortId =>
      id.replaceAll('-', '').padRight(8, '0').substring(0, 8).toUpperCase();

  @override
  List<Object?> get props => <Object?>[
        id,
        shiftId,
        totalMinor,
        paymentMethod,
        status,
        clientCreatedAt,
        isLocal,
        customerName,
        cancelNotes,
        synced,
        lines,
      ];
}

class HistoryLine extends Equatable {
  const HistoryLine({
    required this.productName,
    required this.quantity,
    required this.unitPriceMinor,
    this.productId = '',
  });

  final String productName;
  final int quantity;

  /// **INTEGER SEN** — snapshot harga saat penjualan terjadi.
  final int unitPriceMinor;

  /// Dibutuhkan alur Retur ([11 §M13.3]): `return_items.product_id` menunjuk
  /// produk, bukan nama. Kosong untuk baris yang berasal dari server, yang
  /// memang tidak dapat diretur dari perangkat ini.
  final String productId;

  int get lineTotalMinor => unitPriceMinor * quantity;

  @override
  List<Object?> get props =>
      <Object?>[productId, productName, quantity, unitPriceMinor];
}
