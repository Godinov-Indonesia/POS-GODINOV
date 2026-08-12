import 'dart:async';

import 'package:dio/dio.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/core/storage/secure_storage_service.dart';

/// Keadaan penerimaan perangkat oleh server.
enum DeviceStatus {
  /// Token ada dan server masih menerimanya.
  accepted,

  /// Server menjawab `401` — perangkat harus di-*binding* ulang teknisi.
  rejected,
}

/// Menyisipkan `Authorization: Bearer <device_token>` dan menangani penolakan
/// perangkat.
///
/// ## Dua perilaku yang mudah salah
///
/// 1. **Endpoint `/v1/auth/*` tidak boleh dibubuhi header.** `POST
///    /v1/auth/device/bind` adalah endpoint publik yang justru dipakai untuk
///    *memperoleh* token ([03 §2.1]); mengirim token lama ke sana tidak berguna
///    dan menyesatkan saat menelusuri log.
///
/// 2. **`401` bukan error jaringan yang dapat dicoba ulang.** Device token tidak
///    memiliki mekanisme refresh — tidak ada endpoint *unbind*, tidak ada
///    rotasi ([03 §2.1]). Mencoba ulang selamanya hanya membakar baterai.
///    Perangkat harus dipasang ulang, dan **antrean lokal tidak boleh dihapus**
///    ([09 §5.2]).
class DeviceTokenInterceptor extends Interceptor {
  DeviceTokenInterceptor(this._storage);

  final SecureStorageService _storage;

  final StreamController<DeviceStatus> _statusController =
      StreamController<DeviceStatus>.broadcast();

  /// Diamati `bootstrap.dart` untuk memaksa kembali ke layar P-01 saat
  /// perangkat ditolak.
  Stream<DeviceStatus> get status => _statusController.stream;

  /// Prefiks yang tidak boleh menerima header otorisasi.
  static const String _publicPrefix = '/v1/auth/';

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.path.startsWith(_publicPrefix)) {
      handler.next(options);
      return;
    }

    final String? token = await _storage.readDeviceToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    // Backend TIDAK membaca `X-Tenant-ID` ([03 §0]) — konteks tenant sepenuhnya
    // diturunkan dari token. Jangan menambahkannya "untuk berjaga-jaga".
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final bool isPublic = err.requestOptions.path.startsWith(_publicPrefix);

    // `401` pada endpoint bind berarti kredensial pemasangan salah — itu
    // kegagalan bisnis biasa, bukan penolakan perangkat. Biarkan
    // ErrorInterceptor memetakannya dengan pesan server apa adanya.
    if (err.response?.statusCode == 401 && !isPublic) {
      _statusController.add(DeviceStatus.rejected);

      handler.reject(
        DioException(
          requestOptions: err.requestOptions,
          response: err.response,
          type: err.type,
          error: const DeviceRejectedFailure(),
        ),
      );
      return;
    }

    handler.next(err);
  }

  /// Menutup stream status. Dipanggil saat DI dibongkar — termasuk di isolate
  /// WorkManager yang membangun ulang seluruh dependensi ([09 §6.4]).
  Future<void> dispose() => _statusController.close();
}
