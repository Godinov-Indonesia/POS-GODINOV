import 'package:dio/dio.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/core/network/envelope.dart';

/// Menerjemahkan [DioException] menjadi [Failure] yang siap ditampilkan.
///
/// ## Mengapa tidak ada percabangan `403`/`404`
///
/// Backend **tidak** memakai kode status HTTP secara semantik. Hampir seluruh
/// kegagalan pada layer service dikembalikan sebagai **`400`**, termasuk kasus
/// yang seharusnya `403` atau `404` ([03 §0]):
///
/// | Kondisi sesungguhnya | Kode yang dikembalikan |
/// |---|---|
/// | Outlet milik tenant lain (seharusnya `403`) | `400` |
/// | Produk tidak ditemukan (seharusnya `404`) | `400` |
///
/// Membuat percabangan pada `403`/`404` berarti menulis cabang yang **tidak
/// akan pernah dieksekusi**. Yang benar: ambil `response.message` dan tampilkan
/// apa adanya — seluruhnya sudah berbahasa Indonesia dan layak dibaca pengguna.
///
/// Interceptor ini dipasang **setelah** `DeviceTokenInterceptor`, sehingga
/// [DeviceRejectedFailure] yang sudah ditetapkan di sana diteruskan tanpa
/// ditimpa.
class ErrorInterceptor extends Interceptor {
  ErrorInterceptor();

  static const String _pesanTakTerhubung =
      'Tidak dapat terhubung ke server. Data tersimpan di perangkat dan akan '
      'dikirim otomatis saat koneksi kembali.';

  static const String _pesanTimeout =
      'Server tidak merespons tepat waktu. Data tetap aman di perangkat dan '
      'akan dikirim ulang otomatis.';

  static const String _pesanGagalDiproses = 'Permintaan gagal diproses server.';

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // Sudah dipetakan interceptor sebelumnya — jangan ditimpa.
    if (err.error is Failure) {
      handler.next(err);
      return;
    }

    final Failure failure = mapException(err);

    handler.next(
      DioException(
        requestOptions: err.requestOptions,
        response: err.response,
        type: err.type,
        error: failure,
        stackTrace: err.stackTrace,
      ),
    );
  }

  /// Memetakan [DioException] menjadi [Failure].
  ///
  /// Publik dengan sengaja: inilah seluruh logika kelas ini, dan mengujinya
  /// lewat `ErrorInterceptorHandler` tiruan jauh lebih rapuh daripada
  /// memanggilnya langsung.
  Failure mapException(DioException err) {
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const NetworkFailure(_pesanTimeout);

      case DioExceptionType.connectionError:
      case DioExceptionType.badCertificate:
        return const NetworkFailure(_pesanTakTerhubung);

      case DioExceptionType.cancel:
        return const NetworkFailure('Permintaan dibatalkan.');

      case DioExceptionType.badResponse:
      case DioExceptionType.unknown:
        return _mapStatus(err);
    }
  }

  Failure _mapStatus(DioException err) {
    final Response<dynamic>? response = err.response;
    if (response == null) return const NetworkFailure(_pesanTakTerhubung);

    // Pesan server DITERUSKAN APA ADANYA — jangan diterjemahkan ulang.
    final String message =
        Envelope.messageOf(response.data) ?? _pesanGagalDiproses;
    final int? code = response.statusCode;

    if (code == null) return NetworkFailure(message);

    // 400 menampung hampir seluruh kegagalan bisnis, termasuk yang semestinya
    // 403/404. Tidak ada cabang khusus untuk keduanya — keduanya tidak pernah
    // muncul ([03 §0]).
    if (code == 400) return ApiFailure(message, statusCode: code);

    // 401 pada endpoint POS sudah ditangani DeviceTokenInterceptor. Yang sampai
    // ke sini adalah 401 dari `/v1/auth/device/bind` — kredensial pemasangan
    // salah, atau serial outlet bukan milik bisnis tersebut ([03 §2.1]).
    if (code == 401) return ApiFailure(message, statusCode: code);

    if (code == 429) return RateLimitFailure(message);

    if (code >= 500) return ServerFailure(message, statusCode: code);

    return ApiFailure(message, statusCode: code);
  }
}
