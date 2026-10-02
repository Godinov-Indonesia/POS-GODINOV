class AppConfig {
  /// Hardcoded static base URL for server API.
  /// Dapat dioverride saat build via --dart-define=API_BASE_URL=... jika diperlukan.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:8080',
  );
}
