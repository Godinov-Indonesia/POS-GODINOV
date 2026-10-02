import 'package:get_it/get_it.dart';
import '../database/database.dart';
import '../network/api_client.dart';
import '../storage/token_storage.dart';

final getIt = GetIt.instance;

void setupDependencies() {
  // Storage
  final tokenStorage = TokenStorage();
  getIt.registerSingleton<TokenStorage>(tokenStorage);

  // Network
  final apiClient = ApiClient(tokenStorage: tokenStorage);
  getIt.registerSingleton<ApiClient>(apiClient);

  // Database
  final database = AppDatabase();
  getIt.registerSingleton<AppDatabase>(database);
}
