import 'dart:convert';

import 'package:drift/drift.dart' show Value;
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/config/pos_config.dart';
import 'package:posgodinov_mobile/core/crypto/pin_verifier.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/master_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/security_event_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:uuid/uuid.dart';

/// Hasil percobaan keluar Kiosk.
enum KioskExitOutcome {
  /// PIN milik staff yang berizin — Kiosk boleh dibuka.
  granted,

  /// PIN tidak cocok, atau cocok tetapi pemiliknya tidak berizin.
  ///
  /// Kedua kasus SENGAJA tidak dibedakan bagi pemakai — lihat catatan pada
  /// [KioskGuard.attemptExit].
  denied,

  /// Sedang dalam jeda setelah tiga kegagalan berturut.
  lockedOut,
}

/// Putusan gerbang beserta konteks yang dibutuhkan layar.
class KioskExitVerdict {
  const KioskExitVerdict({
    required this.outcome,
    this.attemptsLeft = 0,
    this.retryAfter = Duration.zero,
    this.staffName = '',
  });

  final KioskExitOutcome outcome;
  final int attemptsLeft;
  final Duration retryAfter;
  final String staffName;

  bool get ok => outcome == KioskExitOutcome.granted;

  /// Pesan untuk pemakai. SAMA untuk PIN salah dan PIN tanpa izin.
  String get message => switch (outcome) {
        KioskExitOutcome.granted => '',
        KioskExitOutcome.lockedOut =>
          'Terlalu banyak percobaan. Coba lagi dalam ${retryAfter.inSeconds} detik.',
        KioskExitOutcome.denied =>
          'PIN tidak berwenang membuka mode Kiosk. Sisa percobaan: $attemptsLeft.',
      };
}

/// Gerbang keluar mode Kiosk — **butir 14** ([11 §M17.4]).
///
/// # Dua lapis, keduanya disengaja
///
/// 1. **Ketukan tersembunyi.** Tidak ada tombol "keluar" yang terlihat;
///    pelanggan tidak boleh menemukan jalan keluar secara tidak sengaja.
/// 2. **PIN staff BERIZIN.** Memakai [PinVerifier] **yang sama** dengan login
///    kasir — tidak ada PIN kedua, dan **tidak ada kode master yang
///    di-*hard-code***. Kode master adalah rahasia bersama yang bocor pada
///    pemasangan pertama.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// YANG BERUBAH PADA M17.4: IZIN, BUKAN SEKADAR PIN YANG SAH
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Versi sebelumnya menerima PIN staff **mana pun** di outlet. Itu berarti
/// kasir yang perangkatnya dikunci dapat membukanya sendiri — dan mode Kiosk
/// yang dapat dibuka oleh orang yang seharusnya dikunci di dalamnya bukan mode
/// Kiosk, melainkan tombol yang kebetulan tersembunyi.
///
/// Kini PIN harus milik staff yang `permissions`-nya memuat
/// `config.kiosk_exit_permission`. Diputuskan OFFLINE dari izin yang ikut
/// master data ([11 §4.4]) — Kiosk justru dipakai di perangkat yang jaringannya
/// sengaja dibatasi.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// TIGA KEGAGALAN → JEDA 60 DETIK
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Jeda ini bukan pengamanan kriptografis — ia melawan penebakan PIN 4 digit
/// secara beruntun. Sepuluh ribu kemungkinan pada tiga percobaan per menit
/// memakan lebih dari dua hari; tanpa jeda, beberapa jam.
class KioskGuard {
  KioskGuard({
    required MasterDao masterDao,
    required SecurityEventDao securityEventDao,
    required SyncDao syncDao,
    PinVerifier verifier = const PinVerifier(),
    int tapsRequired = 5,
    Duration tapWindow = const Duration(seconds: 3),
    Uuid uuid = const Uuid(),
    DateTime Function()? now,
  })  : _masterDao = masterDao,
        _events = securityEventDao,
        _syncDao = syncDao,
        _verifier = verifier,
        _tapsRequired = tapsRequired,
        _tapWindow = tapWindow,
        _uuid = uuid,
        _now = now ?? DateTime.now;

  final MasterDao _masterDao;
  final SecurityEventDao _events;
  final SyncDao _syncDao;
  final PinVerifier _verifier;
  final int _tapsRequired;
  final Duration _tapWindow;
  final Uuid _uuid;
  final DateTime Function() _now;

  /// Kegagalan berturut sebelum jeda dijatuhkan.
  static const int maxAttempts = 3;

  /// Lama jeda setelah [maxAttempts] kegagalan.
  static const Duration lockoutDuration = Duration(seconds: 60);

  final List<DateTime> _taps = <DateTime>[];

  int _consecutiveFailures = 0;
  DateTime? _lockedUntil;

  /// Mencatat satu ketukan pada area tersembunyi.
  ///
  /// Mengembalikan `true` bila jumlah ketukan dalam jendela waktu sudah cukup
  /// untuk memunculkan dialog PIN.
  bool registerTap() {
    final DateTime now = _now();
    _taps
      ..add(now)
      ..removeWhere((DateTime t) => now.difference(t) > _tapWindow);

    if (_taps.length >= _tapsRequired) {
      _taps.clear();
      return true;
    }
    return false;
  }

  void reset() => _taps.clear();

  /// Sisa jeda; [Duration.zero] berarti tidak sedang terkunci.
  Duration lockoutRemaining() {
    final DateTime? until = _lockedUntil;
    if (until == null) return Duration.zero;
    final Duration sisa = until.difference(_now());
    return sisa.isNegative ? Duration.zero : sisa;
  }

  /// Memverifikasi PIN keluar Kiosk terhadap staff **berizin**.
  ///
  /// Identifier tidak diminta: layar Kiosk menghadap pelanggan, dan kolom ID
  /// staff akan membocorkan daftar siapa saja yang bekerja di outlet ini kepada
  /// siapa pun yang lewat. PIN dicocokkan terhadap seluruh staff berizin.
  ///
  /// > **Biayanya nyata.** bcrypt dijalankan sekali per staff, masing-masing
  /// > 100–300 ms. Itu dapat diterima untuk gerbang yang ditekan beberapa kali
  /// > sehari, dan kelambatannya justru menyulitkan penebakan beruntun.
  /// > Perulangan **tidak** dihentikan lebih awal saat cocok — keluar pada
  /// > staff pertama membocorkan urutan melalui waktu respons.
  Future<KioskExitVerdict> attemptExit(String pin) async {
    final Duration sisa = lockoutRemaining();
    if (sisa > Duration.zero) {
      return KioskExitVerdict(
        outcome: KioskExitOutcome.lockedOut,
        retryAfter: sisa,
      );
    }

    final PosConfig config = await PosConfig.read(_syncDao);
    final List<Staff> all = await _masterDao.allStaffs();

    // Disaring SEBELUM verifikasi, bukan sesudah.
    //
    // Mencocokkan PIN terhadap seluruh staff lalu memeriksa izinnya akan
    // memberi tahu — lewat selisih waktu — bahwa PIN yang dimasukkan benar
    // tetapi orangnya tidak berwenang. Membatasi kandidat sejak awal membuat
    // kedua kegagalan tidak dapat dibedakan.
    final List<Staff> authorized = <Staff>[
      for (final Staff s in all)
        if (_hasExitPermission(s, config.kioskExitPermission)) s,
    ];

    Staff? matched;
    for (final Staff s in authorized) {
      // Sengaja TIDAK `break` saat cocok — lihat catatan di atas.
      if (await _verifier.verify(pin: pin, pinHash: s.pinHash)) matched = s;
    }

    if (matched != null) {
      _consecutiveFailures = 0;
      _lockedUntil = null;
      await _record(
        SecurityEventType.kioskExitGranted,
        SecuritySeverity.warn,
        <String, dynamic>{'staff_id': matched.id, 'staff_name': matched.name},
      );
      return KioskExitVerdict(
        outcome: KioskExitOutcome.granted,
        staffName: matched.name,
      );
    }

    _consecutiveFailures++;
    final int attemptsLeft = (maxAttempts - _consecutiveFailures).clamp(0, maxAttempts);

    // Apakah PIN-nya milik staff yang TIDAK berwenang?
    //
    // Diperiksa hanya untuk memilih isi `details` — pesan ke pemakai tetap
    // sama. Pemilik perlu dapat membedakan "orang asing menebak PIN" dari
    // "kasir sendiri mencoba membuka kuncinya"; keduanya menuntut tindakan yang
    // sangat berbeda.
    final bool knownStaff = await _matchesUnauthorized(pin, all, authorized);

    await _record(
      SecurityEventType.kioskExitDenied,
      // CRITICAL, bukan WARN ([11 §M17.4]): percobaan membuka kunci perangkat
      // adalah peristiwa yang pemilik harus lihat, bukan sekadar dicatat.
      SecuritySeverity.critical,
      <String, dynamic>{
        'attempts': _consecutiveFailures,
        'attempts_left': attemptsLeft,
        'known_staff': knownStaff,
      },
    );

    if (_consecutiveFailures >= maxAttempts) {
      _lockedUntil = _now().add(lockoutDuration);
      _consecutiveFailures = 0;

      await _record(
        SecurityEventType.kioskExitLockedOut,
        SecuritySeverity.critical,
        <String, dynamic>{
          'lockout_seconds': lockoutDuration.inSeconds,
          'threshold': maxAttempts,
        },
      );

      return const KioskExitVerdict(
        outcome: KioskExitOutcome.lockedOut,
        retryAfter: lockoutDuration,
      );
    }

    return KioskExitVerdict(
      outcome: KioskExitOutcome.denied,
      attemptsLeft: attemptsLeft,
    );
  }

  /// Apakah [staff] berizin membuka Kiosk?
  ///
  /// Izin KOSONG berarti TIDAK berwenang. Perangkat yang master datanya berasal
  /// dari server pra-v2 karena itu tidak punya siapa pun yang dapat membuka
  /// Kiosk — dan itu keadaan yang benar: gerbang yang terbuka untuk semua orang
  /// pada perangkat yang kebetulan belum diperbarui adalah pintu belakang,
  /// bukan kompatibilitas.
  static bool _hasExitPermission(Staff staff, String permission) {
    try {
      final Object? decoded = jsonDecode(staff.permissionsJson);
      return decoded is List<Object?> && decoded.contains(permission);
    } on FormatException {
      // JSON izin yang rusak diperlakukan sebagai TIDAK punya izin. Keliru ke
      // arah menolak adalah satu-satunya arah yang aman di sini.
      return false;
    }
  }

  Future<bool> _matchesUnauthorized(
    String pin,
    List<Staff> all,
    List<Staff> authorized,
  ) async {
    final Set<String> authorizedIds = authorized.map((Staff s) => s.id).toSet();
    bool found = false;
    for (final Staff s in all) {
      if (authorizedIds.contains(s.id)) continue;
      if (await _verifier.verify(pin: pin, pinHash: s.pinHash)) found = true;
    }
    return found;
  }

  Future<void> _record(
    String eventType,
    SecuritySeverity severity,
    Map<String, dynamic> details,
  ) async {
    try {
      await _events.record(
        SecurityEventsCompanion.insert(
          id: _uuid.v4(),
          deviceId: Value<String>(
            await _syncDao.readMeta(SyncMetaKeys.deviceId) ?? 'legacy',
          ),
          eventType: eventType,
          severity: severity,
          detailsJson: Value<String>(jsonEncode(details)),
          clientCreatedAt: _now().toUtc(),
        ),
      );
    } on Object {
      // Pencatatan yang gagal TIDAK boleh membuka gerbangnya. Penguncian adalah
      // aturan; catatan hanyalah jejaknya.
    }
  }
}
