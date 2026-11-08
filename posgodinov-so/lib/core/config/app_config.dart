class AppConfig {
  static const String _rawBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api-pos.godinov.web.id',
  );

  /// Base URL API tanpa garis miring di akhir.
  /// Bawaan mengarah ke produksi (`https://api-pos.godinov.web.id`), dan dapat
  /// diubah secara dinamis saat build/run via `--dart-define=API_BASE_URL=...`.
  static String get baseUrl =>
      _rawBaseUrl.endsWith('/')
          ? _rawBaseUrl.substring(0, _rawBaseUrl.length - 1)
          : _rawBaseUrl;
}
