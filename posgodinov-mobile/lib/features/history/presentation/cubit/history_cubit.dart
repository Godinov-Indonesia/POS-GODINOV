import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';
import 'package:posgodinov_mobile/features/history/domain/repositories/history_repository.dart';

class HistoryState extends Equatable {
  const HistoryState({
    this.local = const <HistoryEntry>[],
    this.remote = const <HistoryEntry>[],
    this.loadingRemote = false,
    this.remoteError,
    this.remoteLoaded = false,
  });

  /// Shift berjalan, dari SQLite. Selalu tersedia, termasuk saat offline.
  final List<HistoryEntry> local;

  /// Dari server — maksimal 50 baris ([03 §2.4]).
  final List<HistoryEntry> remote;

  final bool loadingRemote;
  final String? remoteError;
  final bool remoteLoaded;

  HistoryState copyWith({
    List<HistoryEntry>? local,
    List<HistoryEntry>? remote,
    bool? loadingRemote,
    String? remoteError,
    bool clearError = false,
    bool? remoteLoaded,
  }) =>
      HistoryState(
        local: local ?? this.local,
        remote: remote ?? this.remote,
        loadingRemote: loadingRemote ?? this.loadingRemote,
        remoteError: clearError ? null : (remoteError ?? this.remoteError),
        remoteLoaded: remoteLoaded ?? this.remoteLoaded,
      );

  @override
  List<Object?> get props =>
      <Object?>[local, remote, loadingRemote, remoteError, remoteLoaded];
}

/// P-09 dan P-10.
class HistoryCubit extends Cubit<HistoryState> {
  HistoryCubit(this._repository) : super(const HistoryState());

  final HistoryRepository _repository;
  StreamSubscription<List<HistoryEntry>>? _sub;

  Future<void> observe(String shiftId) async {
    await _sub?.cancel();
    _sub = _repository.watchCurrentShift(shiftId).listen(
          (List<HistoryEntry> items) => emit(state.copyWith(local: items)),
        );
  }

  /// Menarik riwayat server. Kegagalan **tidak** mengosongkan tab lokal.
  Future<void> loadRemote() async {
    if (state.loadingRemote) return;
    emit(state.copyWith(loadingRemote: true, clearError: true));

    try {
      final List<HistoryEntry> items = await _repository.fetchFromServer();
      emit(
        state.copyWith(
          remote: items,
          loadingRemote: false,
          remoteLoaded: true,
        ),
      );
    } on Failure catch (f) {
      emit(state.copyWith(loadingRemote: false, remoteError: f.message));
    }
  }

  /// P-10 — membatalkan transaksi.
  Future<void> voidTransaction({
    required String id,
    required String cancelNotes,
    Future<void> Function()? onVoided,
  }) async {
    // `cancel_notes` wajib: pemilik yang melihat transaksi batal di dashboard
    // berhak tahu alasannya ([06 §2.2]).
    if (cancelNotes.trim().isEmpty) return;

    await _repository.voidTransaction(id: id, cancelNotes: cancelNotes.trim());
    await onVoided?.call();
  }

  @override
  Future<void> close() async {
    await _sub?.cancel();
    return super.close();
  }
}
