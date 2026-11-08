/// Hierarki kegagalan aplikasi.
///
/// Prasyarat M1 yang ditarik maju ke M2 karena interceptor Dio memetakan
/// `DioException` menjadi tipe-tipe di berkas ini ([09 §9.2]).
///
/// **Mengapa `message` selalu siap tampil.** Backend mengembalikan hampir
/// seluruh kegagalan bisnis sebagai `400` dengan pesan Bahasa Indonesia yang
/// sudah layak dibaca pengguna ([03 §0]). Frontend tidak boleh bercabang pada
/// `403`/`404` — keduanya tidak pernah muncul — dan tidak boleh mengarang ulang
/// kalimatnya.
library;

/// Akar seluruh kegagalan yang boleh mencapai lapisan presentation.
sealed class Failure implements Exception {
  const Failure(this.message);

  /// Pesan siap tampil ke pengguna, berbahasa Indonesia.
  final String message;

  /// Apakah operasi ini layak dicoba ulang secara otomatis oleh mesin sync.
  bool get isRetryable;

  @override
  String toString() => '$runtimeType: $message';
}

/// Kegagalan bisnis dari server — praktis selalu `400` ([03 §0]).
///
/// Pesan diteruskan **apa adanya** dari `response.message`; jangan diterjemahkan
/// ulang, jangan dipetakan ke kalimat generik.
final class ApiFailure extends Failure {
  const ApiFailure(super.message, {this.statusCode});

  final int? statusCode;

  @override
  bool get isRetryable => false;
}

/// Perangkat tidak lagi diterima server (`401` pada `/v1/pos/*`).
///
/// **Bukan** kegagalan jaringan biasa. Device token tidak memiliki mekanisme
/// refresh ([03 §2.1]) — tidak ada yang dapat dicoba ulang. Perangkat harus
/// di-*binding* ulang oleh teknisi, dan antrean lokal **tidak boleh dihapus**.
final class DeviceRejectedFailure extends Failure {
  const DeviceRejectedFailure([super.message = _defaultMessage]);

  static const String _defaultMessage =
      'Perangkat ditolak server. Hubungi teknisi untuk memasang ulang '
      'perangkat. Data penjualan Anda tetap tersimpan dan akan terkirim '
      'setelah pemasangan ulang.';

  @override
  bool get isRetryable => false;
}

/// Tidak dapat menjangkau server: offline, timeout, DNS, sertifikat.
///
/// Aman diabaikan pada aplikasi offline-first — antrean lokal tetap utuh.
final class NetworkFailure extends Failure {
  const NetworkFailure([super.message = _defaultMessage]);

  static const String _defaultMessage =
      'Tidak dapat terhubung ke server. Data tersimpan di perangkat dan akan '
      'dikirim otomatis saat koneksi kembali.';

  @override
  bool get isRetryable => true;
}

/// Kegagalan internal server (`5xx`). Layak dicoba ulang dengan backoff.
final class ServerFailure extends Failure {
  const ServerFailure(super.message, {this.statusCode});

  final int? statusCode;

  @override
  bool get isRetryable => true;
}

/// Batas laju terlampaui (`429`) — hanya pada endpoint register di backend saat
/// ini, tetapi dipetakan agar tidak tersamar sebagai kegagalan bisnis.
final class RateLimitFailure extends Failure {
  const RateLimitFailure(super.message);

  @override
  bool get isRetryable => true;
}

/// Kegagalan penyimpanan lokal: Drift, secure storage, atau berkas.
///
/// Ini yang paling berbahaya di aplikasi offline-first — tidak ada server yang
/// dapat dijadikan cadangan.
final class CacheFailure extends Failure {
  const CacheFailure(super.message);

  @override
  bool get isRetryable => false;
}

/// Respons server tidak sesuai kontrak: amplop rusak, tipe tidak terduga,
/// atau field wajib hilang ([03 §0]).
final class ContractFailure extends Failure {
  const ContractFailure(super.message);

  @override
  bool get isRetryable => false;
}
