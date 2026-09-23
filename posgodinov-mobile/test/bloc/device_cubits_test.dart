import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/features/device/domain/entities/device_session.dart';
import 'package:posgodinov_mobile/features/device/domain/entities/master_snapshot.dart';
import 'package:posgodinov_mobile/features/device/domain/repositories/device_repository.dart';
import 'package:posgodinov_mobile/features/device/presentation/cubit/device_binding_cubit.dart';
import 'package:posgodinov_mobile/features/device/presentation/cubit/master_sync_cubit.dart';

class _FakeDeviceRepository implements DeviceRepository {
  _FakeDeviceRepository({
    this.bindError,
    this.syncError,
    this.masterEmpty = false,
    this.masterStale = false,
  })  : snapshot = null,
        bound = false;

  final Failure? bindError;
  final Failure? syncError;
  final MasterSnapshot? snapshot;
  final bool bound;
  final bool masterEmpty;
  final bool masterStale;

  int bindCount = 0;
  int syncCount = 0;

  @override
  Future<DeviceSession> bind({
    required String serialBusiness,
    required String serialOutlet,
    required String password,
  }) async {
    bindCount++;
    if (bindError != null) throw bindError!;
    return DeviceSession(
      serialBusiness: serialBusiness,
      serialOutlet: serialOutlet,
      boundAt: DateTime.utc(2026, 8, 12),
    );
  }

  @override
  Future<bool> isBound() async => bound;

  @override
  Future<MasterSnapshot> syncMasterData() async {
    syncCount++;
    if (syncError != null) throw syncError!;
    return snapshot ??
        MasterSnapshot(
          staffCount: 2,
          categoryCount: 3,
          productCount: 12,
          syncedAt: DateTime.utc(2026, 8, 12),
        );
  }

  @override
  Future<DateTime?> lastMasterSyncAt() async => null;

  @override
  Future<bool> isMasterDataStale() async => masterStale;

  @override
  Future<bool> isMasterDataEmpty() async => masterEmpty;

  /// Identitas instalasi stabil — butir 12 ([11 §M15.2]). Tetap sepanjang umur
  /// fake ini, persis seperti implementasi asli yang membuatnya sekali.
  @override
  Future<String> ensureDeviceId() async => 'dev-fake-0001';
}

void main() {
  group('DeviceBindingCubit (P-01)', () {
    blocTest<DeviceBindingCubit, DeviceBindingState>(
      'binding berhasil',
      build: () => DeviceBindingCubit(_FakeDeviceRepository()),
      act: (DeviceBindingCubit c) => c.submit(
        serialBusiness: 'KOPBU100826',
        serialOutlet: 'KOPBU100826001',
        password: 'rahasia123',
      ),
      expect: () => <Matcher>[
        isA<BindingSubmitting>(),
        isA<BindingSuccess>(),
      ],
    );

    blocTest<DeviceBindingCubit, DeviceBindingState>(
      'pesan server ditampilkan APA ADANYA',
      // Backend menjawab 401 "kredensial bisnis tidak valid" ([03 §2.1]);
      // kalimatnya sudah berbahasa Indonesia dan tidak boleh diganti.
      build: () => DeviceBindingCubit(
        _FakeDeviceRepository(
          bindError: const ApiFailure('kredensial bisnis tidak valid'),
        ),
      ),
      act: (DeviceBindingCubit c) => c.submit(
        serialBusiness: 'KOPBU100826',
        serialOutlet: 'KOPBU100826001',
        password: 'salah',
      ),
      expect: () => <Matcher>[
        isA<BindingSubmitting>(),
        isA<BindingFailure>().having(
          (BindingFailure f) => f.message,
          'message',
          'kredensial bisnis tidak valid',
        ),
      ],
    );

    blocTest<DeviceBindingCubit, DeviceBindingState>(
      'field kosong ditolak sebelum menyentuh jaringan',
      build: () => DeviceBindingCubit(_FakeDeviceRepository()),
      act: (DeviceBindingCubit c) => c.submit(
        serialBusiness: '',
        serialOutlet: 'KOPBU100826001',
        password: 'rahasia123',
      ),
      expect: () => <Matcher>[isA<BindingFailure>()],
      verify: (DeviceBindingCubit _) {},
    );

    test('serial dipangkas spasi sebelum dikirim', () async {
      final _FakeDeviceRepository repo = _FakeDeviceRepository();
      final DeviceBindingCubit cubit = DeviceBindingCubit(repo);

      await cubit.submit(
        serialBusiness: '  KOPBU100826  ',
        serialOutlet: ' KOPBU100826001 ',
        password: 'rahasia123',
      );

      final DeviceBindingState state = cubit.state;
      expect(state, isA<BindingSuccess>());
      expect(
        (state as BindingSuccess).session.serialBusiness,
        'KOPBU100826',
      );
      await cubit.close();
    });
  });

  group('MasterSyncCubit (P-02)', () {
    blocTest<MasterSyncCubit, MasterSyncState>(
      'sinkronisasi berhasil melaporkan hitungan',
      build: () => MasterSyncCubit(_FakeDeviceRepository()),
      act: (MasterSyncCubit c) => c.sync(),
      expect: () => <Matcher>[
        isA<MasterSyncDownloading>(),
        isA<MasterSyncDone>().having(
          (MasterSyncDone d) => d.snapshot.productCount,
          'productCount',
          12,
        ),
      ],
    );

    blocTest<MasterSyncCubit, MasterSyncState>(
      'gagal saat perangkat punya data lama menawarkan lanjut offline',
      build: () => MasterSyncCubit(
        _FakeDeviceRepository(
          syncError: const NetworkFailure('Tidak dapat terhubung ke server.'),
        ),
      ),
      act: (MasterSyncCubit c) => c.sync(),
      expect: () => <Matcher>[
        isA<MasterSyncDownloading>(),
        isA<MasterSyncFailure>().having(
          (MasterSyncFailure f) => f.hasLocalData,
          'hasLocalData',
          isTrue,
        ),
      ],
    );

    blocTest<MasterSyncCubit, MasterSyncState>(
      'gagal pada perangkat kosong tidak menawarkan jalan lanjut',
      build: () => MasterSyncCubit(
        _FakeDeviceRepository(
          syncError: const NetworkFailure('Tidak dapat terhubung ke server.'),
          masterEmpty: true,
        ),
      ),
      act: (MasterSyncCubit c) => c.sync(),
      expect: () => <Matcher>[
        isA<MasterSyncDownloading>(),
        isA<MasterSyncFailure>().having(
          (MasterSyncFailure f) => f.hasLocalData,
          'hasLocalData',
          isFalse,
        ),
      ],
    );

    test('syncIfStale melewatkan penarikan bila snapshot masih segar', () async {
      final _FakeDeviceRepository repo = _FakeDeviceRepository();
      final MasterSyncCubit cubit = MasterSyncCubit(repo);

      await cubit.syncIfStale();

      // Endpoint menarik SELURUH katalog tanpa paginasi ([03 §2.2]);
      // memanggilnya tanpa perlu adalah beban nyata bagi outlet besar.
      expect(repo.syncCount, 0);
      await cubit.close();
    });

    test('syncIfStale menarik bila snapshot sudah lewat 12 jam', () async {
      final _FakeDeviceRepository repo =
          _FakeDeviceRepository(masterStale: true);
      final MasterSyncCubit cubit = MasterSyncCubit(repo);

      await cubit.syncIfStale();

      expect(repo.syncCount, 1);
      await cubit.close();
    });
  });

  group('MasterSnapshot', () {
    test('outlet tanpa staff ditandai — kasir tidak akan bisa login', () {
      final MasterSnapshot s = MasterSnapshot(
        staffCount: 0,
        categoryCount: 1,
        productCount: 5,
        syncedAt: DateTime.utc(2026),
      );
      expect(s.hasNoStaff, isTrue);
    });

    test('outlet tanpa produk bukan kondisi error', () {
      final MasterSnapshot s = MasterSnapshot(
        staffCount: 2,
        categoryCount: 0,
        productCount: 0,
        syncedAt: DateTime.utc(2026),
      );
      expect(s.hasNoStaff, isFalse);
      expect(s.hasNoProducts, isTrue);
    });
  });
}
