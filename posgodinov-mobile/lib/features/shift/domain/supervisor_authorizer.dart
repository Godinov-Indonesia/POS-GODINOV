import 'dart:convert';

import 'package:posgodinov_mobile/core/crypto/pin_verifier.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/master_dao.dart';

/// Hasil pemeriksaan wewenang supervisor.
enum SupervisorDenial {
  /// ID tidak ditemukan **atau** PIN salah — sengaja tidak dibedakan.
  badCredentials,

  /// Kredensialnya benar, tetapi akunnya tidak berwenang.
  notAuthorized,
}

/// Putusan otorisasi.
class SupervisorVerdict {
  const SupervisorVerdict.granted(this.staffId, this.staffName)
      : denial = null;

  const SupervisorVerdict.denied(this.denial)
      : staffId = '',
        staffName = '';

  final String staffId;
  final String staffName;
  final SupervisorDenial? denial;

  bool get ok => denial == null;

  String get message => switch (denial) {
        null => '',
        SupervisorDenial.badCredentials => 'ID atau PIN salah.',
        SupervisorDenial.notAuthorized =>
          'Akun ini tidak berwenang menutup paksa shift.',
      };
}

/// Otorisasi supervisor untuk Force Close Shift ([11 §M15.2]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// DIPUTUSKAN OFFLINE, DAN ITU KEHARUSAN
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Peran dan izin ikut turun bersama master data ([11 §4.4]) justru supaya
/// keputusan ini tidak memerlukan jaringan. Force Close dibutuhkan tepat ketika
/// ada yang tidak beres — kasir pulang tanpa menutup shift, perangkat terkunci
/// pagi berikutnya — dan keadaan semacam itu tidak menunggu sinyal membaik.
class SupervisorAuthorizer {
  const SupervisorAuthorizer({
    required MasterDao masterDao,
    required PinVerifier verifier,
  })  : _masterDao = masterDao,
        _verifier = verifier;

  final MasterDao _masterDao;
  final PinVerifier _verifier;

  /// Peran yang berwenang melakukan Force Close.
  ///
  /// Kasir sengaja TIDAK ada di daftar ini. Jalur darurat yang dapat dipakai
  /// pemiliknya sendiri bukan jalur darurat — ia hanya tombol "tutup paksa"
  /// yang kebetulan bernama lain, dan seluruh Blind Closing dapat dilewati
  /// dengannya.
  static const Set<String> forceCloseRoles = <String>{
    'OWNER',
    'SUPERVISOR',
    'ADMIN',
  };

  /// Izin granular yang setara, bila pemilik memakai peran khusus.
  static const String forceClosePermission = 'SHIFT_FORCE_CLOSE';

  /// Memverifikasi identitas lalu kewenangan.
  ///
  /// Urutannya disengaja: PIN diperiksa **sebelum** kewenangan. Membalikkannya
  /// akan membocorkan peran seseorang kepada siapa pun yang mengetahui ID-nya —
  /// "PIN salah" versus "bukan supervisor" adalah dua jawaban berbeda, dan
  /// perbedaannya cukup untuk memetakan siapa yang berwenang di outlet ini.
  Future<SupervisorVerdict> authorize({
    required String staffIdentifier,
    required String pin,
  }) async {
    final Staff? staff =
        await _masterDao.findByIdentifier(staffIdentifier.trim());

    // bcrypt DIJALANKAN walau staff tidak ditemukan — pola yang sama dengan
    // login kasir, dan alasannya sama: selisih waktu jawaban cukup untuk
    // menebak identifier mana yang sah ([09 §5.3]).
    final bool cocok = await _verifier.verify(pin: pin, pinHash: staff?.pinHash);
    if (!cocok || staff == null) {
      return const SupervisorVerdict.denied(SupervisorDenial.badCredentials);
    }

    if (!canForceClose(staff)) {
      return const SupervisorVerdict.denied(SupervisorDenial.notAuthorized);
    }

    return SupervisorVerdict.granted(staff.id, staff.name);
  }

  /// Apakah [staff] berwenang menutup paksa shift.
  ///
  /// Perangkat yang master datanya berasal dari server pra-v2 tidak memiliki
  /// `role` sama sekali. Kasus itu DITOLAK, bukan diloloskan: jalur darurat
  /// yang terbuka untuk semua orang pada perangkat yang kebetulan belum
  /// diperbarui adalah pintu belakang, bukan kompatibilitas.
  static bool canForceClose(Staff staff) {
    if (forceCloseRoles.contains(staff.role.toUpperCase())) return true;

    try {
      final Object? decoded = jsonDecode(staff.permissionsJson);
      if (decoded is List<Object?>) {
        return decoded.contains(forceClosePermission);
      }
    } on FormatException {
      // JSON izin yang rusak diperlakukan sebagai TIDAK punya izin. Keliru ke
      // arah menolak adalah satu-satunya arah yang aman di sini.
    }
    return false;
  }
}
