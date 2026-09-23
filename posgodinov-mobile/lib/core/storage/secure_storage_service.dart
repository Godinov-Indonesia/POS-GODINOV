import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Penyimpanan rahasia berbasis **Android KeyStore**.
///
/// Dua rahasia hidup di sini, dan **hanya** di sini ([09 §5.2]):
///
/// 1. `device_token` — PASETO v4 berumur ~10 tahun yang **tidak dapat dicabut**
///    ([03 §2.1]). Tidak ada endpoint *unbind*, tidak ada daftar perangkat.
///    Menyimpannya di `SharedPreferences` polos atau di tabel Drift berarti
///    menyerahkan akses sinkronisasi permanen kepada siapa pun yang membaca
///    berkas aplikasi.
/// 2. `db_encryption_key` — kunci 32 byte untuk SQLCipher. Sudah disiapkan
///    walau enkripsi basis data masih menunggu keputusan tim ([09 §1.4]);
///    mengaktifkannya kelak cukup menukar satu baris di `openDatabase()`.
class SecureStorageService {
  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage(
          aOptions: AndroidOptions(
            encryptedSharedPreferences: true,
            // JANGAN hapus diam-diam saat gagal baca. Nilai `true` akan
            // membuang device_token yang TIDAK DAPAT dipulihkan tanpa
            // kunjungan teknisi ke outlet.
            resetOnError: false,
          ),
        );

  final FlutterSecureStorage _storage;

  static const String keyDeviceToken = 'device_token';
  static const String keyDatabaseKey = 'db_encryption_key';

  /// Panjang kunci SQLCipher dalam byte.
  static const int _databaseKeyBytes = 32;

  // ── device_token ───────────────────────────────────────────────────────────

  /// Menyimpan device token hasil `POST /v1/auth/device/bind` ([03 §2.1]).
  Future<void> saveDeviceToken(String token) =>
      _storage.write(key: keyDeviceToken, value: token);

  /// Membaca device token. `null` berarti perangkat belum pernah di-*binding* —
  /// gerbang navigasi mengarahkan ke P-01 ([09 §8]).
  Future<String?> readDeviceToken() => _storage.read(key: keyDeviceToken);

  /// `true` bila perangkat sudah terikat ke sebuah outlet.
  Future<bool> hasDeviceToken() async {
    final String? token = await readDeviceToken();
    return token != null && token.isNotEmpty;
  }

  /// Menghapus device token.
  ///
  /// Dipanggil **hanya** saat server menolak token (`401`) atau saat teknisi
  /// memasang ulang perangkat.
  ///
  /// > ⚠️ Menghapus token **tidak** menghapus basis data lokal. Antrean
  /// > penjualan harus selamat sampai *binding* ulang selesai — itulah alasan
  /// > operasi ini dipisahkan dari pembersihan data ([09 §5.2]).
  Future<void> clearDeviceToken() => _storage.delete(key: keyDeviceToken);

  // ── kunci enkripsi basis data ──────────────────────────────────────────────

  /// Mengembalikan kunci enkripsi basis data, membuatnya bila belum ada.
  ///
  /// Kunci dibuat **sekali seumur pemasangan** dengan [Random.secure] lalu hidup
  /// di KeyStore. Hilangnya kunci ini membuat basis data terenkripsi tidak dapat
  /// dibuka kembali — termasuk seluruh antrean penjualan yang belum tersinkron.
  Future<String> getOrCreateDatabaseKey() async {
    final String? existing = await _storage.read(key: keyDatabaseKey);
    if (existing != null && existing.isNotEmpty) return existing;

    final Random random = Random.secure();
    final List<int> bytes = List<int>.generate(
      _databaseKeyBytes,
      (_) => random.nextInt(256),
    );
    final String key = base64UrlEncode(bytes);

    await _storage.write(key: keyDatabaseKey, value: key);
    return key;
  }

  // ── pemeliharaan ───────────────────────────────────────────────────────────

  /// Menghapus **seluruh** rahasia, termasuk kunci basis data.
  ///
  /// > 🔴 Operasi merusak. Setelah ini, basis data terenkripsi tidak dapat
  /// > dibuka lagi. Hanya untuk *factory reset* perangkat yang dilakukan
  /// > teknisi, **bukan** untuk logout kasir dan **bukan** untuk penanganan
  /// > `401`.
  Future<void> wipeAll() => _storage.deleteAll();
}
