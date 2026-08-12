import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/features/shift/domain/entities/shift.dart';
import 'package:posgodinov_mobile/features/shift/domain/repositories/shift_repository.dart';
import 'package:posgodinov_mobile/features/shift/domain/shift_math.dart';

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

/// Pratinjau penutupan — kasir melihat angka sebelum memutuskan.
final class ShiftClosing extends ShiftState {
  const ShiftClosing({
    required this.shift,
    required this.expectedBalanceMinor,
    required this.cashSalesMinor,
    required this.nonCashSalesMinor,
    required this.completedCount,
  });

  final Shift shift;

  /// `opening + penjualan tunai` — yang seharusnya ada di laci.
  final int expectedBalanceMinor;

  final int cashSalesMinor;

  /// Informasi saja; **tidak** memengaruhi laci.
  final int nonCashSalesMinor;

  final int completedCount;

  /// Selisih bila kasir memasukkan [closingMinor].
  int discrepancyFor(int closingMinor) => ShiftMath.discrepancy(
        closingBalanceMinor: closingMinor,
        expectedBalanceMinor: expectedBalanceMinor,
      );

  @override
  List<Object?> get props => <Object?>[
        shift,
        expectedBalanceMinor,
        cashSalesMinor,
        nonCashSalesMinor,
        completedCount,
      ];
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

  Future<void> openShift({
    required String staffId,
    required int openingBalanceMinor,
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

  /// Menyiapkan pratinjau P-12: menghitung apa yang **seharusnya** ada di laci
  /// sebelum kasir menghitung uang fisiknya.
  Future<void> prepareClose() async {
    final ShiftState s = state;
    if (s is! ShiftActive) return;

    try {
      final List<CashLine> lines = await _repository.cashLinesOf(s.shift.id);

      emit(
        ShiftClosing(
          shift: s.shift,
          expectedBalanceMinor: ShiftMath.expectedBalance(
            openingBalanceMinor: s.shift.openingBalanceMinor,
            lines: lines,
          ),
          cashSalesMinor: ShiftMath.cashSales(lines),
          nonCashSalesMinor: ShiftMath.nonCashSales(lines),
          completedCount: ShiftMath.completedCount(lines),
        ),
      );
    } on Object catch (e) {
      emit(ShiftFailure('Gagal menghitung kas shift: $e'));
    }
  }

  /// Membatalkan pratinjau dan kembali ke shift berjalan.
  void cancelClose() {
    final ShiftState s = state;
    if (s is ShiftClosing) emit(ShiftActive(s.shift));
  }

  /// Menutup shift.
  ///
  /// [onClosed] dipanggil setelah penulisan berhasil — dipakai memicu
  /// sinkronisasi, momen paling penting karena laci sudah dihitung
  /// ([09 §6.4]).
  Future<void> closeShift({
    required int closingBalanceMinor,
    Future<void> Function()? onClosed,
  }) async {
    final ShiftState s = state;
    if (s is! ShiftClosing) return;

    if (closingBalanceMinor < 0) {
      emit(const ShiftFailure('Uang fisik tidak boleh negatif.'));
      return;
    }

    try {
      final Shift closed = await _repository.close(
        shiftId: s.shift.id,
        closingBalanceMinor: closingBalanceMinor,
      );
      emit(ShiftClosed(closed));
      await onClosed?.call();
    } on Object catch (e) {
      emit(ShiftFailure('Gagal menutup shift: $e'));
    }
  }
}
