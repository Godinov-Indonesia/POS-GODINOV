import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/features/waste/domain/repositories/waste_repository.dart';

class WasteState extends Equatable {
  const WasteState({
    this.recent = const <WasteEntry>[],
    this.submitting = false,
    this.error,
    this.lastSubmitted,
  });

  final List<WasteEntry> recent;
  final bool submitting;
  final String? error;
  final String? lastSubmitted;

  WasteState copyWith({
    List<WasteEntry>? recent,
    bool? submitting,
    String? error,
    bool clearError = false,
    String? lastSubmitted,
  }) =>
      WasteState(
        recent: recent ?? this.recent,
        submitting: submitting ?? this.submitting,
        error: clearError ? null : (error ?? this.error),
        lastSubmitted: lastSubmitted ?? this.lastSubmitted,
      );

  @override
  List<Object?> get props => <Object?>[recent, submitting, error, lastSubmitted];
}

/// P-11 — lapor waste produk.
class WasteCubit extends Cubit<WasteState> {
  WasteCubit(this._repository) : super(const WasteState());

  final WasteRepository _repository;
  StreamSubscription<List<WasteEntry>>? _sub;

  Future<void> observe() async {
    await _sub?.cancel();
    _sub = _repository.watchRecent().listen(
          (List<WasteEntry> items) => emit(state.copyWith(recent: items)),
        );
  }

  Future<void> submit({
    required String staffId,
    required String productId,
    required String productName,
    required int quantity,
    required String reason,
    Future<void> Function()? onReported,
  }) async {
    if (state.submitting) return;
    emit(state.copyWith(submitting: true, clearError: true));

    try {
      await _repository.report(
        staffId: staffId,
        productId: productId,
        productName: productName,
        quantity: quantity,
        reason: reason,
      );
      emit(state.copyWith(submitting: false, lastSubmitted: productName));
      await onReported?.call();
    } on ArgumentError catch (e) {
      emit(state.copyWith(submitting: false, error: e.message.toString()));
    } on Object catch (e) {
      emit(state.copyWith(submitting: false, error: 'Gagal menyimpan: $e'));
    }
  }

  @override
  Future<void> close() async {
    await _sub?.cancel();
    return super.close();
  }
}
