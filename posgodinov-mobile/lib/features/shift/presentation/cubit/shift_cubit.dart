import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/features/shift/domain/entities/shift.dart';
import 'package:posgodinov_mobile/features/shift/domain/repositories/shift_repository.dart';

sealed class ShiftState extends Equatable {
  const ShiftState();

  @override
  List<Object?> get props => <Object?>[];
}

/// Belum diketahui — sebelum pembacaan pertama selesai.
final class ShiftUnknown extends ShiftState {
  const ShiftUnknown();
}

final class ShiftNone extends ShiftState {
  const ShiftNone();
}

final class ShiftOpening extends ShiftState {
  const ShiftOpening();
}

final class ShiftActive extends ShiftState {
  const ShiftActive(this.shift);

  final Shift shift;

  @override
  List<Object?> get props => <Object?>[shift];
}

/// Layar tutup shift sedang terbuka — **Blind Closing**, butir 9
/// ([11 §M15.3]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// STATE INI SENGAJA HAMPIR KOSONG
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Versi sebelumnya bernama "pratinjau penutupan" dan membawa
/// `expectedBalanceMinor`, `cashSalesMinor`, `nonCashSalesMinor`,
/// `completedCount`, serta `discrepancyFor()`. Kelimanya **dihapus**, bukan
/// disembunyikan dari UI — state yang masih menyimpannya akan dibaca lagi oleh
/// orang berikutnya yang ingin "membantu kasir mencocokkan".
///
/// Yang tersisa hanyalah shift yang sedang ditutup, karena layar hanya perlu
/// tahu milik siapa dan sejak jam berapa.
final class ShiftClosing extends ShiftState {
  const ShiftClosing({required this.shift});

  final Shift shift;

  @override
  List<Object?> get props => <Object?>[shift];
}

final class ShiftClosed extends ShiftState {
  const ShiftClosed(this.shift);

  final Shift shift;

  @override
  List<Object?> get props => <Object?>[shift];
}

final class ShiftFailure extends ShiftState {
  const ShiftFailure(this.message);

  final String message;

  @override
  List<Object?> get props => <Object?>[message];
}

/// P-04 — buka shift. Penutupan shift (P-12) menyusul pada M7.
class ShiftCubit extends Cubit<ShiftState> {
  ShiftCubit(this._repository) : super(const ShiftUnknown());

  final ShiftRepository _repository;
  StreamSubscription<Shift?>? _watch;

  /// Mulai menyimak shift berjalan.
  ///
  /// Memakai stream Drift agar StatusBar dan gerbang navigasi selalu melihat
  /// keadaan yang sama — tanpa perlu memanggil ulang secara manual.
  Future<void> observe() async {
    await _watch?.cancel();
    _watch = _repository.watchOpenShift().listen(
      (Shift? shift) {
        // Jangan menimpa state sementara pembukaan atau penutupan berjalan —
        // stream Drift akan memancar tepat di tengah keduanya.
        if (state is ShiftOpening ||
            state is ShiftClosing ||
            state is ShiftClosed) {
          return;
        }
        emit(shift == null ? const ShiftNone() : ShiftActive(shift));
      },
      onError: (Object e) => emit(ShiftFailure('Gagal membaca shift: $e')),
    );
  }

  /// Membuka shift.
  ///
  /// [masterDataVersion] dan [deviceId] datang dari gerbang butir 10/12 —
  /// lihat `ShiftRepository.open`.
  Future<void> openShift({
    required String staffId,
    required int openingBalanceMinor,
    required int? masterDataVersion,
    required String deviceId,
    bool blindClose = true,
  }) async {
    if (state is ShiftOpening) return;

    if (openingBalanceMinor < 0) {
      emit(const ShiftFailure('Modal awal tidak boleh negatif.'));
      return;
    }

    emit(const ShiftOpening());

    try {
      final Shift shift = await _repository.open(
        staffId: staffId,
        openingBalanceMinor: openingBalanceMinor,
        masterDataVersion: masterDataVersion,
        deviceId: deviceId,
        blindClose: blindClose,
      );
      emit(ShiftActive(shift));
    } on Object catch (e) {
      // Kegagalan menulis shift berarti basis data bermasalah — kasir tidak
      // boleh melanjutkan berjualan tanpa induk transaksi.
      emit(ShiftFailure('Gagal membuka shift: $e'));
    }
  }

  @override
  Future<void> close() async {
    await _watch?.cancel();
    return super.close();
  }

  /// Membuka layar tutup shift.
  ///
  /// ⚠️ **Tidak menghitung apa pun.** Namanya pun berubah dari `prepareClose`:
  /// "prepare" menyiratkan ada yang disiapkan, dan yang dulu disiapkan adalah
  /// persis angka yang butir 9 larang dilihat kasir.
  ///
  /// Yang tersisa hanyalah perpindahan state, dan itu tidak dapat gagal —
  /// karena itu tidak ada lagi jalur `ShiftFailure` di sini.
  void beginClose() {
    final ShiftState s = state;
    if (s is! ShiftActive) return;
    emit(ShiftClosing(shift: s.shift));
  }

  /// Membatalkan pratinjau dan kembali ke shift berjalan.
  void cancelClose() {
    final ShiftState s = state;
    if (s is ShiftClosing) emit(ShiftActive(s.shift));
  }

  /// Menandai shift tertutup **setelah** `CloseShiftSaga` menyelesaikan
  /// penulisannya ([11 §M15.4]).
  ///
  /// Ada karena saga hidup di lapisan domain dan tidak boleh menyentuh Cubit
  /// presentasi, sementara layar tetap perlu berpindah ke tampilan konfirmasi.
  /// Namanya sengaja panjang dan spesifik: siapa pun yang tergoda memanggilnya
  /// dari tempat lain akan lebih dulu membaca bahwa ia HANYA sah setelah saga.
  ///
  /// ⚠️ Tidak menulis apa pun ke basis data. Memanggilnya tanpa saga akan
  /// membuat UI mengaku shift tertutup padahal barisnya masih `OPEN`.
  void markClosedAfterSaga() {
    final ShiftState s = state;
    if (s is! ShiftClosing) return;
    emit(ShiftClosed(s.shift));
  }

  /// Menutup shift — **Blind Closing**, butir 9.
  ///
  /// Tiga angka deklarasi masuk; nol angka dihitung. Nol adalah nilai yang SAH
  /// untuk EDC dan QRIS: outlet yang tidak menerima keduanya sepanjang shift
  /// memang tidak punya angka untuk dideklarasikan.
  ///
  /// [onClosed] dipanggil setelah penulisan berhasil — dipakai memicu
  /// sinkronisasi, momen paling penting karena laci sudah dihitung
  /// ([09 §6.4]).
  Future<void> closeShift({
    required int declaredCashMinor,
    required int declaredEdcMinor,
    required int declaredQrisMinor,
    bool blindClose = true,
    String? closedBy,
    Future<void> Function()? onClosed,
  }) async {
    final ShiftState s = state;
    if (s is! ShiftClosing) return;

    if (declaredCashMinor < 0 || declaredEdcMinor < 0 || declaredQrisMinor < 0) {
      emit(const ShiftFailure('Nilai deklarasi tidak boleh negatif.'));
      return;
    }

    try {
      final Shift closed = await _repository.close(
        shiftId: s.shift.id,
        declaredCashMinor: declaredCashMinor,
        declaredEdcMinor: declaredEdcMinor,
        declaredQrisMinor: declaredQrisMinor,
        blindClose: blindClose,
        closedBy: closedBy,
      );
      emit(ShiftClosed(closed));
      await onClosed?.call();
    } on Object catch (e) {
      emit(ShiftFailure('Gagal menutup shift: $e'));
    }
  }
}
