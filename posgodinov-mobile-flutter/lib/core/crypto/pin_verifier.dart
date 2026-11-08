import 'package:bcrypt/bcrypt.dart';
import 'package:flutter/foundation.dart';

/// Muatan yang dikirim ke isolate. Harus sederhana agar dapat diserialisasi.
@immutable
class PinComparePayload {
  const PinComparePayload(this.pin, this.hash);

  final String pin;
  final String hash;
}

/// **WAJIB top-level (atau static).**
///
/// `compute` mengirim *referensi fungsi* ke isolate baru; closure dan method
/// instance tidak dapat dikirim melewati batas isolate.
bool comparePinIsolate(PinComparePayload payload) =>
    BCrypt.checkpw(payload.pin, payload.hash);

/// Memverifikasi PIN kasir terhadap `pin_hash` bcrypt dari master data.
///
/// ## Mengapa isolate
///
/// `BCrypt.checkpw` bersifat CPU-bound: 100–300 ms pada tablet kelas menengah,
/// hingga ~600 ms pada handheld kelas bawah. Dijalankan di isolate utama, UI
/// membeku persis pada momen kasir menekan "Masuk" — gejala yang akan dilaporkan
/// sebagai "aplikasi hang" ([09 §5.3], setara ADR-08 di Web).
///
/// ## Mengapa hash umpan
///
/// Backend **tidak memiliki endpoint login kasir** ([01 §4.5]); verifikasi di
/// perangkat inilah satu-satunya gerbang. Bila `staff_identifier` tidak
/// ditemukan dan kita langsung mengembalikan `null`, respons datang dalam
/// hitungan mikrodetik — sementara identifier yang benar memakan ratusan
/// milidetik. Selisih itu cukup untuk menebak identifier mana yang sah.
///
/// Karena itu bcrypt **tetap dijalankan** terhadap hash umpan, dan pesan
/// kegagalan disamakan: *"ID atau PIN salah"*.
class PinVerifier {
  const PinVerifier();

  /// Hash bcrypt bernilai tidak berguna, dengan *cost* 10 — sama seperti
  /// `bcrypt.DefaultCost` yang dipakai backend ([01 §2]).
  ///
  /// Nilainya tidak pernah cocok dengan PIN mana pun; satu-satunya gunanya
  /// adalah menghabiskan waktu yang setara.
  static const String decoyHash =
      r'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

  /// Membandingkan [pin] terhadap [pinHash].
  ///
  /// [pinHash] `null` berarti staff tidak ditemukan — perbandingan tetap
  /// dijalankan memakai [decoyHash], dan hasilnya selalu `false`.
  Future<bool> verify({required String pin, required String? pinHash}) async {
    final bool cocok = await compute(
      comparePinIsolate,
      PinComparePayload(pin, pinHash ?? decoyHash),
      debugLabel: 'bcrypt-pin-compare',
    );

    // Walau hash umpan secara teori bisa saja cocok, kembalikan false secara
    // eksplisit bila staff tidak ada.
    return cocok && pinHash != null;
  }
}
