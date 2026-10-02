import 'package:dio/dio.dart';

class ErrorFormatter {
  /// Mengembalikan pesan ramah pengguna tanpa membocorkan detail teknis,
  /// exception internals, atau stack trace ke layar.
  static String format(dynamic error, {String fallback = 'Terjadi kendala pada sistem. Silakan coba beberapa saat lagi.'}) {
    if (error == null) return fallback;

    if (error is DioException) {
      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return 'Koneksi ke server terputus (waktu habis). Pastikan koneksi internet stabil dan coba lagi.';

        case DioExceptionType.connectionError:
          return 'Tidak dapat terhubung ke server. Pastikan server aktif dan perangkat terhubung ke jaringan yang sama.';

        case DioExceptionType.badResponse:
          final resData = error.response?.data;
          if (resData is Map<String, dynamic> && resData['message'] != null) {
            final msg = resData['message'].toString().trim();
            if (msg.isNotEmpty) return msg;
          }
          final statusCode = error.response?.statusCode;
          if (statusCode == 401) {
            return 'Sesi autentikasi telah berakhir. Silakan login kembali.';
          } else if (statusCode == 403) {
            return 'Akses ditolak. Perangkat atau akun ini tidak memiliki izin.';
          } else if (statusCode == 404) {
            return 'Data yang diminta tidak ditemukan di server.';
          } else if (statusCode != null && statusCode >= 500) {
            return 'Server sedang mengalami gangguan sementara. Silakan coba lagi nanti.';
          }
          return fallback;

        case DioExceptionType.cancel:
          return 'Permintaan dibatalkan.';

        default:
          return 'Gagal menghubungi server. Periksa koneksi jaringan Anda.';
      }
    }

    final errStr = error.toString();
    // Bersihkan prefix Exception standar jika ada
    if (errStr.startsWith('Exception: ')) {
      final cleaned = errStr.substring(11).trim();
      if (cleaned.isNotEmpty && !cleaned.contains('SocketException') && !cleaned.contains('HttpException')) {
        return cleaned;
      }
    }

    if (errStr.contains('SocketException') || errStr.contains('Connection refused') || errStr.contains('Network is unreachable')) {
      return 'Tidak ada koneksi jaringan. Pastikan perangkat Anda terhubung ke Wi-Fi / data.';
    }

    return fallback;
  }
}
