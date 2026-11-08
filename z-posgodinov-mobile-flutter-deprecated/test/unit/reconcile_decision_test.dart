import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/sync/reconcile_decision.dart';
import 'package:posgodinov_mobile/core/sync/sync_models.dart';

final DateTime _t = DateTime.utc(2026, 8, 12, 10);

LocalShift _shift(String id) => LocalShift(
      id: id,
      staffId: 'staff-1',
      openingBalanceMinor: 0,
      closingBalanceMinor: 0,
      expectedBalanceMinor: 0,
      discrepancyMinor: 0,
      status: ShiftStatus.open,
      clientOpenedAt: _t,
      clientClosedAt: null,
      declaredCashMinor: 0,
      declaredEdcTotalMinor: 0,
      declaredQrisTotalMinor: 0,
      blindClose: false,
      deviceId: 'dev-1',
      quarantined: false,
      synced: false,
      syncError: null,
      syncAttempts: 0,
      lastSyncAttemptAt: null,
    );

TransactionWithItems _tx(String id, {String shiftId = 'shift-1'}) =>
    TransactionWithItems(
      transaction: LocalTransaction(
        id: id,
        shiftId: shiftId,
        customerName: '',
        totalAmountMinor: 100000,
        paymentMethod: PaymentSummary.cash,
        status: TransactionStatus.completed,
        cancelNotes: '',
        clientCreatedAt: _t,
        reprintCount: 0,
        deviceId: 'dev-1',
        quarantined: false,
        synced: false,
        syncError: null,
        syncAttempts: 0,
        lastSyncAttemptAt: null,
      ),
      items: const <LocalTransactionItem>[],
    );

LocalWaste _waste(String id) => LocalWaste(
      id: id,
      staffId: 'staff-1',
      productId: 'p1',
      productName: 'Kopi',
      quantity: 1,
      reason: 'Tumpah',
      clientCreatedAt: _t,
      reasonCode: 'SPILLED',
      deviceId: 'dev-1',
      receiptPrinted: false,
      quarantined: false,
      synced: false,
      syncError: null,
      syncAttempts: 0,
      lastSyncAttemptAt: null,
    );

SentBatch _batch({
  int shifts = 1,
  List<String> txIds = const <String>['tx-1'],
  int wastes = 0,
}) =>
    SentBatch(
      shifts: List<LocalShift>.generate(shifts, (int i) => _shift('shift-$i')),
      transactions: txIds.map(_tx).toList(growable: false),
      wastes: List<LocalWaste>.generate(wastes, (int i) => _waste('w-$i')),
    );

SyncUpResponse _res({
  required int shiftsSynced,
  required int txSynced,
  int wastesSynced = 0,
  List<String> failed = const <String>[],
}) =>
    SyncUpResponse(
      shiftsSynced: shiftsSynced,
      transactionsSynced: txSynced,
      wastesSynced: wastesSynced,
      failedTransactionIds: failed,
    );

void main() {
  group('Jalur bahagia — seluruh hitungan cocok', () {
    final ReconcileDecision d = ReconcileDecision.from(
      sent: _batch(txIds: <String>['tx-1', 'tx-2']),
      response: _res(shiftsSynced: 1, txSynced: 2),
    );

    test('shift ditandai tersinkron', () {
      expect(d.shiftSynced(), isTrue);
      expect(d.shiftReason(), isNull);
    });

    test('seluruh transaksi ditandai tersinkron', () {
      expect(d.transactionSynced('tx-1'), isTrue);
      expect(d.transactionSynced('tx-2'), isTrue);
      expect(d.transactionReason('tx-1'), isNull);
    });

    test('outcome ok', () => expect(d.ok, isTrue));
  });

  group('failed_transactions berisi sebagian ID', () {
    // Matriks uji [09 §10]: "Hanya ID tersebut tetap di antrean; sisanya
    // tertandai."
    final ReconcileDecision d = ReconcileDecision.from(
      sent: _batch(txIds: <String>['tx-1', 'tx-2', 'tx-3']),
      response: _res(
        shiftsSynced: 1,
        txSynced: 2,
        failed: <String>['tx-2'],
      ),
    );

    test('hanya transaksi yang ditolak tetap di antrean', () {
      expect(d.transactionSynced('tx-1'), isTrue);
      expect(d.transactionSynced('tx-2'), isFalse);
      expect(d.transactionSynced('tx-3'), isTrue);
    });

    test('alasan penolakan jelas', () {
      expect(d.transactionReason('tx-2'), contains('Ditolak server'));
      expect(d.transactionReason('tx-1'), isNull);
    });

    test('shift tetap boleh ditandai — hitungannya cocok', () {
      expect(d.shiftSynced(), isTrue);
    });

    test('outcome TIDAK ok', () => expect(d.ok, isFalse));
  });

  group('ATURAN KRITIS — shift gagal menahan SELURUH transaksinya', () {
    // Matriks uji [09 §10]: "Shift gagal, transaksinya ikut dalam batch →
    // TIDAK SATU PUN transaksi ditandai tersinkron."
    //
    // Backend tidak menyebut transaksi ini di `failed_transactions`, karena
    // dari sudut pandangnya transaksi tersebut memang tidak pernah diproses —
    // foreign key ke shift induknya belum ada.
    final ReconcileDecision d = ReconcileDecision.from(
      sent: _batch(shifts: 2, txIds: <String>['tx-1', 'tx-2']),
      response: _res(
        shiftsSynced: 1, // hanya 1 dari 2 shift tersimpan
        txSynced: 0,
        failed: <String>[], // ← kosong! inilah jebakannya
      ),
    );

    test('tidak satu pun shift ditandai — kita tidak tahu mana yang gagal', () {
      expect(d.shiftSynced(), isFalse);
      expect(d.shiftReason(), contains('1/2'));
    });

    test('tidak satu pun transaksi ditandai, walau failed_transactions kosong',
        () {
      expect(d.failedTransactionIds, isEmpty);
      expect(d.transactionSynced('tx-1'), isFalse);
      expect(d.transactionSynced('tx-2'), isFalse);
    });

    test('alasannya menunjuk shift induk, bukan penolakan server', () {
      expect(
        d.transactionReason('tx-1'),
        'Menunggu shift induk tersimpan di server.',
      );
    });

    test('outcome TIDAK ok', () => expect(d.ok, isFalse));
  });

  group('Kombinasi shift gagal DAN transaksi ditolak', () {
    final ReconcileDecision d = ReconcileDecision.from(
      sent: _batch(shifts: 2, txIds: <String>['tx-1', 'tx-2']),
      response: _res(
        shiftsSynced: 1,
        txSynced: 0,
        failed: <String>['tx-1'],
      ),
    );

    test('transaksi yang ditolak memakai alasan penolakan', () {
      expect(d.transactionReason('tx-1'), contains('Ditolak server'));
    });

    test('transaksi lain memakai alasan shift induk', () {
      expect(d.transactionReason('tx-2'), contains('shift induk'));
    });

    test('keduanya sama-sama tetap di antrean', () {
      expect(d.transactionSynced('tx-1'), isFalse);
      expect(d.transactionSynced('tx-2'), isFalse);
    });
  });

  group('Waste', () {
    test('hitungan cocok → seluruh waste ditandai', () {
      final ReconcileDecision d = ReconcileDecision.from(
        sent: _batch(wastes: 3),
        response: _res(shiftsSynced: 1, txSynced: 1, wastesSynced: 3),
      );

      expect(d.wasteSynced(), isTrue);
      expect(d.wasteReason(), isNull);
      expect(d.ok, isTrue);
    });

    test('hitungan tidak cocok → SELURUH batch waste tetap di antrean', () {
      // Backend tidak melacak waste per-ID, jadi tidak ada cara mengetahui
      // mana yang gagal ([03 §2.3]).
      final ReconcileDecision d = ReconcileDecision.from(
        sent: _batch(wastes: 3),
        response: _res(shiftsSynced: 1, txSynced: 1, wastesSynced: 2),
      );

      expect(d.wasteSynced(), isFalse);
      expect(d.wasteReason(), contains('2/3'));
      expect(d.ok, isFalse);
    });

    test('kegagalan waste TIDAK menahan transaksi', () {
      // Waste tidak punya hubungan foreign key dengan transaksi; menahannya
      // hanya akan menunda penjualan tanpa alasan.
      final ReconcileDecision d = ReconcileDecision.from(
        sent: _batch(wastes: 2, txIds: <String>['tx-1']),
        response: _res(shiftsSynced: 1, txSynced: 1, wastesSynced: 0),
      );

      expect(d.transactionSynced('tx-1'), isTrue);
      expect(d.wasteSynced(), isFalse);
    });
  });

  group('Batch tanpa shift', () {
    test('nol shift dikirim dan nol tersimpan tetap dianggap cocok', () {
      // Batch berisi hanya waste tidak boleh dianggap gagal hanya karena
      // tidak ada shift di dalamnya.
      final ReconcileDecision d = ReconcileDecision.from(
        sent: SentBatch(
          shifts: const <LocalShift>[],
          transactions: const <TransactionWithItems>[],
          wastes: <LocalWaste>[_waste('w-1')],
        ),
        response: _res(shiftsSynced: 0, txSynced: 0, wastesSynced: 1),
      );

      expect(d.allShiftsOk, isTrue);
      expect(d.ok, isTrue);
    });
  });

  group('Server melaporkan lebih banyak daripada yang dikirim', () {
    test('hitungan yang tidak masuk akal diperlakukan sebagai tidak cocok', () {
      // Pertahanan terhadap bug server: 2 tersimpan dari 1 yang dikirim berarti
      // ada sesuatu yang tidak kita pahami — jangan menandai apa pun.
      final ReconcileDecision d = ReconcileDecision.from(
        sent: _batch(),
        response: _res(shiftsSynced: 2, txSynced: 1),
      );

      expect(d.shiftSynced(), isFalse);
      expect(d.ok, isFalse);
    });
  });
}
