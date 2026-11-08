import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/printer/printer_manager.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';

class PrinterUiState extends Equatable {
  const PrinterUiState({
    this.status = const PrinterStatus(PrinterState.unavailable),
    this.target,
    this.discovered = const <PrinterTarget>[],
    this.isScanning = false,
  });

  final PrinterStatus status;
  final PrinterTarget? target;
  final List<PrinterTarget> discovered;
  final bool isScanning;

  PrinterState get state => status.state;

  /// `true` bila kasir dapat mencetak sekarang.
  bool get canPrint =>
      state == PrinterState.ready || state == PrinterState.printing;

  /// Label untuk badge StatusBar — matriks 7 keadaan ([09 §4.2]).
  String get label => switch (state) {
        PrinterState.unavailable => 'Printer belum dipasang',
        PrinterState.disconnected => 'Printer terputus',
        PrinterState.connecting => 'Menghubungkan printer…',
        PrinterState.ready => target?.name ?? 'Printer siap',
        PrinterState.printing => 'Mencetak…',
        PrinterState.outOfPaper => 'Kertas habis',
        PrinterState.error => status.message ?? 'Printer bermasalah',
      };

  /// Aksi yang ditawarkan UI untuk keadaan ini.
  String? get actionLabel => switch (state) {
        PrinterState.unavailable => 'Pasang printer',
        PrinterState.disconnected => 'Hubungkan ulang',
        PrinterState.outOfPaper => 'Cetak Ulang',
        PrinterState.error => 'Coba lagi',
        _ => null,
      };

  PrinterUiState copyWith({
    PrinterStatus? status,
    PrinterTarget? target,
    List<PrinterTarget>? discovered,
    bool? isScanning,
  }) =>
      PrinterUiState(
        status: status ?? this.status,
        target: target ?? this.target,
        discovered: discovered ?? this.discovered,
        isScanning: isScanning ?? this.isScanning,
      );

  @override
  List<Object?> get props => <Object?>[status, target, discovered, isScanning];
}

/// Status printer global — dibaca StatusBar dan layar Pengaturan.
class PrinterCubit extends Cubit<PrinterUiState> {
  PrinterCubit(this._manager) : super(const PrinterUiState());

  final PrinterManager _manager;
  StreamSubscription<PrinterStatus>? _sub;

  /// Menyimak status dan memulihkan printer sesi sebelumnya.
  Future<void> observe() async {
    await _sub?.cancel();

    emit(state.copyWith(status: _manager.currentStatus));
    _sub = _manager.status.listen(
      (PrinterStatus s) => emit(state.copyWith(status: s)),
    );

    await _manager.restore();
  }

  Future<void> scan(PrinterKind kind) async {
    if (state.isScanning) return;
    emit(state.copyWith(isScanning: true, discovered: const <PrinterTarget>[]));

    final List<PrinterTarget> hasil = await _manager.discover(kind);
    emit(state.copyWith(isScanning: false, discovered: hasil));
  }

  Future<void> select(PrinterTarget target) async {
    emit(state.copyWith(target: target));
    await _manager.select(target);
  }

  /// Mencoba menghubungkan ulang tanpa mengubah pilihan printer.
  Future<void> retry() async {
    final PrinterTarget? target = state.target;
    if (target != null) await _manager.select(target, persist: false);
  }

  @override
  Future<void> close() async {
    await _sub?.cancel();
    return super.close();
  }
}
