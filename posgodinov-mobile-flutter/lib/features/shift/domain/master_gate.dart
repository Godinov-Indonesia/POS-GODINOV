import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/config/pos_config.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';

/// Mengapa gerbang menolak.
enum MasterGateReason {
  /// Boleh membuka shift.
  ok,

  /// Belum pernah menarik master data sama sekali.
  neverPulled,

  /// Umur master melewati `config.master_data_max_age_minutes`.
  stale,

  /// Server melaporkan versi yang lebih baru daripada yang dipegang perangkat.
  outdated,
}

/// Putusan gerbang Master Data.
class MasterGateVerdict {
  const MasterGateVerdict({
    required this.reason,
    required this.version,
    required this.serverVersion,
    required this.ageMinutes,
    required this.maxAgeMinutes,
    required this.blindCloseEnabled,
  });

  final MasterGateReason reason;

  /// Versi yang benar-benar dipegang perangkat.
  final int? version;

  /// Versi terkini menurut respons sync terakhir.
  final int? serverVersion;

  /// Umur master data dalam menit; `null` bila belum pernah ditarik.
  final int? ageMinutes;

  final int maxAgeMinutes;

  /// Ikut dibawa supaya pemanggil tidak perlu membaca config dua kali saat
  /// membuka shift — shift menyimpan `blind_close` sejak dibuka.
  final bool blindCloseEnabled;

  bool get ok => reason == MasterGateReason.ok;

  /// Pesan yang dibaca kasir. Tanpa jargon, dan selalu menyebut tindakannya.
  String get message => switch (reason) {
        MasterGateReason.ok => '',
        MasterGateReason.neverPulled =>
          'Perangkat ini belum pernah mengunduh data produk. Shift tidak dapat '
              'dibuka sebelum unduhan pertama berhasil.',
        MasterGateReason.stale =>
          'Data produk di perangkat ini sudah kedaluwarsa. Harga yang dipakai '
              'bisa jadi bukan harga hari ini.',
        MasterGateReason.outdated =>
          'Pemilik sudah memperbarui data produk. Unduh versi terbaru sebelum '
              'membuka shift.',
      };
}

/// Gerbang Master Data sebelum Buka Shift — **butir 10** ([11 §M15.1]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// MENGAPA INI GERBANG, BUKAN PERINGATAN
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Membuka shift dengan katalog kemarin berarti berjualan seharian pada harga
/// yang sudah tidak berlaku. Kerugiannya tidak dapat dikoreksi: pelanggan sudah
/// membayar, sudah menerima struk, dan sudah pulang.
///
/// Karena itu tidak ada tombol "Lewati" di mana pun pada alur ini, dan
/// ketiadaannya adalah keputusan produk — bukan sesuatu yang belum sempat
/// ditambahkan. Tombol semacam itu akan ditekan setiap pagi oleh kasir yang
/// sedang terburu-buru, dan gerbangnya berhenti menjadi gerbang.
class MasterGate {
  const MasterGate({required SyncDao syncDao, DateTime Function()? now})
      : _dao = syncDao,
        _now = now ?? DateTime.now;

  final SyncDao _dao;
  final DateTime Function() _now;

  /// Menilai apakah perangkat boleh membuka shift.
  ///
  /// ⚠️ **Murni lokal — tidak menyentuh jaringan.** Gerbang yang memerlukan
  /// permintaan HTTP setiap kali dievaluasi akan memblokir perangkat offline
  /// yang master datanya justru masih segar, dan itu membalik maksudnya: yang
  /// ingin dicegah adalah katalog basi, bukan ketiadaan sinyal.
  Future<MasterGateVerdict> evaluate() async {
    final PosConfig config = await PosConfig.read(_dao);
    final int maxAge = config.masterDataMaxAgeMinutes;

    final DateTime? lastSync = await _dao.masterDataSyncedAt();
    final int? version = _readInt(
      await _dao.readMeta(SyncMetaKeys.masterDataVersion),
    );
    final int? serverVersion = _readInt(
      await _dao.readMeta(SyncMetaKeys.masterDataServerVersion),
    );

    MasterGateVerdict verdict(MasterGateReason reason, int? ageMinutes) =>
        MasterGateVerdict(
          reason: reason,
          version: version,
          serverVersion: serverVersion,
          ageMinutes: ageMinutes,
          maxAgeMinutes: maxAge,
          blindCloseEnabled: config.blindCloseEnabled,
        );

    if (lastSync == null) {
      return verdict(MasterGateReason.neverPulled, null);
    }

    final int ageMinutes = _now().difference(lastSync).inMinutes;
    if (ageMinutes > maxAge) {
      return verdict(MasterGateReason.stale, ageMinutes);
    }

    // Versi server yang lebih tinggi berarti pemilik mengubah katalog sejak
    // penarikan terakhir. Umur yang masih muda tidak menolongnya: master
    // berumur dua menit pun salah bila harganya baru saja naik.
    //
    // Diperiksa hanya bila KEDUA angka diketahui. Server pra-v2 tidak mengirim
    // versi sama sekali, dan membandingkan `null` akan memblokir seluruh outlet
    // yang backend-nya belum naik.
    if (version != null && serverVersion != null && serverVersion > version) {
      return verdict(MasterGateReason.outdated, ageMinutes);
    }

    return verdict(MasterGateReason.ok, ageMinutes);
  }

  static int? _readInt(String? raw) => raw == null ? null : int.tryParse(raw);
}
