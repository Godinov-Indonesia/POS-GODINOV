import 'dart:io' show HttpDate;

import 'package:dio/dio.dart';
import 'package:posgodinov_mobile/core/network/clock_skew_monitor.dart';

/// Membaca header `Date` setiap respons dan menyerahkannya ke
/// [ClockSkewMonitor].
///
/// Header `Date` bersifat wajib pada respons HTTP (RFC 9110 §6.6.1) dan dikirim
/// `net/http` Go tanpa perlu konfigurasi apa pun di backend — jadi tidak ada
/// endpoint khusus yang perlu ditambahkan hanya untuk menyelaraskan waktu.
///
/// **Dijalankan juga pada respons error.** Jam yang melenceng justru sering
/// terungkap saat sinkronisasi gagal, dan respons `4xx`/`5xx` tetap membawa
/// header `Date` yang sah.
///
/// > Presisi pengukuran ini kasar: header `Date` hanya berpresisi detik dan
/// > tidak memperhitungkan *round-trip time*. Itu memadai — ambangnya 5 menit
/// > (`SyncLimits.clockSkewThreshold`), bukan 5 detik. Interceptor ini **tidak
/// > pernah** dipakai untuk mengoreksi waktu, hanya untuk memperingatkan
/// > ([05 §1.8.2]).
class ClockSkewInterceptor extends Interceptor {
  ClockSkewInterceptor(this._monitor, {DateTime Function()? now})
      : _now = now ?? _defaultNow;

  final ClockSkewMonitor _monitor;

  /// Dapat disuntik pada pengujian untuk membekukan jam perangkat.
  final DateTime Function() _now;

  static DateTime _defaultNow() => DateTime.now().toUtc();

  static const String _dateHeader = 'date';

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    _measure(response.headers);
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final Headers? headers = err.response?.headers;
    if (headers != null) _measure(headers);
    handler.next(err);
  }

  void _measure(Headers headers) {
    final String? raw = headers.value(_dateHeader);
    if (raw == null || raw.isEmpty) return;

    final DateTime? serverUtc = parseHttpDate(raw);
    if (serverUtc == null) return;

    _monitor.record(serverUtc: serverUtc, deviceUtc: _now());
  }

  /// Mengurai tanggal HTTP, mis. `Wed, 12 Aug 2026 03:22:11 GMT`.
  ///
  /// [HttpDate.parse] menerima ketiga format tanggal HTTP yang sah (IMF-fixdate,
  /// RFC 850, asctime). Bila gagal — sebagian proxy dan CDN mengirim ISO-8601 —
  /// dicoba sekali lagi lewat [DateTime.tryParse].
  ///
  /// Mengembalikan `null` bila keduanya gagal. Kegagalan mengurai **diabaikan
  /// diam-diam**: header tanggal yang aneh tidak boleh menggagalkan permintaan
  /// yang isinya sendiri sudah sah.
  static DateTime? parseHttpDate(String raw) {
    try {
      return HttpDate.parse(raw).toUtc();
    } on Exception {
      return DateTime.tryParse(raw)?.toUtc();
    }
  }
}
