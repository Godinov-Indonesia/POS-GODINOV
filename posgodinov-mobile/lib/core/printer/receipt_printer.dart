import 'dart:typed_data';

import 'package:posgodinov_mobile/core/config/constants.dart';

/// Transport pencetakan yang didukung ([09 §4.1]).
enum PrinterKind { btClassic, ble, usb, network, sunmiInner }

/// Keadaan printer yang dilaporkan ke UI.
enum PrinterState {
  /// Belum ada printer terpasang sama sekali.
  unavailable,
  disconnected,
  connecting,
  ready,
  printing,

  /// Terdeteksi **hanya** pada transport yang mendukung baca-balik
  /// (SPP, USB, TCP). Pada BLE mayoritas printer murah tidak mengekspos
  /// karakteristik *notify*, jadi keadaan ini tidak akan pernah muncul.
  outOfPaper,
  error,
}

class PrinterStatus {
  const PrinterStatus(this.state, {this.message});

  final PrinterState state;
  final String? message;
}

class PrinterTarget {
  const PrinterTarget({
    required this.id,
    required this.name,
    required this.kind,
  });

  /// MAC address · `vendorId:productId` · `host:port` · `INNER`.
  final String id;
  final String name;
  final PrinterKind kind;
}

/// Satu baris pada struk.
class ReceiptLine {
  const ReceiptLine({
    required this.productName,
    required this.quantity,
    required this.unitPriceMinor,
  });

  final String productName;
  final int quantity;
  final int unitPriceMinor;

  int get lineTotalMinor => unitPriceMinor * quantity;
}

/// Data struk — **bebas dari Drift, Flutter, dan ESC/POS**.
///
/// Pemisahan renderer dan transport (ADR-07, [05 §1.7.1]): objek ini adalah
/// masukan bagi *renderer*, yang menghasilkan byte; transport hanya
/// mengirimkan byte itu.
class ReceiptData {
  const ReceiptData({
    required this.transactionId,
    required this.shortId,
    required this.outletName,
    required this.cashierName,
    required this.lines,
    required this.totalMinor,
    required this.paymentMethod,
    required this.cashReceivedMinor,
    required this.changeMinor,
    required this.issuedAt,
    this.customerName = '',
  });

  final String transactionId;

  /// Delapan karakter pertama UUID — nomor yang dibaca manusia.
  final String shortId;

  final String outletName;
  final String cashierName;
  final List<ReceiptLine> lines;
  final int totalMinor;
  final PaymentMethod paymentMethod;
  final int cashReceivedMinor;
  final int changeMinor;
  final DateTime issuedAt;
  final String customerName;
}

/// Kontrak printer struk.
///
/// Diperkenalkan pada M4 agar alur pembayaran dapat berjalan ujung ke ujung;
/// adapter sesungguhnya (BT Classic/BLE/USB/TCP/Sunmi) menyusul pada **M6**.
abstract interface class ReceiptPrinter {
  PrinterKind get kind;

  Future<bool> isAvailable();

  /// Mencetak dan mengembalikan `true` bila berhasil.
  ///
  /// **Tidak pernah melempar.** Pemanggil tidak boleh dipaksa membungkus setiap
  /// pencetakan dengan `try`, karena godaan untuk membatalkan transaksi di blok
  /// `catch` terlalu besar — dan itu persis kesalahan yang paling mahal
  /// ([09 §7.3]).
  Future<bool> printReceipt(ReceiptData data);

  /// Byte mentah, dipakai adapter dan pengujian ESC/POS pada M6.
  Future<bool> printBytes(Uint8List bytes);

  Stream<PrinterStatus> get status;
}

/// Kegagalan pada lapisan printer.
class PrinterException implements Exception {
  const PrinterException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// **Transport** — cara byte sampai ke printer.
///
/// Dipisahkan tegas dari [ReceiptPrinter] yang merupakan **renderer + kebijakan**
/// (ADR-07, [05 §1.7.1]). Adapter di bawah antarmuka ini tidak tahu apa pun
/// tentang struk, Rupiah, maupun ESC/POS; ia hanya memindahkan byte.
///
/// Pemisahan ini yang membuat lima transport berbeda — BT Classic, BLE, USB,
/// TCP, dan printer internal Sunmi — berbagi satu tata letak struk.
abstract interface class PrinterTransport {
  PrinterKind get kind;

  /// `false` bila perangkat keras atau izinnya tidak tersedia.
  Future<bool> isAvailable();

  /// Mencari printer yang dapat dijangkau. Tidak semua transport mendukungnya.
  Future<List<PrinterTarget>> discover({
    Duration timeout = const Duration(seconds: 6),
  }) async =>
      const <PrinterTarget>[];

  Future<void> connect(PrinterTarget target);

  Future<void> disconnect();

  /// Mengirim byte. Melempar [PrinterException] bila gagal.
  Future<void> write(Uint8List bytes);

  /// Status kertas, bila transport mendukung baca-balik.
  ///
  /// Mengembalikan `null` bila tidak didukung — **bukan** menebak. Pada BLE,
  /// mayoritas printer murah tidak mengekspos karakteristik *notify*, sehingga
  /// kertas habis tidak akan pernah terdeteksi otomatis ([09 §4.2]).
  Future<PrinterState?> queryPaperStatus() async => null;
}

/// Perintah ESC/POS mentah yang dipakai di luar renderer.
abstract final class PrinterCommands {
  /// `DLE EOT 4` — status sensor kertas secara *real-time*.
  ///
  /// Berbeda dari perintah ESC/POS biasa, keluarga `DLE EOT` diproses printer
  /// **segera**, bahkan saat buffer cetak masih penuh.
  static final Uint8List realtimePaperStatus =
      Uint8List.fromList(<int>[0x10, 0x04, 0x04]);

  /// Menafsirkan balasan `DLE EOT 4`.
  ///
  /// Bit 5 dan 6 menyala berarti kertas benar-benar habis; bit 2 dan 3 berarti
  /// kertas hampir habis — yang sengaja **tidak** dilaporkan sebagai
  /// [PrinterState.outOfPaper], karena struk masih dapat dicetak dan
  /// menghentikan kasir di situ merugikan tanpa alasan.
  static PrinterState? interpretPaperStatus(List<int> reply) {
    if (reply.isEmpty) return null;

    final int status = reply.first;
    final bool habis = (status & 0x60) != 0;
    return habis ? PrinterState.outOfPaper : PrinterState.ready;
  }
}
