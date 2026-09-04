import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/return_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/security_event_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/shift_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/void_log_dao.dart';
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
    ReturnDao? returnDao,
    VoidLogDao? voidLogDao,
    SecurityEventDao? securityEventDao,
  })  : _db = database,
        _shiftDao = shiftDao,
        _txDao = transactionDao,
        _wasteDao = wasteDao,
        _returnDao = returnDao,
        _voidLogDao = voidLogDao,
        _securityEventDao = securityEventDao;

  final AppDatabase _db;
  final ShiftDao _shiftDao;
  final TransactionDao _txDao;
  final WasteDao _wasteDao;

  /// DAO entitas v2 — opsional, sejalan dengan [SyncEngine].
  final ReturnDao? _returnDao;
  final VoidLogDao? _voidLogDao;
  final SecurityEventDao? _securityEventDao;

  Future<SyncOutcome> reconcile({
    required SentBatch sent,
    required SyncUpResponse response,
    required DateTime now,
  }) async {
    // Seluruh keputusan diambil lebih dulu sebagai fungsi murni, sehingga
    // blok penulisan di bawah tidak lagi memuat percabangan yang bisa salah.
    final ReconcileDecision d =
        ReconcileDecision.from(sent: sent, response: response);

    // ── KARANTINA ([11 §4.3]) ─────────────────────────────────────────────
    //
    // Galat per-entitas v2 selalu MENANG atas keputusan agregat di atas: ia
    // lebih spesifik dan membawa alasan yang dapat dibaca kasir. Baris
    // ber-`retryable: false` dikeluarkan dari antrean — bukan dihapus — supaya
    // satu baris cacat permanen berhenti menahan seluruh baris di belakangnya.
    //
    // Respons v1 tidak memuat `errors` sama sekali, sehingga peta ini kosong dan
    // seluruh perilaku lama tetap berlaku apa adanya.
    final Map<String, SyncEntityError> errors = response.errorsByKey;
    int quarantined = 0;

    SyncEntityError? blockerFor(String entity, String id) {
      final SyncEntityError? e = errors['$entity:$id'];
      return e != null && !e.retryable ? e : null;
    }

    await _db.transaction(() async {
      // ── Shift ──────────────────────────────────────────────────────────────
      for (final LocalShift s in sent.shifts) {
        final SyncEntityError? blocker = blockerFor('shift', s.id);
        if (blocker != null) {
          quarantined++;
          await _shiftDao.markQuarantined(
              s.id, now, '${blocker.code}: ${blocker.message}',);
        } else if (d.shiftSynced()) {
          await _shiftDao.markSynced(s.id);
        } else {
          await _shiftDao.markFailed(s.id, now, d.shiftReason()!);
        }
      }

      // ── Transaksi — satu-satunya entitas yang dilacak per-ID ───────────────
      for (final TransactionWithItems t in sent.transactions) {
        final String id = t.transaction.id;
        final SyncEntityError? blocker = blockerFor('transaction', id);
        if (blocker != null) {
          quarantined++;
          await _txDao.markQuarantined(
              id, now, '${blocker.code}: ${blocker.message}',);
        } else if (d.transactionSynced(id)) {
          await _txDao.markSynced(id);
        } else {
          await _txDao.markFailed(id, now, d.transactionReason(id)!);
        }
      }

      // ── Waste ──────────────────────────────────────────────────────────────
      for (final LocalWaste w in sent.wastes) {
        final SyncEntityError? blocker = blockerFor('waste', w.id);
        if (blocker != null) {
          quarantined++;
          await _wasteDao.markQuarantined(
              w.id, now, '${blocker.code}: ${blocker.message}',);
        } else if (d.wasteSynced()) {
          await _wasteDao.markSynced(w.id);
        } else {
          await _wasteDao.markFailed(w.id, now, d.wasteReason()!);
        }
      }

      // ── Entitas v2 — dilacak SEPENUHNYA per-ID ───────────────────────────
      //
      // Tidak ada mode agregat di sini, sehingga tidak ada tebakan: baris tanpa
      // galat berarti diterima.
      final bool returnsOk = response.returnsSynced == sent.returns.length;
      for (final ReturnWithItems r in sent.returns) {
        final String id = r.returnRow.id;
        final SyncEntityError? blocker = blockerFor('return', id);
        if (blocker != null) {
          quarantined++;
          await _returnDao?.markQuarantined(
              id, now, '${blocker.code}: ${blocker.message}',);
        } else if (returnsOk) {
          await _returnDao?.markSynced(id);
        } else {
          await _returnDao?.markFailed(
              id, now, 'Retur belum tersimpan di server.',);
        }
      }

      final bool voidsOk = response.voidLogsSynced == sent.voidLogs.length;
      for (final LocalVoidLog v in sent.voidLogs) {
        final SyncEntityError? blocker = blockerFor('void_log', v.id);
        if (blocker != null) {
          quarantined++;
          await _voidLogDao?.markQuarantined(
              v.id, now, '${blocker.code}: ${blocker.message}',);
        } else if (voidsOk) {
          await _voidLogDao?.markSynced(v.id);
        } else {
          await _voidLogDao?.markFailed(
              v.id, now, 'Log pembatalan belum tersimpan di server.',);
        }
      }

      final bool eventsOk =
          response.securityEventsSynced == sent.securityEvents.length;
      for (final LocalSecurityEvent e in sent.securityEvents) {
        final SyncEntityError? blocker = blockerFor('security_event', e.id);
        if (blocker != null) {
          quarantined++;
          await _securityEventDao?.markQuarantined(
              e.id, now, '${blocker.code}: ${blocker.message}',);
        } else if (eventsOk) {
          await _securityEventDao?.markSynced(e.id);
        } else {
          await _securityEventDao?.markFailed(
              e.id, now, 'Peristiwa keamanan belum tersimpan di server.',);
        }
      }
    });

    return SyncOutcome(
      // Karantina TIDAK membuat putaran dinyatakan gagal. Barisnya memang tidak
      // akan pernah terkirim, dan menandai `ok: false` selamanya akan membuat
      // backoff terus membesar untuk antrean yang sebenarnya sehat.
      ok: d.ok,
      failedTransactionIds: d.failedTransactionIds.toList(growable: false),
      shiftsSynced: response.shiftsSynced,
      transactionsSynced: response.transactionsSynced,
      wastesSynced: response.wastesSynced,
      shiftsSent: sent.shifts.length,
      wastesSent: sent.wastes.length,
      returnsSynced: response.returnsSynced,
      voidLogsSynced: response.voidLogsSynced,
      securityEventsSynced: response.securityEventsSynced,
      quarantined: quarantined,
    );
  }
}
