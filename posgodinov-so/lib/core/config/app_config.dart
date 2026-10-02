class AppConfig {
  static const String defaultBaseUrl = 'http://localhost:8080';
  static const String storageKeyBaseUrl = 'posgodinov_so_base_url';

  static String baseUrl = const String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: defaultBaseUrl,
  );
}
