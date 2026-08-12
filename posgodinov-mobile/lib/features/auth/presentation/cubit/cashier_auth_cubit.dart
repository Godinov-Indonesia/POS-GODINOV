import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/features/auth/domain/entities/cashier_session.dart';
import 'package:posgodinov_mobile/features/auth/domain/repositories/auth_repository.dart';

sealed class CashierAuthState extends Equatable {
  const CashierAuthState();

  @override
  List<Object?> get props => <Object?>[];
}

final class CashierLoggedOut extends CashierAuthState {
  const CashierLoggedOut();
}

final class CashierVerifying extends CashierAuthState {
  const CashierVerifying();
}

final class CashierLoggedIn extends CashierAuthState {
  const CashierLoggedIn(this.session);

  final CashierSession session;

  @override
  List<Object?> get props => <Object?>[session];
}

final class CashierAuthFailure extends CashierAuthState {
  const CashierAuthFailure(this.message);

  final String message;

  @override
  List<Object?> get props => <Object?>[message];
}

/// P-03 — login kasir, seluruhnya offline.
///
/// Sesi hidup selama aplikasi berjalan dan **tidak dipersistensi**: perangkat
/// yang ditinggalkan menyala semalaman harus meminta PIN lagi keesokan harinya.
class CashierAuthCubit extends Cubit<CashierAuthState> {
  CashierAuthCubit(this._repository) : super(const CashierLoggedOut());

  final AuthRepository _repository;

  /// Pesan kegagalan **disamakan** untuk identifier tidak dikenal maupun PIN
  /// salah. Membedakannya akan memberi tahu penyerang identifier mana yang sah.
  static const String _pesanGagal = 'ID atau PIN salah.';

  CashierSession? get session {
    final CashierAuthState s = state;
    return s is CashierLoggedIn ? s.session : null;
  }

  Future<void> login({
    required String staffIdentifier,
    required String pin,
  }) async {
    // Mencegah ketukan ganda memicu dua isolate bcrypt sekaligus.
    if (state is CashierVerifying) return;

    if (staffIdentifier.trim().isEmpty || pin.isEmpty) {
      emit(const CashierAuthFailure(_pesanGagal));
      return;
    }

    emit(const CashierVerifying());

    final CashierSession? session = await _repository.login(
      staffIdentifier: staffIdentifier,
      pin: pin,
    );

    emit(
      session == null
          ? const CashierAuthFailure(_pesanGagal)
          : CashierLoggedIn(session),
    );
  }

  /// Ganti kasir — dipanggil dari StatusBar dan P-14.
  ///
  /// Shift yang sedang terbuka **tidak** ikut ditutup: pergantian kasir di
  /// tengah shift adalah hal biasa di outlet, dan menutup shift secara otomatis
  /// akan memaksa hitung laci di waktu yang tidak diinginkan.
  void logout() => emit(const CashierLoggedOut());

  /// Membersihkan pesan kegagalan saat pengguna mulai mengetik lagi.
  void clearError() {
    if (state is CashierAuthFailure) emit(const CashierLoggedOut());
  }
}
