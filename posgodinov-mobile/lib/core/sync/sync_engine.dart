import 'package:drift/drift.dart' show Value;
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/shift_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/waste_dao.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/core/network/connectivity_monitor.dart';
import 'package:posgodinov_mobile/core/storage/secure_storage_service.dart';
import 'package:posgodinov_mobile/core/sync/backoff.dart';
import 'package:posgodinov_mobile/core/sync/reconciler.dart';
import 'package:posgodinov_mobile/core/sync/sync_models.dart';
import 'package:posgodinov_mobile/core/sync/sync_remote_ds.dart';
import 'package:synchronized/synchronized.dart';

/// Mesin sinkronisasi *sync up* ([09 §6.1]).
class SyncEngine {
  SyncEngine({
    required SyncRemoteDataSource remote,
    required Reconciler reconciler,
    required ShiftDao shiftDao,
    required TransactionDao transactionDao,
    required WasteDao wasteDao,
    required SyncDao syncDao,
    required ConnectivityMonitor connectivity,
    required SecureStorageService storage,
    Backoff backoff = const Backoff(),
    DateTime Function()? now,
  })  : _remote = remote,
        _reconciler = reconciler,
        _shiftDao = shiftDao,
        _txDao = transactionDao,
        _wasteDao = wasteDao,
        _syncDao = syncDao,
        _connectivity = connectivity,
        _storage = storage,
        _backoff = backoff,
        _now = now ?? DateTime.now;

  final SyncRemoteDataSource _remote;
  final Reconciler _reconciler;
  final ShiftDao _shiftDao;
  final TransactionDao _txDao;
  final WasteDao _wasteDao;
  final SyncDao _syncDao;
  final ConnectivityMonitor _connectivity;
  final SecureStorageService _storage;
  final Backoff _backoff;
  final DateTime Function() _now;

  /// Mutex proses. Pengganti Web Locks pada Web POS — di sini cukup satu
  /// isolate karena UI dan WorkManager tidak pernah berbagi isolate ([09 §6.4]).
  final Lock _lock = Lock();

  /// Batas iterasi per pemanggilan.
  ///
  /// Pengaman terhadap kondisi mustahil di mana baris tetap muncul di antrean
  /// setelah ditandai tersinkron; tanpa ini, satu bug DAO akan berubah menjadi
  /// perulangan tanpa akhir yang menghabiskan baterai dan kuota.
  static const int _maxBatchesPerRun = 50;

  /// Menjalankan satu putaran sinkronisasi.
  ///
  /// Aman dipanggil dari mana pun: pemanggilan yang tumpang tindih dilewati,
  /// bukan diantrekan, karena putaran berikutnya akan mengambil sisa antrean.
  Future<SyncOutcome> syncUp(
    SyncTrigger trigger, {
    bool ignoreBackoff = false,
  }) async {
    // Dua pemicu bersamaan — mis. transaksi baru tepat saat timer berkala
    // menyala — tidak boleh mengirim payload yang sama dua kali. Pemanggilan
    // kedua DILEWATI, bukan diantrekan: putaran yang sedang berjalan akan
    // mengambil sisa antrean, dan menumpuk pemanggilan hanya menunda tanpa
    // menambah data terkirim.
    if (_lock.locked) return const SyncOutcome.skip(SyncSkipReason.locked);

    return _lock.synchronized<SyncOutcome>(
      () => _run(trigger, ignoreBackoff: ignoreBackoff),
    );
  }

  Future<SyncOutcome> _run(
    SyncTrigger trigger, {
    required bool ignoreBackoff,
  }) async {
    // Perangkat yang belum di-binding tidak punya token; menembak endpoint POS
    // hanya menghasilkan 401 yang menyesatkan.
    if (!await _storage.hasDeviceToken()) {
      return const SyncOutcome.skip(SyncSkipReason.notBound);
    }

    // Tombol manual di P-13 SELALU mencoba, mengabaikan backoff ([09 §6.4]).
    if (!ignoreBackoff && _now().isBefore(await _syncDao.backoffUntil())) {
      return const SyncOutcome.skip(SyncSkipReason.backoff);
    }

    if (!await _connectivity.checkOnline) {
      return const SyncOutcome.skip(SyncSkipReason.offline);
    }

    SyncOutcome aggregate = const SyncOutcome(ok: true);
    bool sentAnything = false;

    for (int i = 0; i < _maxBatchesPerRun; i++) {
      final SentBatch batch = await _collectBatch();
      if (batch.isEmpty) break;

      sentAnything = true;
      final DateTime startedAt = _now();

      final SyncUpResponse response;
      try {
        response = await _remote.syncUp(
          shifts: batch.shifts,
          transactions: batch.transactions,
          wastes: batch.wastes,
        );
      } on Failure catch (f) {
        await _recordFailure(f, trigger, batch, startedAt);
        return aggregate.merge(SyncOutcome.failure(f.message));
      }

      final SyncOutcome outcome = await _reconciler.reconcile(
        sent: batch,
        response: response,
        now: _now(),
      );
      aggregate = aggregate.merge(outcome);

      await _writeLog(trigger, batch, outcome, startedAt, error: null);

      // Berhenti bila ada yang gagal — sisa antrean menunggu backoff selesai.
      if (!outcome.ok) break;

      // Antrean transaksi habis bila batch terakhir belum penuh.
      if (batch.transactions.length < SyncLimits.maxTransactionsPerBatch) break;
    }

    if (!sentAnything) return const SyncOutcome.skip(SyncSkipReason.empty);

    if (aggregate.ok) await _syncDao.clearBackoff(_now());
    return aggregate;
  }

  /// Menyusun satu batch.
  ///
  /// **ATURAN KRITIS** ([09 §6.1]): sertakan shift induk **setiap** transaksi
  /// dalam batch, walau shift itu sudah pernah ditandai tersinkron.
  ///
  /// `transactions.shift_id` memiliki FK ke `shifts(id)` dan backend memproses
  /// `Shifts → Transactions → Wastes` ([03 §2.3]). Kegagalan shift tidak
  /// dilaporkan per-ID, sehingga sebuah shift bisa saja tidak pernah benar-benar
  /// tersimpan meski kita menandainya tersinkron. Menyertakannya ulang bersifat
  /// aman: upsert backend idempotent dan hanya menyentuh kolom penutupan.
  Future<SentBatch> _collectBatch() async {
    final List<TransactionWithItems> transactions =
        await _txDao.pendingTransactions(
      limit: SyncLimits.maxTransactionsPerBatch,
    );
    final List<LocalWaste> wastes = await _wasteDao.pending();

    final List<LocalShift> unsynced = await _shiftDao.pending();
    final Set<String> parentIds = transactions
        .map((TransactionWithItems t) => t.transaction.shiftId)
        .toSet();
    final List<LocalShift> parents = await _shiftDao.byIds(parentIds);

    // Dedup berdasarkan id — sebuah shift dapat muncul di kedua daftar.
    final Map<String, LocalShift> byId = <String, LocalShift>{
      for (final LocalShift s in unsynced) s.id: s,
      for (final LocalShift s in parents) s.id: s,
    };

    return SentBatch(
      shifts: byId.values.toList(growable: false),
      transactions: transactions,
      wastes: wastes,
    );
  }

  Future<void> _recordFailure(
    Failure failure,
    SyncTrigger trigger,
    SentBatch batch,
    DateTime startedAt,
  ) async {
    final DateTime now = _now();
    final int failures = await _syncDao.consecutiveFailures() + 1;

    await _syncDao.recordFailure(now, _backoff.nextDelay(failures));
    await _writeLog(
      trigger,
      batch,
      const SyncOutcome(ok: false),
      startedAt,
      error: failure.message,
    );
  }

  Future<void> _writeLog(
    SyncTrigger trigger,
    SentBatch batch,
    SyncOutcome outcome,
    DateTime startedAt, {
    required String? error,
  }) async {
    await _syncDao.writeLog(
      SyncLogsCompanion.insert(
        trigger: trigger.name,
        startedAt: startedAt,
        durationMs: _now().difference(startedAt).inMilliseconds,
        shiftsSent: Value<int>(batch.shifts.length),
        transactionsSent: Value<int>(batch.transactions.length),
        wastesSent: Value<int>(batch.wastes.length),
        shiftsSynced: Value<int>(outcome.shiftsSynced),
        transactionsSynced: Value<int>(outcome.transactionsSynced),
        wastesSynced: Value<int>(outcome.wastesSynced),
        failedTransactionIds:
            Value<String>(outcome.failedTransactionIds.join(',')),
        ok: Value<bool>(outcome.ok),
        error: Value<String?>(error),
      ),
    );
  }
}
