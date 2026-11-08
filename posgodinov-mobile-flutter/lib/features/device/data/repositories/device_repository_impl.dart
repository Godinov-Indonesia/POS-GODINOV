import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/storage/secure_storage_service.dart';
import 'package:posgodinov_mobile/features/device/data/datasources/device_remote_ds.dart';
import 'package:posgodinov_mobile/features/device/data/datasources/master_local_ds.dart';
import 'package:posgodinov_mobile/features/device/data/models/master_data_dto.dart';
import 'package:posgodinov_mobile/features/device/domain/entities/device_session.dart';
import 'package:posgodinov_mobile/features/device/domain/entities/master_snapshot.dart';
import 'package:posgodinov_mobile/features/device/domain/repositories/device_repository.dart';
import 'package:uuid/uuid.dart';

class DeviceRepositoryImpl implements DeviceRepository {
  const DeviceRepositoryImpl({
    required DeviceRemoteDataSource remote,
    required MasterLocalDataSource local,
    required SecureStorageService storage,
    required SyncDao syncDao,
    DateTime Function()? now,
  })  : _remote = remote,
        _local = local,
        _storage = storage,
        _syncDao = syncDao,
        _now = now ?? DateTime.now;

  final DeviceRemoteDataSource _remote;
  final MasterLocalDataSource _local;
  final SecureStorageService _storage;

  /// `device_id` tinggal di `sync_meta`, bukan di `secure_storage`.
  ///
  /// Ia bukan rahasia — ia dikirim apa adanya pada setiap payload sync — dan
  /// menaruhnya di keystore hanya menambah kegagalan yang mungkin terjadi pada
  /// jalur yang harus selalu berhasil.
  final SyncDao _syncDao;

  final DateTime Function() _now;

  @override
  Future<DeviceSession> bind({
    required String serialBusiness,
    required String serialOutlet,
    required String password,
  }) async {
    final DeviceBindResponseDto dto = await _remote.bind(
      serialBusiness: serialBusiness,
      serialOutlet: serialOutlet,
      password: password,
    );

    // Token disimpan SEBELUM apa pun yang lain. Bila proses mati tepat setelah
    // ini, perangkat sudah terikat dan sync master dapat diulang; sebaliknya,
    // token yang hilang berarti teknisi harus datang lagi — tidak ada endpoint
    // untuk menerbitkannya ulang tanpa password pemilik ([03 §2.1]).
    await _storage.saveDeviceToken(dto.deviceToken);

    // ── BUTIR 12 — identitas instalasi yang stabil ([11 §M15.2]) ──────────
    await ensureDeviceId();

    return DeviceSession(
      serialBusiness: serialBusiness,
      serialOutlet: serialOutlet,
      boundAt: _now(),
    );
  }

  @override
  Future<bool> isBound() => _storage.hasDeviceToken();

  /// Identitas instalasi yang stabil — dasar butir 12.
  ///
  /// ═══════════════════════════════════════════════════════════════════════
  /// DIBUAT SEKALI, TIDAK PERNAH BERUBAH
  /// ═══════════════════════════════════════════════════════════════════════
  ///
  /// Indeks `uq_shift_open_per_device` mengunci satu shift `OPEN` per
  /// perangkat. Kunci itu hanya bermakna bila identitas perangkatnya menetap:
  /// `device_id` yang lahir baru setiap kali aplikasi dibuka membuat setiap
  /// sesi tampak seperti perangkat berbeda, dan kasir dapat membuka shift kedua
  /// hanya dengan memulai ulang aplikasi.
  ///
  /// Karena itu ia **tidak** diturunkan dari ANDROID_ID maupun identitas
  /// perangkat keras lain: keduanya berubah saat factory reset dan dapat sama
  /// di antara dua unit dari batch yang sama. Ia lahir sekali saat binding, di
  /// `sync_meta` yang sama dengan metadata sync lainnya.
  ///
  /// Mengembalikan id yang berlaku, baik yang baru dibuat maupun yang sudah
  /// ada.
  @override
  Future<String> ensureDeviceId() async {
    final String? existing = await _syncDao.readMeta(SyncMetaKeys.deviceId);

    // ⚠️ Pengembalian lebih awal ini adalah inti fungsinya. Menghapusnya —
    // bahkan "sekadar untuk memuat ulang" — akan menerbitkan identitas baru
    // pada perangkat yang sedang memegang shift terbuka, dan penguncian butir
    // 12 hilang tanpa satu pun galat.
    if (existing != null && existing.isNotEmpty && existing != 'legacy') {
      return existing;
    }

    final String id = const Uuid().v4();
    await _syncDao.writeMeta(SyncMetaKeys.deviceId, id, _now());
    return id;
  }

  @override
  Future<MasterSnapshot> syncMasterData() async {
    final MasterDataDto data = await _remote.fetchMasterData();
    final DateTime syncedAt = _now();

    await _local.saveSnapshot(data, syncedAt);

    return MasterSnapshot(
      staffCount: data.staffs.length,
      categoryCount: data.categories.length,
      productCount: data.products.length,
      syncedAt: syncedAt,
    );
  }

  @override
  Future<DateTime?> lastMasterSyncAt() => _local.lastSyncedAt();

  @override
  Future<bool> isMasterDataStale() => _local.isStale(_now());

  @override
  Future<bool> isMasterDataEmpty() => _local.isEmpty();
}
