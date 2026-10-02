import 'package:dio/dio.dart';
import '../config/app_config.dart';
import '../storage/token_storage.dart';

class ApiClient {
  final Dio dio;
  final TokenStorage tokenStorage;

  ApiClient({
    Dio? customDio,
    required this.tokenStorage,
  }) : dio = customDio ??
            Dio(
              BaseOptions(
                baseUrl: AppConfig.baseUrl,
                connectTimeout: const Duration(seconds: 15),
                receiveTimeout: const Duration(seconds: 15),
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
              ),
            ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await tokenStorage.getDeviceToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          final staffId = await tokenStorage.getActiveStaffId();
          if (staffId != null && staffId.isNotEmpty) {
            options.headers['X-Staff-Id'] = staffId;
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) {
          // ponytail: pass-through error handler, add refresh token interceptor when refresh is supported
          return handler.next(error);
        },
      ),
    );
  }

  /// Bind device to outlet with OPNAME scope
  Future<Map<String, dynamic>> bindDevice({
    required String serialBusiness,
    required String serialOutlet,
    required String password,
  }) async {
    final response = await dio.post(
      '/v1/auth/device/bind',
      data: {
        'serial_business': serialBusiness,
        'serial_outlet': serialOutlet,
        'password': password,
        'scope': 'OPNAME',
      },
    );
    return response.data as Map<String, dynamic>;
  }

  /// Fetch all active staff for this device's outlet
  Future<List<dynamic>> getStaffData() async {
    final response = await dio.get('/v1/so/sync/staff-data');
    final data = response.data;
    if (data is Map<String, dynamic>) {
      final d = data['data'];
      if (d is Map<String, dynamic> && d['staffs'] is List) {
        return d['staffs'] as List<dynamic>;
      }
    }
    return [];
  }

  /// List active opname forms for this device's outlet (PUBLISHED or COUNTING)
  Future<List<dynamic>> getAvailableSessions() async {
    final response = await dio.get('/v1/so/available');
    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is List) {
      return data['data'] as List<dynamic>;
    }
    return [];
  }

  /// Get form detail and materials for counting (blind counting: no system_stock)
  Future<Map<String, dynamic>> getFormForCounting(String formId) async {
    final response = await dio.get('/v1/so/$formId');
    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is Map<String, dynamic>) {
      return data['data'] as Map<String, dynamic>;
    }
    return {};
  }

  /// Submit staff's count entries
  Future<void> submitCounts({
    required String formId,
    required List<Map<String, dynamic>> items,
  }) async {
    await dio.put(
      '/v1/so/$formId/counts',
      data: {'items': items},
    );
  }

  /// Get summary of counts submitted by the active staff
  Future<Map<String, dynamic>> getMyCounts(String formId) async {
    final response = await dio.get('/v1/so/$formId/my-counts');
    final data = response.data;
    if (data is Map<String, dynamic> && data['data'] is Map<String, dynamic>) {
      return data['data'] as Map<String, dynamic>;
    }
    return {};
  }
}
