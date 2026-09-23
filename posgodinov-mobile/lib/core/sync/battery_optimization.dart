import 'package:device_info_plus/device_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';

/// Pengecualian optimasi baterai — **penentu apakah M8 benar-benar bekerja di
/// lapangan**.
///
/// # Mengapa ini bukan detail kecil
///
/// WorkManager bekerja mulus di emulator dan pada Android murni. Yang terjadi
/// di outlet berbeda: Xiaomi (MIUI), Oppo/Realme (ColorOS), Vivo (FunTouch),
/// dan sebagian besar perangkat handheld POS membunuh proses latar aplikasi
/// yang tidak dikecualikan — kadang dalam hitungan menit setelah layar mati.
///
/// Gejalanya paling menyesatkan: sinkronisasi **berhasil di lab**, lalu diam
/// di outlet, dan tidak ada pesan error apa pun karena isolate-nya memang tidak
/// pernah dibangunkan ([09 §6.4]).
class BatteryOptimization {
  BatteryOptimization({DeviceInfoPlugin? deviceInfo})
      : _deviceInfo = deviceInfo ?? DeviceInfoPlugin();

  final DeviceInfoPlugin _deviceInfo;

  /// Pabrikan yang diketahui membunuh proses latar secara agresif.
  ///
  /// Daftar ini **bukan** untuk memblokir apa pun — hanya untuk menaikkan
  /// urgensi pesan yang ditampilkan ke teknisi saat pemasangan.
  static const List<String> aggressiveVendors = <String>[
    'xiaomi',
    'redmi',
    'poco',
    'oppo',
    'realme',
    'vivo',
    'oneplus',
    'huawei',
    'honor',
    'meizu',
    'sunmi',
    'imin',
  ];

  /// `true` bila aplikasi sudah dikecualikan dari optimasi baterai.
  Future<bool> get isIgnoring async {
    try {
      return await Permission.ignoreBatteryOptimizations.isGranted;
    } on Object {
      return false;
    }
  }

  /// Membuka dialog sistem untuk meminta pengecualian.
  ///
  /// Android menampilkan peringatan keras di dialog ini, jadi ia hanya layak
  /// dimunculkan dari layar Pengaturan dengan penjelasan — **bukan** saat
  /// aplikasi start.
  Future<bool> request() async {
    try {
      final PermissionStatus status =
          await Permission.ignoreBatteryOptimizations.request();
      return status.isGranted;
    } on Object {
      return false;
    }
  }

  /// `true` bila perangkat ini termasuk yang membunuh proses latar secara
  /// agresif — dipakai menaikkan nada peringatan di P-14.
  Future<bool> get needsExtraSteps async {
    try {
      final AndroidDeviceInfo info = await _deviceInfo.androidInfo;
      final String vendor = info.manufacturer.toLowerCase();
      return aggressiveVendors.any(vendor.contains);
    } on Object {
      return false;
    }
  }

  /// Nama pabrikan untuk ditampilkan pada instruksi.
  Future<String> get vendorName async {
    try {
      return (await _deviceInfo.androidInfo).manufacturer;
    } on Object {
      return 'perangkat ini';
    }
  }
}
