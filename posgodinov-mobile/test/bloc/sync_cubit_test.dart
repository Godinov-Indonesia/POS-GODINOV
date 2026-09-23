import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/network/clock_skew_monitor.dart';
import 'package:posgodinov_mobile/core/sync/sync_models.dart';
import 'package:posgodinov_mobile/features/sync/presentation/cubit/sync_cubit.dart';

/// Membangun state langsung — prioritas lencana adalah logika murni, jadi
/// mengujinya tidak memerlukan basis data maupun jaringan.
SyncState _state({
  bool isSyncing = false,
  int pendingCount = 0,
  bool isOnline = true,
  ClockSkew? skew,
  String? lastError,
  SyncOutcome? lastOutcome,
}) =>
    SyncState(
      isSyncing: isSyncing,
      pendingCount: pendingCount,
      isOnline: isOnline,
      skew: skew,
      lastError: lastError,
      lastOutcome: lastOutcome,
    );

ClockSkew _skew(Duration offset) => ClockSkew(
      offset: offset,
      measuredAt: DateTime.utc(2026, 8, 12, 10),
    );

void main() {
  group('Prioritas lencana StatusBar [06 §4.7.1]', () {
    test('normal: online, antrean kosong', () {
      expect(_state().badge, SyncBadge.synced);
    });

    test('online dengan antrean', () {
      expect(_state(pendingCount: 3).badge, SyncBadge.queued);
    });

    test('sedang menyinkron', () {
      expect(_state(isSyncing: true).badge, SyncBadge.syncing);
    });

    test('offline tanpa antrean', () {
      expect(_state(isOnline: false).badge, SyncBadge.offline);
    });

    test('offline dengan antrean', () {
      expect(
        _state(isOnline: false, pendingCount: 5).badge,
        SyncBadge.offlineQueued,
      );
    });

    test('jam melenceng mengalahkan offline dan antrean', () {
      expect(
        _state(
          isOnline: false,
          pendingCount: 5,
          skew: _skew(const Duration(minutes: 30)),
        ).badge,
        SyncBadge.clockSkew,
      );
    });

    test('kegagalan SELALU menang atas seluruh status lain', () {
      // "Yang paling merugikan bila diabaikan tampil lebih dulu."
      expect(
        _state(
          isSyncing: true,
          isOnline: false,
          pendingCount: 12,
          skew: _skew(const Duration(hours: 1)),
          lastError: 'ditolak server',
        ).badge,
        SyncBadge.failed,
      );
    });

    test('selisih shift memicu lencana gagal walau tanpa pesan error', () {
      // Kegagalan shift hanya terungkap lewat selisih hitungan ([03 §2.3]).
      expect(
        _state(
          lastOutcome: const SyncOutcome(
            ok: false,
            shiftsSynced: 1,
            shiftsSent: 2,
          ),
        ).badge,
        SyncBadge.failed,
      );
    });

    test('skew di bawah ambang tidak memicu apa pun', () {
      expect(
        _state(skew: _skew(const Duration(minutes: 2))).badge,
        SyncBadge.synced,
      );
    });
  });

  group('Label antrean', () {
    test('angka ditampilkan apa adanya sampai 99', () {
      expect(_state(pendingCount: 0).pendingLabel, '0');
      expect(_state(pendingCount: 99).pendingLabel, '99');
    });

    test('lebih dari 99 menjadi 99+', () {
      // [06 §2.6] — angka empat digit merusak lebar StatusBar.
      expect(_state(pendingCount: 100).pendingLabel, '99+');
      expect(_state(pendingCount: 4321).pendingLabel, '99+');
    });
  });

  group('SyncOutcome', () {
    test('selisih hitungan shift terdeteksi', () {
      const SyncOutcome o =
          SyncOutcome(ok: false, shiftsSynced: 1, shiftsSent: 3);

      expect(o.hasShiftMismatch, isTrue);
      expect(o.shouldRetry, isTrue);
    });

    test('hitungan cocok tidak dianggap mismatch', () {
      const SyncOutcome o =
          SyncOutcome(ok: true, shiftsSynced: 3, shiftsSent: 3);

      expect(o.hasShiftMismatch, isFalse);
      expect(o.shouldRetry, isFalse);
    });

    test('merge menjumlahkan beberapa batch dalam satu putaran', () {
      const SyncOutcome a = SyncOutcome(
        ok: true,
        transactionsSynced: 200,
        shiftsSynced: 1,
        shiftsSent: 1,
      );
      const SyncOutcome b = SyncOutcome(
        ok: false,
        transactionsSynced: 47,
        failedTransactionIds: <String>['tx-9'],
        shiftsSynced: 1,
        shiftsSent: 1,
      );

      final SyncOutcome hasil = a.merge(b);

      expect(hasil.transactionsSynced, 247);
      expect(hasil.failedTransactionIds, <String>['tx-9']);
      // Satu batch gagal membuat seluruh putaran tidak ok.
      expect(hasil.ok, isFalse);
    });

    test('skip tidak dianggap kegagalan', () {
      const SyncOutcome o = SyncOutcome.skip(SyncSkipReason.offline);

      expect(o.ok, isTrue);
      expect(o.wasSkipped, isTrue);
      expect(o.shouldRetry, isFalse);
    });
  });
}
