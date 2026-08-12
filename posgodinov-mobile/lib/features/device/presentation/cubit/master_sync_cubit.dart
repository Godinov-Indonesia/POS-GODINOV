import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/features/device/domain/entities/master_snapshot.dart';
import 'package:posgodinov_mobile/features/device/domain/repositories/device_repository.dart';

sealed class MasterSyncState extends Equatable {
  const MasterSyncState();

  @override
  List<Object?> get props => <Object?>[];
}

final class MasterSyncIdle extends MasterSyncState {
  const MasterSyncIdle();
}

final class MasterSyncDownloading extends MasterSyncState {
  const MasterSyncDownloading();
}

final class MasterSyncDone extends MasterSyncState {
  const MasterSyncDone(this.snapshot);

  final MasterSnapshot snapshot;

  @override
  List<Object?> get props => <Object?>[snapshot];
}

final class MasterSyncFailure extends MasterSyncState {
  const MasterSyncFailure(this.message, {required this.hasLocalData});

  final String message;

  /// Bila `true`, kasir tetap dapat melanjutkan memakai snapshot lama.
  ///
  /// Inilah inti aplikasi *offline-first*: gagal menarik master data bukan
  /// alasan menghentikan penjualan, selama perangkat masih punya katalog.
  final bool hasLocalData;

  @override
  List<Object?> get props => <Object?>[message, hasLocalData];
}

/// P-02 — penarikan master data ([03 §2.2]).
///
/// > Tidak ada sinkronisasi inkremental (`updated_since` tidak ada di backend);
/// > setiap panggilan menarik **seluruh** data. Karena itu pemicunya dibatasi:
/// > saat binding, saat aplikasi dibuka bila snapshot > 12 jam, dan tombol
/// > manual di P-14 ([04 §A.2]).
class MasterSyncCubit extends Cubit<MasterSyncState> {
  MasterSyncCubit(this._repository) : super(const MasterSyncIdle());

  final DeviceRepository _repository;

  Future<void> sync() async {
    if (state is MasterSyncDownloading) return;

    emit(const MasterSyncDownloading());

    try {
      final MasterSnapshot snapshot = await _repository.syncMasterData();
      emit(MasterSyncDone(snapshot));
    } on Failure catch (f) {
      final bool hasLocal = !await _repository.isMasterDataEmpty();
      emit(MasterSyncFailure(f.message, hasLocalData: hasLocal));
    }
  }

  /// Menarik ulang hanya bila snapshot sudah basi.
  ///
  /// Dipanggil gerbang navigasi saat aplikasi dibuka. Perangkat offline tetap
  /// melanjutkan dengan data lama — kegagalan di sini tidak pernah memblokir.
  Future<void> syncIfStale() async {
    if (await _repository.isMasterDataStale()) {
      await sync();
    } else {
      emit(const MasterSyncIdle());
    }
  }
}
