import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/network/clock_skew_monitor.dart';
import 'package:posgodinov_mobile/core/network/connectivity_monitor.dart';
import 'package:posgodinov_mobile/core/sync/sync_engine.dart';
import 'package:posgodinov_mobile/core/sync/sync_models.dart';

class SyncState extends Equatable {
  const SyncState({
    this.isSyncing = false,
    this.pendingCount = 0,
    this.failedCount = 0,
    this.quarantinedCount = 0,
    this.isOnline = false,
    this.skew,
    this.lastError,
    this.lastOutcome,
    this.lastSuccessAt,
  });

  final bool isSyncing;

  /// Transaksi yang belum tersinkron — angka di StatusBar.
  ///
  /// **Tidak** memuat baris berkarantina: baris itu sudah dikeluarkan dari
  /// antrean, dan menghitungnya di sini membuat kasir menunggu antrean yang
  /// tidak akan pernah kosong dengan sendirinya.
  final int pendingCount;

  /// Baris yang gagal tetapi MASIH akan dicoba ulang ([11 §M12.3]).
  final int failedCount;

  /// Baris yang ditolak server secara PERMANEN — **butuh tindakan manusia**.
  final int quarantinedCount;

  /// Antrean yang benar-benar hanya menunggu giliran.
  ///
  /// Dihitung sebagai selisih supaya satu baris tidak pernah muncul di dua
  /// kelompok sekaligus — kasir yang melihat angka yang sama dua kali akan
  /// berhenti mempercayainya.
  int get waitingCount =>
      pendingCount - failedCount < 0 ? 0 : pendingCount - failedCount;

  bool get needsAttention => quarantinedCount > 0;

  final bool isOnline;
  final ClockSkew? skew;

  /// Pesan kegagalan terakhir; `null` bila putaran terakhir bersih.
  final String? lastError;

  final SyncOutcome? lastOutcome;
  final DateTime? lastSuccessAt;

  bool get hasError => lastError != null;

  /// Kegagalan shift hanya terungkap lewat selisih hitungan — tidak ada
  /// `failed_shifts` di respons ([03 §2.3]).
  bool get hasShiftMismatch => lastOutcome?.hasShiftMismatch ?? false;

  bool get hasClockSkew => skew?.exceedsThreshold ?? false;

  /// **Prioritas tampilan StatusBar** bila beberapa kondisi bersamaan
  /// ([06 §4.7.1]): yang paling merugikan bila diabaikan tampil lebih dulu.
  SyncBadge get badge {
    if (needsAttention) return SyncBadge.needsAttention;
    if (hasError || hasShiftMismatch) return SyncBadge.failed;
    if (hasClockSkew) return SyncBadge.clockSkew;
    if (!isOnline) {
      return pendingCount > 0 ? SyncBadge.offlineQueued : SyncBadge.offline;
    }
    if (isSyncing) return SyncBadge.syncing;
    if (pendingCount > 0) return SyncBadge.queued;
    return SyncBadge.synced;
  }

  /// Hitungan antrean untuk StatusBar; `99+` bila melebihi 99 ([06 §2.6]).
  String get pendingLabel => pendingCount > 99 ? '99+' : '$pendingCount';

  SyncState copyWith({
    bool? isSyncing,
    int? pendingCount,
    int? failedCount,
    int? quarantinedCount,
    bool? isOnline,
    ClockSkew? skew,
    String? lastError,
    bool clearError = false,
    SyncOutcome? lastOutcome,
    DateTime? lastSuccessAt,
  }) =>
      SyncState(
        isSyncing: isSyncing ?? this.isSyncing,
        pendingCount: pendingCount ?? this.pendingCount,
        failedCount: failedCount ?? this.failedCount,
        quarantinedCount: quarantinedCount ?? this.quarantinedCount,
        isOnline: isOnline ?? this.isOnline,
        skew: skew ?? this.skew,
        lastError: clearError ? null : (lastError ?? this.lastError),
        lastOutcome: lastOutcome ?? this.lastOutcome,
        lastSuccessAt: lastSuccessAt ?? this.lastSuccessAt,
      );

  @override
  List<Object?> get props => <Object?>[
        isSyncing,
        pendingCount,
        failedCount,
        quarantinedCount,
        isOnline,
        skew,
        lastError,
        lastOutcome,
        lastSuccessAt,
      ];
}

/// Lencana status pada StatusBar, terurut sesuai prioritas tampilan.
enum SyncBadge {
  /// ▲ Ada baris yang **butuh tindakan** — menang atas segalanya, karena hanya
  /// kelompok inilah yang tidak akan beres dengan sendirinya.
  needsAttention,

  /// ▲ `n gagal sinkron`.
  failed,

  /// ▲ Jam perangkat melenceng.
  clockSkew,

  /// ○ Offline dengan antrean menunggu.
  offlineQueued,

  /// ○ Offline, antrean kosong.
  offline,

  /// ◐ Sedang menyinkron.
  syncing,

  /// ● Online dengan antrean menunggu.
  queued,

  /// ● Online, semuanya tersinkron.
  synced,
}

/// P-13 dan indikator StatusBar.
class SyncCubit extends Cubit<SyncState> {
  SyncCubit({
    required SyncEngine engine,
    required TransactionDao transactionDao,
    required ConnectivityMonitor connectivity,
    required ClockSkewMonitor clockSkew,
    DateTime Function()? now,
  })  : _engine = engine,
        _txDao = transactionDao,
        _connectivity = connectivity,
        _clockSkew = clockSkew,
        _now = now ?? DateTime.now,
        super(const SyncState());

  final SyncEngine _engine;
  final TransactionDao _txDao;
  final ConnectivityMonitor _connectivity;
  final ClockSkewMonitor _clockSkew;
  final DateTime Function() _now;

  StreamSubscription<int>? _pendingSub;
  StreamSubscription<int>? _quarantinedSub;
  StreamSubscription<bool>? _onlineSub;
  StreamSubscription<ClockSkew>? _skewSub;

  /// Mulai menyimak antrean, koneksi, dan selisih jam.
  Future<void> observe() async {
    await _cancelAll();

    emit(
      state.copyWith(
        isOnline: _connectivity.lastKnownStatus,
        skew: _clockSkew.current,
      ),
    );

    _pendingSub = _txDao.watchPendingCount().listen(
          (int count) => emit(state.copyWith(pendingCount: count)),
        );
    // Kelompok ketiga P-13 ([11 §M12.3]). Disimak terpisah karena sumbernya
    // kolom yang berbeda, dan karena angkanya harus tetap terlihat walau
    // antrean biasa sudah kosong.
    _quarantinedSub = _txDao.watchQuarantinedCount().listen(
          (int count) => emit(state.copyWith(quarantinedCount: count)),
        );
    _onlineSub = _connectivity.isOnline.listen(
          (bool online) => emit(state.copyWith(isOnline: online)),
        );
    _skewSub = _clockSkew.changes.listen(
          (ClockSkew skew) => emit(state.copyWith(skew: skew)),
        );
  }

  /// Tombol sync manual di P-13.
  ///
  /// **Mengabaikan backoff**: kasir yang menekan tombol ini sedang menunggu, dan
  /// menyuruhnya menunggu lima menit lagi tanpa penjelasan adalah cara pasti
  /// membuat fitur ini tidak dipercaya ([09 §6.4]).
  Future<void> syncNow() => _sync(SyncTrigger.manual, ignoreBackoff: true);

  Future<void> _sync(SyncTrigger trigger, {bool ignoreBackoff = false}) async {
    if (state.isSyncing) return;
    emit(state.copyWith(isSyncing: true, clearError: true));

    try {
      final SyncOutcome outcome =
          await _engine.syncUp(trigger, ignoreBackoff: ignoreBackoff);

      emit(
        state.copyWith(
          isSyncing: false,
          lastOutcome: outcome,
          lastError: outcome.ok ? null : _describe(outcome),
          clearError: outcome.ok,
          lastSuccessAt: outcome.ok ? _now() : null,
        ),
      );
    } on Object catch (e) {
      emit(state.copyWith(isSyncing: false, lastError: e.toString()));
    }
  }

  String _describe(SyncOutcome outcome) {
    if (outcome.error != null) return outcome.error!;

    final List<String> bagian = <String>[];
    if (outcome.failedTransactionIds.isNotEmpty) {
      bagian.add('${outcome.failedTransactionIds.length} transaksi ditolak');
    }
    if (outcome.hasShiftMismatch) {
      bagian.add(
        'shift tersimpan ${outcome.shiftsSynced}/${outcome.shiftsSent}',
      );
    }
    if (outcome.hasWasteMismatch) {
      bagian.add('waste tersimpan ${outcome.wastesSynced}/${outcome.wastesSent}');
    }
    return bagian.isEmpty ? 'Sebagian data belum tersimpan.' : bagian.join(' · ');
  }

  Future<void> _cancelAll() async {
    await _pendingSub?.cancel();
    await _quarantinedSub?.cancel();
    await _onlineSub?.cancel();
    await _skewSub?.cancel();
  }

  @override
  Future<void> close() async {
    await _cancelAll();
    return super.close();
  }
}
