import 'package:posgodinov_mobile/features/auth/domain/entities/cashier_session.dart';

/// Kontrak autentikasi kasir — **100% lokal**.
///
/// Backend tidak memiliki endpoint login kasir ([01 §4.5], [03 §14]); satu-satunya
/// gerbang adalah perbandingan bcrypt terhadap `pin_hash` yang ikut terunduh
/// bersama master data.
abstract interface class AuthRepository {
  /// Memverifikasi kredensial kasir.
  ///
  /// Mengembalikan `null` bila identifier tidak ditemukan **atau** PIN salah.
  /// Kedua kasus sengaja tidak dibedakan: pemanggil menampilkan pesan yang sama,
  /// dan durasi eksekusinya pun disamakan lewat hash umpan ([09 §5.3]).
  Future<CashierSession?> login({
    required String staffIdentifier,
    required String pin,
  });
}
