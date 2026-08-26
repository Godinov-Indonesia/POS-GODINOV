import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/features/auth/domain/entities/cashier_session.dart';
import 'package:posgodinov_mobile/features/auth/domain/repositories/auth_repository.dart';
import 'package:posgodinov_mobile/features/shift/domain/session_lock_guard.dart';

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
  CashierAuthCubit(this._repository, {SessionLockGuard? lockGuard})
      : _lock = lockGuard,
        super(const CashierLoggedOut());

  final AuthRepository _repository;

  /// Penjaga butir 12 ([11 §M15.2]). `null` hanya pada uji yang tidak
  /// mempersoalkan penguncian sesi.
  final SessionLockGuard? _lock;

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

  /// Keluar sesi — **dapat DITOLAK** sejak M15.2 (butir 12).
  ///
  /// ═══════════════════════════════════════════════════════════════════════
  /// MENGAPA INI TIDAK LAGI SEBUAH `void`
  /// ═══════════════════════════════════════════════════════════════════════
  ///
  /// Komentar lama di sini berbunyi: "Shift yang sedang terbuka **tidak** ikut
  /// ditutup: pergantian kasir di tengah shift adalah hal biasa di outlet."
  /// Kalimat itu menjelaskan persis lubang yang butir 12 dibangun untuk
  /// menutupnya. Transaksi kasir berikutnya tercatat pada shift orang
  /// sebelumnya, dan selisih kas yang lahir darinya dituntut dari orang yang
  /// tidak melakukannya.
  ///
  /// Mengembalikan `true` bila sesi benar-benar berakhir. Penolakannya
  /// **dicatat** sebagai `LOGOUT_BLOCKED_ACTIVE_SHIFT` — kasir yang berulang
  /// kali mencoba keluar dengan laci terbuka adalah pola yang layak dilihat
  /// pemilik, dan pada perangkat offline catatan itu ikut antrean sync
  /// (aturan R9).
  Future<bool> requestLogout({String source = 'unknown'}) async {
    final bool blocked = await _lock?.isLocked(source: source) ?? false;
    if (blocked) return false;

    emit(const CashierLoggedOut());
    return true;
  }

  /// Mengakhiri sesi **tanpa memeriksa apa pun**.
  ///
  /// ⛔ Hanya BOLEH dipanggil dari:
  ///   1. `CloseShiftSaga` — setelah shift benar-benar tertulis `CLOSED`
  ///   2. Force Close Shift oleh supervisor — setelah PIN diverifikasi
  ///
  /// Pemanggil ketiga mana pun adalah bug butir 12. Sengaja TIDAK dinamai
  /// `logout`: nama yang netral akan dipanggil dari tombol mana pun oleh orang
  /// yang tidak tahu mengapa gerbangnya ada.
  void clearSession() => emit(const CashierLoggedOut());

  /// Membersihkan pesan kegagalan saat pengguna mulai mengetik lagi.
  void clearError() {
    if (state is CashierAuthFailure) emit(const CashierLoggedOut());
  }
}
