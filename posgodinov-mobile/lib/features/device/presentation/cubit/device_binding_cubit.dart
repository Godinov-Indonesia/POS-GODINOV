import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/features/device/domain/entities/device_session.dart';
import 'package:posgodinov_mobile/features/device/domain/repositories/device_repository.dart';

/// State P-01 ([09 §7.1]).
///
/// Memakai `sealed class` + `Equatable`, bukan `freezed`: menghindari satu lagi
/// berkas hasil `build_runner`, sementara `Equatable` sudah memberi kesetaraan
/// yang dibutuhkan bloc untuk melewatkan rebuild yang tidak perlu.
sealed class DeviceBindingState extends Equatable {
  const DeviceBindingState();

  @override
  List<Object?> get props => <Object?>[];
}

final class BindingIdle extends DeviceBindingState {
  const BindingIdle();
}

final class BindingSubmitting extends DeviceBindingState {
  const BindingSubmitting();
}

final class BindingSuccess extends DeviceBindingState {
  const BindingSuccess(this.session);

  final DeviceSession session;

  @override
  List<Object?> get props => <Object?>[session];
}

final class BindingFailure extends DeviceBindingState {
  const BindingFailure(this.message);

  /// Pesan server **apa adanya** — sudah berbahasa Indonesia ([03 §0]).
  final String message;

  @override
  List<Object?> get props => <Object?>[message];
}

/// P-01 — pemasangan perangkat, dijalankan **sekali seumur pemasangan**.
class DeviceBindingCubit extends Cubit<DeviceBindingState> {
  DeviceBindingCubit(this._repository) : super(const BindingIdle());

  final DeviceRepository _repository;

  Future<void> submit({
    required String serialBusiness,
    required String serialOutlet,
    required String password,
  }) async {
    if (state is BindingSubmitting) return; // cegah ketukan ganda

    final String business = serialBusiness.trim();
    final String outlet = serialOutlet.trim();

    // Validasi klien menghemat satu perjalanan jaringan, tetapi TIDAK
    // menggantikan validasi server — pesan server tetap yang ditampilkan bila
    // ia menolak.
    if (business.isEmpty || outlet.isEmpty || password.isEmpty) {
      emit(
        const BindingFailure(
          'Serial bisnis, serial outlet, dan password wajib diisi.',
        ),
      );
      return;
    }

    emit(const BindingSubmitting());

    try {
      final DeviceSession session = await _repository.bind(
        serialBusiness: business,
        serialOutlet: outlet,
        password: password,
      );
      emit(BindingSuccess(session));
    } on Failure catch (f) {
      emit(BindingFailure(f.message));
    }
  }

  /// Mengembalikan form ke keadaan siap setelah pesan kegagalan dibaca.
  void reset() => emit(const BindingIdle());
}
