import 'dart:async';
import 'dart:typed_data';

import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';

/// Printer yang **selalu melaporkan gagal** — bukan yang berpura-pura berhasil.
///
/// Sejak M6, `PrinterManager` mengambil alih peran produksi. Kelas ini tetap
/// dipertahankan sebagai **test double** dan sebagai pengganti aman pada
/// lingkungan tanpa perangkat keras (uji integrasi, emulator, mode Kiosk yang
/// belum dipasangi printer).
///
/// Pilihan "selalu gagal" disengaja: printer palsu yang mengaku sukses
/// menyembunyikan bug termahal yang mungkin ada — transaksi hilang karena
/// kegagalan cetak diperlakukan sebagai pembatalan. Yang selalu gagal justru
/// memaksa jalur "Cetak Ulang" tetap teruji ([09 §7.3]).
class NoopReceiptPrinter implements ReceiptPrinter {
  NoopReceiptPrinter();

  final StreamController<PrinterStatus> _status =
      StreamController<PrinterStatus>.broadcast();

  /// Struk terakhir yang diminta cetak — berguna untuk pengujian dan untuk
  /// pratinjau di layar selama M6 belum selesai.
  ReceiptData? lastRequested;

  @override
  PrinterKind get kind => PrinterKind.btClassic;

  @override
  Future<bool> isAvailable() async => false;

  @override
  Future<bool> printReceipt(ReceiptData data) async {
    lastRequested = data;
    _emit(
      const PrinterStatus(
        PrinterState.unavailable,
        message: 'Printer belum dipasang. Struk dapat dicetak ulang dari '
            'Riwayat setelah printer terhubung.',
      ),
    );
    return false;
  }

  @override
  Future<bool> printBytes(Uint8List bytes) async => false;

  @override
  Stream<PrinterStatus> get status => _status.stream;

  void _emit(PrinterStatus s) {
    if (!_status.isClosed) _status.add(s);
  }

  Future<void> dispose() => _status.close();
}
