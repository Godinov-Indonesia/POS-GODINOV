import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:posgodinov_mobile/core/config/app_config.dart';
import 'package:posgodinov_mobile/core/network/clock_skew_monitor.dart';
import 'package:posgodinov_mobile/core/network/interceptors/clock_skew_interceptor.dart';
import 'package:posgodinov_mobile/core/network/interceptors/device_token_interceptor.dart';
import 'package:posgodinov_mobile/core/network/interceptors/error_interceptor.dart';
import 'package:posgodinov_mobile/core/storage/secure_storage_service.dart';

/// Satu-satunya pintu keluar HTTP aplikasi.
///
/// Perangkat POS hanya pernah memegang **device token** — tidak ada access token
/// maupun refresh token di aplikasi ini ([03 §0]), sehingga tidak ada
/// `adminRequest()`/`posRequest()` terpisah seperti di Web.
class ApiClient {
  ApiClient({
    required AppConfig config,
    required SecureStorageService storage,
    required ClockSkewMonitor clockSkewMonitor,
    Dio? dio,
  })  : _config = config,
        deviceTokenInterceptor = DeviceTokenInterceptor(storage),
        dio = dio ?? Dio() {
    _configure(clockSkewMonitor);
  }

  final AppConfig _config;

  final Dio dio;

  /// Diekspos karena `bootstrap.dart` menyimak
  /// [DeviceTokenInterceptor.status] untuk memaksa kembali ke layar P-01 saat
  /// perangkat ditolak server.
  final DeviceTokenInterceptor deviceTokenInterceptor;

  void _configure(ClockSkewMonitor clockSkewMonitor) {
    dio.options = BaseOptions(
      baseUrl: _config.baseUrl,
      connectTimeout: _config.connectTimeout,
      receiveTimeout: _config.receiveTimeout,
      sendTimeout: _config.sendTimeout,
      contentType: Headers.jsonContentType,
      responseType: ResponseType.json,
      // Seluruh kode status diteruskan ke interceptor agar pemetaan pesan
      // terjadi di satu tempat. Tanpa ini, Dio melempar sebelum
      // ErrorInterceptor sempat membaca `response.message` ([03 §0]).
      validateStatus: (int? status) => status != null && status < 400,
      headers: const <String, String>{
        'Accept': 'application/json',
        // TIDAK ADA `X-Tenant-ID` — backend tidak membacanya sama sekali;
        // konteks tenant sepenuhnya diturunkan dari token ([03 §0]).
      },
    );

    // ── URUTAN INTERCEPTOR — bukan selera, melainkan perilaku ────────────────
    //
    // Dio memanggil interceptor sesuai urutan pendaftaran pada ketiga fase
    // (request, response, error).
    //
    // 1. DeviceToken  — menyisipkan `Bearer` sebelum siapa pun melihat request,
    //                   dan MENOLAK rantai pada `401` sehingga fase error
    //                   berhenti di sini dengan `DeviceRejectedFailure`.
    // 2. ClockSkew    — membaca header `Date`; harus berjalan sebelum
    //                   ErrorInterceptor supaya respons error pun terukur.
    // 3. Error        — menerjemahkan sisa `DioException` menjadi `Failure`.
    // 4. Log          — terakhir, agar mencatat request yang sudah final.
    dio.interceptors.addAll(<Interceptor>[
      deviceTokenInterceptor,
      ClockSkewInterceptor(clockSkewMonitor),
      ErrorInterceptor(),
      if (_config.enableNetworkLogging) _buildLogInterceptor(),
    ]);
  }

  /// Log jaringan untuk flavor non-produksi.
  ///
  /// > 🔴 **`requestHeader: false` bukan pilihan gaya.** Header `Authorization`
  /// > memuat device token PASETO yang berumur ~10 tahun dan **tidak dapat
  /// > dicabut** ([03 §2.1]). Menuliskannya ke logcat berarti menyebarkan
  /// > kredensial permanen outlet ke setiap aplikasi yang dapat membaca log,
  /// > dan ke setiap laporan bug yang menyertakan log.
  ///
  /// `debugPrint` dipakai alih-alih `print` karena ia menahan laju keluaran;
  /// logcat Android membuang baris yang datang terlalu cepat, dan justru
  /// respons besar seperti master data yang paling sering terpotong.
  Interceptor _buildLogInterceptor() {
    return LogInterceptor(
      request: true,
      requestHeader: false,
      requestBody: true,
      responseHeader: false,
      responseBody: true,
      error: true,
      logPrint: (Object object) => debugPrint(object.toString()),
    );
  }

  /// Menutup koneksi yang masih terbuka.
  void dispose() {
    dio.close(force: true);
  }
}
