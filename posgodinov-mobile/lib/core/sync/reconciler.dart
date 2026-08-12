import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/shift_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/waste_dao.dart';
import 'package:posgodinov_mobile/core/sync/reconcile_decision.dart';
import 'package:posgodinov_mobile/core/sync/sync_models.dart';

/// Menyelaraskan keadaan lokal dengan jawaban server.
///
/// # Kontrak terpenting di seluruh aplikasi
///
/// **`200` tidak berarti semuanya berhasil** ([03 §2.3]). Endpoint tetap
/// menjawab `200` walau sebagian data ditolak, dan **hanya transaksi yang
/// dilacak per-ID** lewat `failed_transactions`. Kegagalan shift dan waste
/// dilewati server secara diam-diam; selisih hitungan `*_synced` adalah
/// satu-satunya petunjuk yang tersedia.
///
/// # Aturan yang menutup celah paling mahal
///
/// Transaksi memiliki foreign key ke `shifts(id)` dan backend memproses
/// `Shifts → Transactions → Wastes` secara berurutan. Bila sebuah shift gagal
/// tersimpan, **seluruh transaksinya ikut gagal** — tetapi backend tidak
/// memberi tahu shift mana yang gagal.
///
/// Karena itu: bila `shifts_synced` tidak cocok, **tidak satu pun** transaksi
/// dalam batch ini boleh ditandai tersinkron, walau ia tidak muncul di
/// `failed_transactions`. Menandainya di situ adalah cara paling mudah
/// kehilangan data penjualan secara permanen ([09 §6.3]).
class Reconciler {
  const Reconciler({
    required AppDatabase database,
    required ShiftDao shiftDao,
    required TransactionDao transactionDao,
    required WasteDao wasteDao,
  })  : _db = database,
        _shiftDao = shiftDao,
        _txDao = transactionDao,
        _wasteDao = wasteDao;

  final AppDatabase _db;
  final ShiftDao _shiftDao;
  final TransactionDao _txDao;
  final WasteDao _wasteDao;

  Future<SyncOutcome> reconcile({
    required SentBatch sent,
    required SyncUpResponse response,
    required DateTime now,
  }) async {
    // Seluruh keputusan diambil lebih dulu sebagai fungsi murni, sehingga
    // blok penulisan di bawah tidak lagi memuat percabangan yang bisa salah.
    final ReconcileDecision d =
        ReconcileDecision.from(sent: sent, response: response);

    await _db.transaction(() async {
      // ── Shift ──────────────────────────────────────────────────────────────
      for (final LocalShift s in sent.shifts) {
        if (d.shiftSynced()) {
          await _shiftDao.markSynced(s.id);
        } else {
          await _shiftDao.markFailed(s.id, now, d.shiftReason()!);
        }
      }

      // ── Transaksi — satu-satunya entitas yang dilacak per-ID ───────────────
      for (final TransactionWithItems t in sent.transactions) {
        final String id = t.transaction.id;
        if (d.transactionSynced(id)) {
          await _txDao.markSynced(id);
        } else {
          await _txDao.markFailed(id, now, d.transactionReason(id)!);
        }
      }

      // ── Waste ──────────────────────────────────────────────────────────────
      for (final LocalWaste w in sent.wastes) {
        if (d.wasteSynced()) {
          await _wasteDao.markSynced(w.id);
        } else {
          await _wasteDao.markFailed(w.id, now, d.wasteReason()!);
        }
      }
    });

    return SyncOutcome(
      ok: d.ok,
      failedTransactionIds: d.failedTransactionIds.toList(growable: false),
      shiftsSynced: response.shiftsSynced,
      transactionsSynced: response.transactionsSynced,
      wastesSynced: response.wastesSynced,
      shiftsSent: sent.shifts.length,
      wastesSent: sent.wastes.length,
    );
  }
}
