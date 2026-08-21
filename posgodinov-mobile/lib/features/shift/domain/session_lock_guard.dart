import 'dart:convert';

import 'package:drift/drift.dart' show Value;
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/security_event_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/shift_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:uuid/uuid.dart';

/// Penjaga Identity Lock — **butir 12** ([11 §M15.2]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// SATU TEMPAT MEMUTUSKAN, SEMUA JALUR MELEWATINYA
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Percobaan keluar sesi tidak selalu datang dari tombol. Tombol back berulang,
/// deep link, dan pemanggilan langsung `CashierAuthCubit` semuanya harus
/// mendarat di sini — dan tidak satu pun dari ketiganya berada di dalam pohon
/// widget.
///
/// Keadaan shift dibaca dari **basis data**, bukan dari state Bloc. State Bloc
/// dapat basi bila shift ditutup dari layar lain; basis data tidak.
class SessionLockGuard {
  const SessionLockGuard({
    required ShiftDao shiftDao,
    required SecurityEventDao securityEventDao,
    required SyncDao syncDao,
    Uuid uuid = const Uuid(),
    DateTime Function()? now,
  })  : _shiftDao = shiftDao,
        _events = securityEventDao,
        _syncDao = syncDao,
        _uuid = uuid,
        _now = now ?? DateTime.now;

  final ShiftDao _shiftDao;
  final SecurityEventDao _events;
  final SyncDao _syncDao;
  final Uuid _uuid;
  final DateTime Function() _now;

  /// `true` bila sesi terkunci oleh shift berjalan — dan percobaannya dicatat.
  ///
  /// [source] menjelaskan dari mana percobaan datang, mis. `settings:ganti-kasir`
  /// atau `statusbar`. Nilainya ikut ke `details` supaya pemilik dapat melihat
  /// jalur mana yang paling sering ditabrak, bukan sekadar bahwa ada yang
  /// mencoba.
  Future<bool> isLocked({String source = 'unknown'}) async {
    final LocalShift? shift = await _shiftDao.openShift();
    if (shift == null) return false;

    await _record(shift, source);
    return true;
  }

  /// Keadaan kunci **tanpa mencatat apa pun**.
  ///
  /// Dipakai UI untuk menentukan apakah tombol keluar sesi perlu dirender sama
  /// sekali. Memakai [isLocked] di sini akan menulis satu baris audit setiap
  /// kali layar digambar ulang, dan sinyal yang sesungguhnya — seseorang
  /// benar-benar mencoba keluar — tenggelam di antara ratusan duplikat.
  Future<bool> isLockedSilently() async =>
      await _shiftDao.openShift() != null;

  Future<void> _record(LocalShift shift, String source) async {
    try {
      await _events.record(
        SecurityEventsCompanion.insert(
          id: _uuid.v4(),
          shiftId: Value<String?>(shift.id),
          staffId: Value<String?>(shift.staffId),
          deviceId: Value<String>(
            await _syncDao.readMeta(SyncMetaKeys.deviceId) ?? 'legacy',
          ),
          eventType: SecurityEventType.logoutBlockedActiveShift,
          severity: SecuritySeverity.warn,
          detailsJson: Value<String>(
            jsonEncode(<String, dynamic>{
              'source': source,
              'shift_id': shift.id,
              'opened_at': shift.clientOpenedAt.toUtc().toIso8601String(),
            }),
          ),
          clientCreatedAt: _now().toUtc(),
        ),
      );
    } on Object {
      // Pencatatan yang gagal TIDAK boleh membuka kuncinya. Penguncian adalah
      // aturan; catatan hanyalah jejaknya, dan kehilangan jejak jauh lebih
      // ringan daripada melepas laci orang lain.
    }
  }
}
