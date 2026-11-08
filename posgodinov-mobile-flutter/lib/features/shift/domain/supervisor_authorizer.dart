import 'dart:convert';

import 'package:drift/drift.dart' show Value;
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/crypto/pin_verifier.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/master_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/security_event_dao.dart';
import 'package:uuid/uuid.dart';

/// Hasil pemeriksaan wewenang supervisor.
enum SupervisorDenial {
  /// ID tidak ditemukan **atau** PIN salah — sengaja tidak dibedakan.
  badCredentials,

  /// Kredensialnya benar, tetapi akunnya tidak berwenang.
  notAuthorized,

  /// Terlalu banyak percobaan gagal berturut-turut.
  lockedOut,
}

/// Putusan otorisasi.
class SupervisorVerdict {
  const SupervisorVerdict.granted(this.staffId, this.staffName) : denial = null;

  const SupervisorVerdict.denied(this.denial)
      : staffId = '',
        staffName = '';

  final String staffId;
  final String staffName;
  final SupervisorDenial? denial;

  bool get ok => denial == null;

  String get message => switch (denial) {
        null => '',
        SupervisorDenial.badCredentials => 'ID atau PIN supervisor salah.',
        SupervisorDenial.notAuthorized =>
          'Akun ini tidak memiliki wewenang supervisor untuk aksi ini.',
        SupervisorDenial.lockedOut =>
          'Terlalu banyak percobaan PIN salah. Coba lagi dalam 60 detik.',
      };
}

/// Otorisasi supervisor untuk Force Close Shift, Void, dan Retur ([11 §M15.2]).
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
  SupervisorAuthorizer({
    required MasterDao masterDao,
    required PinVerifier verifier,
    SecurityEventDao? securityEventDao,
    DateTime Function()? now,
  })  : _masterDao = masterDao,
        _verifier = verifier,
        _securityEvents = securityEventDao,
        _now = now ?? DateTime.now;

  final MasterDao _masterDao;
  final PinVerifier _verifier;
  final SecurityEventDao? _securityEvents;
  final DateTime Function() _now;

  static const int maxFailedAttempts = 5;
  static const Duration lockoutDuration = Duration(seconds: 60);

  int _failedAttempts = 0;
  DateTime? _lockedUntil;

  /// Peran yang berwenang melakukan Force Close / Void / Retur.
  ///
  /// Kasir sengaja TIDAK ada di daftar ini. Jalur darurat yang dapat dipakai
  /// pemiliknya sendiri bukan jalur darurat — ia hanya tombol "tutup paksa"
  /// yang kebetulan bernama lain, dan seluruh Blind Closing dapat dilewati
  /// dengannya.
  static const Set<String> forceCloseRoles = <String>{
    'OWNER',
    'SUPERVISOR',
    'MANAGER',
    'ADMIN',
  };

  /// Izin granular yang setara, bila pemilik memakai peran khusus.
  static const String forceClosePermission = 'SHIFT_FORCE_CLOSE';

  bool get _isLockedOut {
    final DateTime? until = _lockedUntil;
    if (until == null) return false;
    if (_now().isBefore(until)) return true;
    _lockedUntil = null;
    _failedAttempts = 0;
    return false;
  }

  Future<void> _recordFailure(String contextLabel) async {
    _failedAttempts++;
    if (_failedAttempts >= maxFailedAttempts) {
      _lockedUntil = _now().add(lockoutDuration);
      final SecurityEventDao? dao = _securityEvents;
      if (dao != null) {
        try {
          await dao.record(
            SecurityEventsCompanion.insert(
              id: const Uuid().v4(),
              eventType: SecurityEventType.pinFailedThreshold,
              severity: SecuritySeverity.warn,
              detailsJson: Value<String>(
                jsonEncode(<String, dynamic>{
                  'source': contextLabel,
                  'failed_attempts': _failedAttempts,
                }),
              ),
              clientCreatedAt: _now().toUtc(),
            ),
          );
        } on Object {
          // Kegagalan log audit tidak membatalkan penguncian brute-force.
        }
      }
    }
  }

  /// Memverifikasi identitas lalu kewenangan.
  ///
  /// Urutannya disengaja: PIN diperiksa **sebelum** kewenangan. Membalikkannya
  /// akan membocorkan peran seseorang kepada siapa pun yang mengetahui ID-nya —
  /// "PIN salah" versus "bukan supervisor" adalah dua jawaban berbeda, dan
  /// perbedaannya cukup untuk memetakan siapa yang berwenang di outlet ini.
  Future<SupervisorVerdict> authorize({
    required String staffIdentifier,
    required String pin,
    String requiredPermission = forceClosePermission,
  }) async {
    if (_isLockedOut) {
      return const SupervisorVerdict.denied(SupervisorDenial.lockedOut);
    }

    final Staff? staff =
        await _masterDao.findByIdentifier(staffIdentifier.trim());

    // bcrypt DIJALANKAN walau staff tidak ditemukan — pola yang sama dengan
    // login kasir, dan alasannya sama: selisih waktu jawaban cukup untuk
    // menebak identifier mana yang sah ([09 §5.3]).
    final bool cocok =
        await _verifier.verify(pin: pin, pinHash: staff?.pinHash);
    if (!cocok || staff == null) {
      await _recordFailure('supervisor_auth:$requiredPermission');
      return const SupervisorVerdict.denied(SupervisorDenial.badCredentials);
    }

    if (!hasAuthority(staff, requiredPermission)) {
      return const SupervisorVerdict.denied(SupervisorDenial.notAuthorized);
    }

    _failedAttempts = 0;
    _lockedUntil = null;
    return SupervisorVerdict.granted(staff.id, staff.name);
  }

  /// Memverifikasi PIN supervisor terhadap daftar staf yang berwenang.
  /// Bila [staffIdentifier] diisi, mencocokkan staf tersebut; bila kosong,
  /// mencocokkan terhadap seluruh staf berwenang di outlet.
  Future<SupervisorVerdict> authorizePin({
    required String pin,
    String staffIdentifier = '',
    String requiredPermission = 'VOID_APPROVE',
  }) async {
    if (staffIdentifier.trim().isNotEmpty) {
      return authorize(
        staffIdentifier: staffIdentifier,
        pin: pin,
        requiredPermission: requiredPermission,
      );
    }
    if (_isLockedOut) {
      return const SupervisorVerdict.denied(SupervisorDenial.lockedOut);
    }

    final List<Staff> staffs = await _masterDao.allStaffs();
    for (final Staff s in staffs) {
      if (!hasAuthority(s, requiredPermission)) continue;
      if (await _verifier.verify(pin: pin, pinHash: s.pinHash)) {
        _failedAttempts = 0;
        _lockedUntil = null;
        return SupervisorVerdict.granted(s.id, s.name);
      }
    }

    await _recordFailure('supervisor_pin:$requiredPermission');
    return const SupervisorVerdict.denied(SupervisorDenial.badCredentials);
  }

  /// Apakah [staff] berwenang menutup paksa shift.
  static bool canForceClose(Staff staff) =>
      hasAuthority(staff, forceClosePermission);

  /// Apakah [staff] memiliki peran supervisor atau izin granular [permission].
  static bool hasAuthority(Staff staff, String permission) {
    if (forceCloseRoles.contains(staff.role.toUpperCase())) return true;

    try {
      final Object? decoded = jsonDecode(staff.permissionsJson);
      if (decoded is List<Object?>) {
        if (decoded.contains(permission)) return true;
        if (permission == forceClosePermission &&
            decoded.contains('FORCE_CLOSE_SHIFT')) {
          return true;
        }
      }
    } on FormatException {
      // JSON izin yang rusak diperlakukan sebagai TIDAK punya izin. Keliru ke
      // arah menolak adalah satu-satunya arah yang aman di sini.
    }
    return false;
  }
}
