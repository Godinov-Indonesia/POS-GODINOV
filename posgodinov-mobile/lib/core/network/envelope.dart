import 'package:dio/dio.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';

/// Pembongkar amplop respons backend — **titik penegakan tunggal**.
///
/// Backend memakai dua bentuk respons ([03 §0]). Seluruh endpoint `/v1/pos/*`
/// dan `POST /v1/auth/device/bind` memakai **Bentuk A**:
///
/// ```json
/// { "status": "success", "message": "…", "data": { } }
/// ```
///
/// Bentuk B (tanpa amplop) hanya dipakai tiga endpoint auth Business yang
/// **tidak pernah disentuh aplikasi ini** — perangkat POS hanya memegang device
/// token, tidak pernah access token ([03 §0]).
///
/// ## Mengapa `list()` wajib dipakai
///
/// Service backend membangun slice dengan `append` ke variabel `nil`. Bila
/// outlet belum punya produk, JSON yang dikirim adalah `"products": null`,
/// **bukan** `[]` ([03 §2.2]). Koleksi yang datang langsung dari GORM
/// mengembalikan `[]`. Perbedaan ini **tidak konsisten dan tidak dijamin**,
/// sehingga tidak ada gunanya menghafal endpoint mana yang aman.
///
/// Terlewat satu saja menghasilkan `type 'Null' is not a subtype of type 'List'`
/// — di outlet, bukan di lab. Karena itu **tidak ada pemanggil yang boleh
/// melakukan `as List` langsung** ([09 §9.1]).
abstract final class Envelope {
  static const String _statusSuccess = 'success';

  /// Membongkar amplop dan mengembalikan isi `data` mentah.
  ///
  /// Melempar [ApiFailure] bila `status` bukan `success`, dan [ContractFailure]
  /// bila bentuk respons tidak dikenali.
  static Object? unwrap(Response<dynamic> response) {
    final Object? body = response.data;

    if (body is! Map<String, dynamic>) {
      throw const ContractFailure(
        'Format respons server tidak dikenali. Perbarui aplikasi atau hubungi '
        'teknisi.',
      );
    }

    final Object? status = body['status'];
    if (status != _statusSuccess) {
      throw ApiFailure(
        messageOf(body) ?? 'Permintaan gagal diproses server.',
        statusCode: response.statusCode,
      );
    }

    return body['data'];
  }

  /// Membongkar amplop yang `data`-nya berupa objek.
  ///
  /// Dipakai `POST /v1/auth/device/bind` dan `GET /v1/pos/sync/master-data`.
  static T data<T>(
    Response<dynamic> response,
    T Function(Map<String, dynamic> json) fromJson,
  ) {
    final Object? data = unwrap(response);

    if (data is! Map<String, dynamic>) {
      throw const ContractFailure(
        'Isi respons server tidak sesuai kontrak (objek diharapkan).',
      );
    }
    return fromJson(data);
  }

  /// Membongkar amplop yang `data`-nya berupa **koleksi**.
  ///
  /// Dipakai `GET /v1/pos/transactions`. `null` menjadi `[]` — lihat catatan
  /// kelas.
  static List<T> dataList<T>(
    Response<dynamic> response,
    T Function(Map<String, dynamic> json) fromJson,
  ) {
    return list<T>(unwrap(response), fromJson);
  }

  /// Menormalkan **koleksi apa pun** menjadi `List<T>`, termasuk `null` → `[]`.
  ///
  /// Dipakai untuk array bersarang di dalam `data`, mis. `staffs`, `categories`,
  /// dan `products` pada master data — ketiganya bisa `null` secara independen
  /// ([03 §2.2]).
  ///
  /// ```dart
  /// final staffs = Envelope.list(json['staffs'], StaffDto.fromJson);
  /// ```
  static List<T> list<T>(
    Object? raw,
    T Function(Map<String, dynamic> json) fromJson,
  ) {
    // Inilah satu-satunya tempat `null` koleksi dinetralkan.
    if (raw == null) return <T>[];

    if (raw is! List<dynamic>) {
      throw const ContractFailure(
        'Isi respons server tidak sesuai kontrak (koleksi diharapkan).',
      );
    }

    final List<T> result = <T>[];
    for (final Object? element in raw) {
      if (element is! Map<String, dynamic>) {
        throw const ContractFailure(
          'Salah satu baris koleksi bukan objek JSON yang sah.',
        );
      }
      result.add(fromJson(element));
    }
    return result;
  }

  /// Mengambil `message` dari body respons, apa pun bentuknya.
  ///
  /// Pesan backend **sudah berbahasa Indonesia dan layak ditampilkan apa
  /// adanya** ([03 §0]) — jangan diterjemahkan ulang, jangan diganti kalimat
  /// generik.
  static String? messageOf(Object? body) {
    if (body is! Map<String, dynamic>) return null;

    final Object? message = body['message'];
    if (message is String && message.trim().isNotEmpty) return message;

    // Bentuk error menyertakan detail di `errors`, dengan kunci yang bervariasi:
    // server, password, credentials, token, rate_limit, error ([03 §0]).
    final Object? errors = body['errors'];
    if (errors is Map<String, dynamic>) {
      for (final Object? value in errors.values) {
        if (value is String && value.trim().isNotEmpty) return value;
      }
    }
    return null;
  }
}
