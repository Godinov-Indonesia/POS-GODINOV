import 'dart:convert';

import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';

/// Kebijakan operasional dari master data ([11 §4.4]).
///
/// Nilai-nilainya hidup di server supaya pemilik dapat mengubah ambang batas
/// **tanpa merilis ulang tiga aplikasi**. Perangkat yang belum pernah menarik
/// master v2 memakai bawaan di bawah — dan bawaannya sengaja KETAT: kebijakan
/// longgar secara bawaan berarti outlet yang belum pernah membuka layar
/// pengaturan berjalan tanpa pengendalian apa pun.
class PosConfig {
  const PosConfig({
    this.voidThresholdQty = SyncLimits.voidThresholdQty,
    this.requireSupervisorForVoid = true,
    this.requireSupervisorForReturn = true,
    this.blindCloseEnabled = true,
    this.blindOpnameEnabled = true,
    this.historyScopeActiveShift = true,
    this.masterDataMaxAgeMinutes = 720,
    this.kioskExitPermission = _defaultKioskExitPermission,
  });

  /// Membaca blok `config` yang disimpan penarikan master data terakhir.
  ///
  /// Digabung **per-field**, bukan per-objek: server yang mengirim `config`
  /// separuh — mis. versi lama yang belum mengenal `history_scope` — tidak
  /// boleh membuat field lainnya jatuh ke `null` dan diam-diam mematikan
  /// pengendalian.
  static Future<PosConfig> read(SyncDao dao) async {
    final String? raw = await dao.readMeta(SyncMetaKeys.remoteConfig);
    if (raw == null || raw.isEmpty) return const PosConfig();

    Map<String, dynamic> json;
    try {
      final Object? decoded = jsonDecode(raw);
      json = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    } on FormatException {
      // Blok config yang rusak diperlakukan sebagai TIDAK ADA, bukan sebagai
      // alasan melempar. Kasir tidak boleh terhalang membuka shift karena satu
      // baris JSON yang cacat; bawaan yang ketat sudah menjadi jaring
      // pengamannya.
      return const PosConfig();
    }

    const PosConfig fallback = PosConfig();

    return PosConfig(
      voidThresholdQty:
          _positiveInt(json['void_threshold_qty'], fallback.voidThresholdQty),
      requireSupervisorForVoid: json['require_supervisor_for_void'] as bool? ??
          fallback.requireSupervisorForVoid,
      requireSupervisorForReturn:
          json['require_supervisor_for_return'] as bool? ??
              fallback.requireSupervisorForReturn,
      blindCloseEnabled:
          json['blind_close_enabled'] as bool? ?? fallback.blindCloseEnabled,
      blindOpnameEnabled:
          json['blind_opname_enabled'] as bool? ?? fallback.blindOpnameEnabled,
      historyScopeActiveShift: json['history_scope'] != 'ALL',
      masterDataMaxAgeMinutes: _positiveInt(
        json['master_data_max_age_minutes'],
        fallback.masterDataMaxAgeMinutes,
      ),
      kioskExitPermission: _nonEmptyString(
        json['kiosk_exit_permission'],
        fallback.kioskExitPermission,
      ),
    );
  }

  final int voidThresholdQty;
  final bool requireSupervisorForVoid;
  final bool requireSupervisorForReturn;
  final bool blindCloseEnabled;
  /// ⚠️ **Belum punya pemakai di aplikasi mobile** — dan itu keadaan yang
  /// benar, bukan kelalaian ([11 §M16.6], [11 §M18.2]).
  ///
  /// Modul Opname belum ada di Flutter: M16 Tahap 1 hanya membangun PWA
  /// `/opname`, dan *flavor* Flutter dijadwalkan M16.6 yang belum dikerjakan.
  /// Flag ini dibaca sekarang supaya kontraknya sudah benar saat modul itu
  /// lahir — bukan supaya ia tampak terpasang.
  ///
  /// Bawaan `true` dan KETAT: perangkat yang belum pernah menarik `config`
  /// berjalan dengan Blind Opname penuh.
  final bool blindOpnameEnabled;
  final bool historyScopeActiveShift;

  /// Umur maksimum master data sebelum gerbang Buka Shift memblokir (butir 10).
  final int masterDataMaxAgeMinutes;

  /// Nama izin yang WAJIB dimiliki staff untuk keluar dari mode Kiosk
  /// (butir 14, [11 §4.4]). Dibaca [KioskGuard] dan dicocokkan terhadap
  /// `staff.permissions`.
  ///
  /// Sisi server: `PosConfig.kiosk_exit_permission` — lihat
  /// `posgodinov-be/internal/domain/pos_master_data.go` (`PermissionKioskExit`).
  final String kioskExitPermission;

  Duration get masterDataMaxAge => Duration(minutes: masterDataMaxAgeMinutes);

  /// Angka nol dan negatif DITOLAK, bukan diterima.
  ///
  /// `void_threshold_qty: 0` akan memaksa alur Void pada SETIAP penurunan satu
  /// unit dan melumpuhkan kasir; nilai semacam itu hampir pasti kesalahan
  /// konfigurasi, bukan kebijakan yang disengaja.
  /// Bawaan disamakan dengan `domain.PermissionKioskExit` di backend.
  static const String _defaultKioskExitPermission = 'KIOSK_EXIT';

  /// String kosong diperlakukan sebagai TIDAK DIKIRIM, bukan sebagai izin
  /// bernama kosong — yang terakhir tidak akan dimiliki siapa pun dan mengunci
  /// setiap orang di dalam Kiosk secara permanen.
  static String _nonEmptyString(Object? value, String fallback) {
    final String? parsed = value is String ? value.trim() : null;
    return (parsed != null && parsed.isNotEmpty) ? parsed : fallback;
  }

  static int _positiveInt(Object? value, int fallback) {
    final int? parsed = value is num
        ? value.toInt()
        : value is String
            ? int.tryParse(value)
            : null;
    return (parsed != null && parsed > 0) ? parsed : fallback;
  }
}
