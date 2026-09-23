import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/core/network/interceptors/error_interceptor.dart';

final RequestOptions _options = RequestOptions(path: '/v1/pos/sync');

DioException _httpError(int status, {Object? body}) {
  return DioException(
    requestOptions: _options,
    type: DioExceptionType.badResponse,
    response: Response<dynamic>(
      requestOptions: _options,
      statusCode: status,
      data: body,
    ),
  );
}

Map<String, dynamic> _failBody(String message) => <String, dynamic>{
      'status': 'fail',
      'message': message,
    };

void main() {
  final ErrorInterceptor interceptor = ErrorInterceptor();

  group('Kegagalan bisnis — semuanya datang sebagai 400', () {
    // Backend TIDAK memakai kode status secara semantik ([03 §0]). Kasus yang
    // seharusnya 403 dan 404 sama-sama dikembalikan sebagai 400, sehingga satu-
    // satunya pembeda adalah `message`.
    test('400 menjadi ApiFailure dengan pesan server apa adanya', () {
      final Failure failure = interceptor.mapException(
        _httpError(400, body: _failBody('produk tidak ditemukan')),
      );

      expect(failure, isA<ApiFailure>());
      expect(failure.message, 'produk tidak ditemukan');
      expect(failure.isRetryable, isFalse);
    });

    test('akses lintas tenant tetap 400, bukan 403', () {
      final Failure failure = interceptor.mapException(
        _httpError(
          400,
          body: _failBody('akses ditolak: outlet ini bukan milik bisnis Anda'),
        ),
      );

      expect(failure, isA<ApiFailure>());
      expect(
        failure.message,
        'akses ditolak: outlet ini bukan milik bisnis Anda',
      );
    });

    test('pesan tidak diterjemahkan ulang menjadi kalimat generik', () {
      const String asli = 'Serial business, serial outlet, dan password wajib diisi';
      final Failure failure =
          interceptor.mapException(_httpError(400, body: _failBody(asli)));

      expect(failure.message, asli);
    });
  });

  group('Kode status lain', () {
    test('401 pada endpoint bind menjadi ApiFailure, bukan penolakan perangkat',
        () {
      // 401 pada /v1/pos/* sudah dicegat DeviceTokenInterceptor lebih dulu;
      // yang sampai ke sini hanya 401 dari device/bind — kredensial pemasangan
      // salah ([03 §2.1]).
      final Failure failure = interceptor.mapException(
        _httpError(401, body: _failBody('kredensial bisnis tidak valid')),
      );

      expect(failure, isA<ApiFailure>());
      expect(failure, isNot(isA<DeviceRejectedFailure>()));
    });

    test('429 menjadi RateLimitFailure dan layak dicoba ulang', () {
      final Failure failure = interceptor.mapException(
        _httpError(429, body: _failBody('terlalu banyak percobaan')),
      );

      expect(failure, isA<RateLimitFailure>());
      expect(failure.isRetryable, isTrue);
    });

    test('500 menjadi ServerFailure dan layak dicoba ulang', () {
      final Failure failure = interceptor.mapException(
        _httpError(500, body: _failBody('kegagalan internal')),
      );

      expect(failure, isA<ServerFailure>());
      expect(failure.isRetryable, isTrue);
    });

    test('body error tanpa message memakai kalimat cadangan', () {
      final Failure failure = interceptor.mapException(_httpError(500));

      expect(failure, isA<ServerFailure>());
      expect(failure.message, isNotEmpty);
    });
  });

  group('Kegagalan transport — antrean lokal harus tetap aman', () {
    test('connectionError menjadi NetworkFailure yang dapat dicoba ulang', () {
      final Failure failure = interceptor.mapException(
        DioException(
          requestOptions: _options,
          type: DioExceptionType.connectionError,
        ),
      );

      expect(failure, isA<NetworkFailure>());
      expect(failure.isRetryable, isTrue);
    });

    test('setiap jenis timeout menjadi NetworkFailure', () {
      const List<DioExceptionType> timeouts = <DioExceptionType>[
        DioExceptionType.connectionTimeout,
        DioExceptionType.sendTimeout,
        DioExceptionType.receiveTimeout,
      ];

      for (final DioExceptionType type in timeouts) {
        final Failure failure = interceptor.mapException(
          DioException(requestOptions: _options, type: type),
        );
        expect(failure, isA<NetworkFailure>(), reason: type.name);
        expect(failure.isRetryable, isTrue, reason: type.name);
      }
    });

    test('badResponse tanpa response sama sekali menjadi NetworkFailure', () {
      final Failure failure = interceptor.mapException(
        DioException(
          requestOptions: _options,
          type: DioExceptionType.badResponse,
        ),
      );

      expect(failure, isA<NetworkFailure>());
    });
  });

  group('Failure yang sudah dipetakan tidak ditimpa', () {
    test('DeviceRejectedFailure dari interceptor sebelumnya lolos utuh', () {
      // DeviceTokenInterceptor menolak rantai lebih dulu; pemeriksaan ini
      // adalah jaring pengaman bila urutan interceptor kelak berubah.
      final DioException err = DioException(
        requestOptions: _options,
        type: DioExceptionType.badResponse,
        error: const DeviceRejectedFailure(),
      );

      bool diteruskan = false;
      final ErrorInterceptorHandler handler = _SpyHandler(
        onNext: (DioException e) {
          diteruskan = true;
          expect(e.error, isA<DeviceRejectedFailure>());
        },
      );

      interceptor.onError(err, handler);
      expect(diteruskan, isTrue);
    });
  });
}

/// Handler tiruan yang hanya mencatat pemanggilan `next`.
class _SpyHandler extends ErrorInterceptorHandler {
  _SpyHandler({required this.onNext});

  final void Function(DioException) onNext;

  @override
  void next(DioException err) => onNext(err);
}
