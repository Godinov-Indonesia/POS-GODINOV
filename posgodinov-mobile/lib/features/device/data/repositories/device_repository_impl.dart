import 'package:posgodinov_mobile/core/storage/secure_storage_service.dart';
import 'package:posgodinov_mobile/features/device/data/datasources/device_remote_ds.dart';
import 'package:posgodinov_mobile/features/device/data/datasources/master_local_ds.dart';
import 'package:posgodinov_mobile/features/device/data/models/master_data_dto.dart';
import 'package:posgodinov_mobile/features/device/domain/entities/device_session.dart';
import 'package:posgodinov_mobile/features/device/domain/entities/master_snapshot.dart';
import 'package:posgodinov_mobile/features/device/domain/repositories/device_repository.dart';

class DeviceRepositoryImpl implements DeviceRepository {
  const DeviceRepositoryImpl({
    required DeviceRemoteDataSource remote,
    required MasterLocalDataSource local,
    required SecureStorageService storage,
    DateTime Function()? now,
  })  : _remote = remote,
        _local = local,
        _storage = storage,
        _now = now ?? DateTime.now;

  final DeviceRemoteDataSource _remote;
  final MasterLocalDataSource _local;
  final SecureStorageService _storage;
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

    return DeviceSession(
      serialBusiness: serialBusiness,
      serialOutlet: serialOutlet,
      boundAt: _now(),
    );
  }

  @override
  Future<bool> isBound() => _storage.hasDeviceToken();

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
