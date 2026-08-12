import 'package:device_info_plus/device_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:posgodinov_mobile/core/printer/adapters/network_printer_adapter.dart';
import 'package:posgodinov_mobile/core/printer/adapters/platform_printer_adapter.dart';
import 'package:posgodinov_mobile/core/printer/adapters/sunmi_inner_printer_adapter.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';

/// Membuat dan memilih transport printer.
///
/// **Kasir tidak pernah memilih transport.** Ia memilih *printer*; registry ini
/// yang memutuskan apakah itu Bluetooth Classic, BLE, USB, TCP, atau printer
/// internal perangkat.
class PrinterRegistry {
  PrinterRegistry({DeviceInfoPlugin? deviceInfo})
      : _deviceInfo = deviceInfo ?? DeviceInfoPlugin();

  final DeviceInfoPlugin _deviceInfo;

  final Map<PrinterKind, PrinterTransport> _cache =
      <PrinterKind, PrinterTransport>{};

  /// Vendor handheld POS yang membawa printer internal.
  static const List<String> _handheldVendors = <String>['sunmi', 'imin'];

  PrinterTransport adapterFor(PrinterKind kind) {
    return _cache.putIfAbsent(kind, () => _create(kind));
  }

  PrinterTransport _create(PrinterKind kind) => switch (kind) {
        PrinterKind.sunmiInner => SunmiInnerPrinterAdapter(),
        PrinterKind.network => NetworkPrinterAdapter(),
        PrinterKind.btClassic ||
        PrinterKind.ble ||
        PrinterKind.usb =>
          PlatformPrinterAdapter(kind),
      };

  /// Transport yang paling masuk akal untuk perangkat ini.
  ///
  /// **Printer internal handheld selalu menang.** Bila perangkatnya Sunmi atau
  /// iMin dan service AIDL-nya menjawab, tidak ada gunanya menyuruh kasir
  /// mem-*pairing* printer eksternal — printernya ada di dalam genggamannya.
  Future<PrinterKind> detectPreferred() async {
    if (await _isHandheldWithInnerPrinter()) return PrinterKind.sunmiInner;

    // Selain itu, BT Classic adalah tebakan terbaik: mayoritas printer termal
    // murah di pasar Indonesia memakai SPP ([05 §1.7.2]).
    return PrinterKind.btClassic;
  }

  Future<bool> _isHandheldWithInnerPrinter() async {
    try {
      final AndroidDeviceInfo info = await _deviceInfo.androidInfo;
      final String vendor = info.manufacturer.toLowerCase();

      final bool cocok =
          _handheldVendors.any((String v) => vendor.contains(v));
      if (!cocok) return false;

      // Nama vendor saja tidak cukup: sebagian model Sunmi adalah tablet meja
      // tanpa printer internal. Service AIDL yang menjawab adalah bukti
      // sesungguhnya.
      return adapterFor(PrinterKind.sunmiInner).isAvailable();
    } on Object {
      return false;
    }
  }

  /// Meminta izin Bluetooth runtime.
  ///
  /// > ⚠️ **Android 12+ (API 31) mengubah aturannya.** `BLUETOOTH_CONNECT` dan
  /// > `BLUETOOTH_SCAN` wajib diminta saat runtime; tanpa itu adapter gagal
  /// > dengan `SecurityException` yang pesannya sama sekali tidak menunjuk ke
  /// > izin ([09 §4.6]). Pada Android ≤ 11, yang diperlukan justru izin
  /// > **lokasi** — sisa desain lama ketika pemindaian BLE dianggap dapat
  /// > menurunkan posisi pengguna.
  ///
  /// Dipanggil **sebelum operasi printer pertama**, bukan saat aplikasi start:
  /// dialog izin yang muncul di layar pembuka tanpa konteks hampir selalu
  /// ditolak.
  Future<bool> ensureBluetoothPermissions() async {
    try {
      final AndroidDeviceInfo info = await _deviceInfo.androidInfo;

      if (info.version.sdkInt >= 31) {
        final Map<Permission, PermissionStatus> hasil = await <Permission>[
          Permission.bluetoothConnect,
          Permission.bluetoothScan,
        ].request();
        return hasil.values.every((PermissionStatus s) => s.isGranted);
      }

      return (await Permission.location.request()).isGranted;
    } on Object {
      return false;
    }
  }
}
