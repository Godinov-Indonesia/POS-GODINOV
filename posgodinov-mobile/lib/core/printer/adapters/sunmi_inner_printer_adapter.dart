
import 'package:flutter/services.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';

/// Printer **internal** handheld POS Sunmi / iMin.
///
/// Printer ini tidak muncul sebagai perangkat Bluetooth maupun USB — ia diakses
/// lewat *service* AIDL milik vendor (`woyou.aidlservice.jiuiv5`). Karena itu
/// tidak ada paket Flutter generik yang menjangkaunya; jembatannya adalah
/// `SunmiPrinterPlugin.kt` yang ditulis khusus untuk proyek ini.
///
/// Byte ESC/POS dibangkitkan di Dart oleh renderer yang sama dengan transport
/// lain, lalu diteruskan apa adanya lewat `sendRAWData` (ADR-07).
class SunmiInnerPrinterAdapter implements PrinterTransport {
  SunmiInnerPrinterAdapter({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel(channelName);

  static const String channelName = 'id.godinov.pos/sunmi_printer';

  final MethodChannel _channel;

  bool? _available;

  @override
  PrinterKind get kind => PrinterKind.sunmiInner;

  /// Hasil pemeriksaan di-*cache*: mengikat service AIDL bukan operasi murah,
  /// dan jawabannya tidak berubah selama aplikasi hidup.
  @override
  Future<bool> isAvailable() async {
    if (_available != null) return _available!;

    try {
      _available = await _channel.invokeMethod<bool>('isAvailable') ?? false;
    } on PlatformException {
      _available = false;
    } on MissingPluginException {
      // Berjalan di perangkat non-Sunmi atau di lingkungan uji.
      _available = false;
    }
    return _available!;
  }

  /// Tidak ada yang perlu dihubungkan — printer ada di dalam badan perangkat.
  @override
  Future<void> connect(PrinterTarget target) async {}

  @override
  Future<void> disconnect() async {}

  @override
  Future<List<PrinterTarget>> discover({
    Duration timeout = const Duration(seconds: 6),
  }) async {
    if (!await isAvailable()) return const <PrinterTarget>[];
    return const <PrinterTarget>[
      PrinterTarget(
        id: 'INNER',
        name: 'Printer internal perangkat',
        kind: PrinterKind.sunmiInner,
      ),
    ];
  }

  @override
  Future<void> write(Uint8List bytes) async {
    try {
      final bool ok =
          await _channel.invokeMethod<bool>('printRaw', <String, dynamic>{
                'bytes': bytes,
              }) ??
              false;
      if (!ok) {
        throw const PrinterException('Printer internal menolak perintah cetak.');
      }
    } on PlatformException catch (e) {
      throw PrinterException(
        'Printer internal gagal: ${e.message ?? e.code}',
      );
    } on MissingPluginException {
      throw const PrinterException(
        'Printer internal tidak tersedia di perangkat ini.',
      );
    }
  }

  /// Sunmi melaporkan status lewat AIDL, bukan lewat `DLE EOT`.
  ///
  /// Kode vendor: `0` normal · `1` persiapan · `2` kertas habis ·
  /// `3` terlalu panas · `4` tutup terbuka.
  @override
  Future<PrinterState?> queryPaperStatus() async {
    try {
      final int code =
          await _channel.invokeMethod<int>('paperStatus') ?? -1;

      return switch (code) {
        0 || 1 => PrinterState.ready,
        2 => PrinterState.outOfPaper,
        3 || 4 => PrinterState.error,
        _ => null,
      };
    } on PlatformException {
      return null;
    } on MissingPluginException {
      return null;
    }
  }
}
