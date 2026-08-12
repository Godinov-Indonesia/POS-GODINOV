/// Konfigurasi runtime per-flavor.
///
/// **Prasyarat M1** yang ditarik maju ke M2 karena `ApiClient` membutuhkan
/// `baseUrl` dan batas waktu.
///
/// Nilai dibaca dari `--dart-define` saat build, bukan dari berkas `.env`:
/// perangkat kasir dipasang teknisi dan tidak pernah punya berkas konfigurasi
/// yang dapat diedit di lapangan.
///
/// ```bash
/// flutter build apk --release \
///   --dart-define=API_BASE_URL=https://api.godinov.id \
///   --dart-define=APP_FLAVOR=prod
/// ```
library;

enum AppFlavor {
  dev,
  staging,
  prod;

  static AppFlavor parse(String raw) {
    return AppFlavor.values.firstWhere(
      (AppFlavor f) => f.name == raw.toLowerCase(),
      orElse: () => AppFlavor.dev,
    );
  }
}

class AppConfig {
  const AppConfig({
    required this.flavor,
    required this.baseUrl,
    this.connectTimeout = const Duration(seconds: 15),
    this.receiveTimeout = const Duration(seconds: 30),
    this.sendTimeout = const Duration(seconds: 30),
  });

  /// Membaca konfigurasi dari `--dart-define`.
  ///
  /// Default `10.0.2.2` adalah alias emulator Android untuk `localhost` mesin
  /// pengembang ([03 §0] menyebut `http://localhost:8080` untuk lokal).
  ///
  /// > ⚠️ `http://` polos ditolak Android 9+ kecuali diizinkan lewat
  /// > `network_security_config.xml`. Izinkan **hanya** untuk flavor dev; build
  /// > produksi wajib HTTPS.
  factory AppConfig.fromEnvironment() {
    const String flavorRaw = String.fromEnvironment(
      'APP_FLAVOR',
      defaultValue: 'dev',
    );
    const String baseUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://10.0.2.2:8080',
    );

    return AppConfig(
      flavor: AppFlavor.parse(flavorRaw),
      baseUrl: baseUrl,
    );
  }

  final AppFlavor flavor;

  /// Tanpa garis miring di akhir; seluruh path endpoint diawali `/v1/…`.
  final String baseUrl;

  final Duration connectTimeout;

  /// Lebih longgar daripada connect: `GET /v1/pos/sync/master-data` menarik
  /// **seluruh** katalog outlet tanpa paginasi maupun sinkronisasi inkremental
  /// ([03 §2.2]), dan `POST /v1/pos/sync` dapat membawa 200 transaksi sekaligus.
  final Duration receiveTimeout;

  final Duration sendTimeout;

  bool get isProduction => flavor == AppFlavor.prod;

  /// Log jaringan hanya dinyalakan di luar produksi — lihat peringatan
  /// kebocoran token di `ApiClient`.
  bool get enableNetworkLogging => flavor != AppFlavor.prod;
}
