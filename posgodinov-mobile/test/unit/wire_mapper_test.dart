import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/sync/wire_mapper.dart';
import 'package:posgodinov_mobile/core/sync/sync_models.dart';

final DateTime _openedAt = DateTime.utc(2026, 8, 10, 1);
final DateTime _createdAt = DateTime.utc(2026, 8, 10, 3, 22, 11);

LocalShift _shift({
  ShiftStatus status = ShiftStatus.closed,
  bool synced = false,
}) =>
    LocalShift(
      id: '9f8e7d6c-1111-4222-8333-444455556666',
      staffId: '550e8400-e29b-41d4-a716-446655440000',
      openingBalanceMinor: 20000000, // Rp 200.000
      closingBalanceMinor: 145000000, // Rp 1.450.000
      expectedBalanceMinor: 145000000,
      discrepancyMinor: 0,
      status: status,
      clientOpenedAt: _openedAt,
      clientClosedAt: DateTime.utc(2026, 8, 10, 14),
      synced: synced,
      syncError: 'kegagalan sebelumnya',
      syncAttempts: 3,
      lastSyncAttemptAt: _createdAt,
    );

TransactionWithItems _tx() => TransactionWithItems(
      transaction: LocalTransaction(
        id: 'aaaa1111-2222-4333-8444-555566667777',
        shiftId: '9f8e7d6c-1111-4222-8333-444455556666',
        customerName: 'Andi',
        totalAmountMinor: 4400000, // Rp 44.000
        paymentMethod: PaymentSummary.cash,
        status: TransactionStatus.completed,
        cancelNotes: '',
        clientCreatedAt: _createdAt,
        synced: false,
        syncError: 'jangan dikirim',
        syncAttempts: 2,
        lastSyncAttemptAt: _createdAt,
      ),
      items: <LocalTransactionItem>[
        LocalTransactionItem(
          id: 'bbbb1111-2222-4333-8444-555566667777',
          transactionId: 'aaaa1111-2222-4333-8444-555566667777',
          productId: 'uuid-produk',
          productName: 'Kopi Susu Gula Aren',
          quantity: 2,
          unitPriceMinor: 2200000, // Rp 22.000
        ),
      ],
    );

LocalWaste _waste() => LocalWaste(
      id: 'cccc1111-2222-4333-8444-555566667777',
      staffId: '550e8400-e29b-41d4-a716-446655440000',
      productId: 'uuid-produk',
      productName: 'Kopi Susu Gula Aren',
      quantity: 1,
      reason: 'Tumpah saat penyajian',
      clientCreatedAt: _createdAt,
      synced: false,
      syncError: null,
      syncAttempts: 0,
      lastSyncAttemptAt: null,
    );

void main() {
  group('Konversi sen → Rupiah desimal', () {
    test('nominal transaksi dan item dikonversi', () {
      final Map<String, dynamic> json = WireMapper.transaction(_tx());

      // Rp 44.000 disimpan sebagai 4_400_000 sen.
      expect(json['total_amount'], 44000);

      final List<dynamic> items = json['items'] as List<dynamic>;
      expect((items.single as Map<String, dynamic>)['unit_price'], 22000);
    });

    test('keempat nominal shift dikonversi', () {
      final Map<String, dynamic> json = WireMapper.shift(_shift());

      expect(json['opening_balance'], 200000);
      expect(json['closing_balance'], 1450000);
      expect(json['expected_balance'], 1450000);
      expect(json['discrepancy'], 0);
    });
  });

  group('Kolom lokal tidak pernah meninggalkan perangkat', () {
    test('transaksi tidak membawa metadata sinkronisasi', () {
      final Map<String, dynamic> json = WireMapper.transaction(_tx());

      for (final String terlarang in <String>[
        'synced',
        'syncError',
        'sync_error',
        'syncAttempts',
        'sync_attempts',
        'lastSyncAttemptAt',
        'last_sync_attempt_at',
      ]) {
        expect(json.containsKey(terlarang), isFalse, reason: terlarang);
      }
    });

    test('shift dan waste juga bersih', () {
      expect(WireMapper.shift(_shift()).containsKey('synced'), isFalse);
      expect(WireMapper.waste(_waste()).containsKey('synced'), isFalse);
    });

    test('item tidak membawa product_name — kolomnya tidak ada di server', () {
      final Map<String, dynamic> json = WireMapper.transaction(_tx());
      final Map<String, dynamic> item =
          (json['items'] as List<dynamic>).single as Map<String, dynamic>;

      expect(item.containsKey('product_name'), isFalse);
      expect(item['product_id'], 'uuid-produk');
    });
  });

  group('business_id / outlet_id tidak dikirim', () {
    test('server menimpanya paksa dari device token', () {
      final Map<String, dynamic> tx = WireMapper.transaction(_tx());
      final Map<String, dynamic> shift = WireMapper.shift(_shift());

      for (final Map<String, dynamic> json in <Map<String, dynamic>>[
        tx,
        shift,
      ]) {
        expect(json.containsKey('business_id'), isFalse);
        expect(json.containsKey('outlet_id'), isFalse);
      }
    });
  });

  group('Kunci payload', () {
    test('koleksi waste bernama `wastes`, BUKAN `product_wastes`', () {
      // Memakai nama yang salah membuat data waste diabaikan server tanpa error
      // apa pun — kegagalan paling senyap yang mungkin terjadi ([03 §2.3]).
      final Map<String, dynamic> body = WireMapper.body(
        shifts: <LocalShift>[_shift()],
        transactions: <TransactionWithItems>[_tx()],
        wastes: <LocalWaste>[_waste()],
      );

      expect(body.containsKey('wastes'), isTrue);
      expect(body.containsKey('product_wastes'), isFalse);
      expect(body.keys.toSet(), <String>{'shifts', 'transactions', 'wastes'});
    });

    test('koleksi kosong tetap dikirim sebagai array kosong', () {
      final Map<String, dynamic> body = WireMapper.body(
        shifts: const <LocalShift>[],
        transactions: const <TransactionWithItems>[],
        wastes: const <LocalWaste>[],
      );

      expect(body['shifts'], isEmpty);
      expect(body['transactions'], isEmpty);
      expect(body['wastes'], isEmpty);
    });
  });

  group('Enum dan waktu', () {
    test('enum dikirim sebagai wireValue huruf besar', () {
      expect(WireMapper.transaction(_tx())['payment_method'], 'CASH');
      expect(WireMapper.transaction(_tx())['status'], 'COMPLETED');
      expect(WireMapper.shift(_shift())['status'], 'CLOSED');
      expect(
        WireMapper.shift(_shift(status: ShiftStatus.open))['status'],
        'OPEN',
      );
    });

    test('waktu dikirim UTC ISO-8601', () {
      final Map<String, dynamic> json = WireMapper.transaction(_tx());
      expect(json['client_created_at'], '2026-08-10T03:22:11.000Z');
    });

    test('shift yang masih terbuka tidak mengirim client_closed_at', () {
      final LocalShift terbuka = LocalShift(
        id: 's1',
        staffId: 'staff-1',
        openingBalanceMinor: 20000000,
        closingBalanceMinor: 0,
        expectedBalanceMinor: 0,
        discrepancyMinor: 0,
        status: ShiftStatus.open,
        clientOpenedAt: _openedAt,
        clientClosedAt: null,
        synced: false,
        syncError: null,
        syncAttempts: 0,
        lastSyncAttemptAt: null,
      );

      expect(
        WireMapper.shift(terbuka).containsKey('client_closed_at'),
        isFalse,
      );
    });
  });

  group('SyncUpResponse', () {
    test('failed_transactions null dinormalkan menjadi []', () {
      final SyncUpResponse r = SyncUpResponse.fromJson(<String, dynamic>{
        'shifts_synced': 1,
        'transactions_synced': 47,
        'wastes_synced': 3,
        'failed_transactions': null,
      });

      expect(r.failedTransactionIds, isEmpty);
      expect(r.transactionsSynced, 47);
    });

    test('field hilang diperlakukan sebagai nol', () {
      final SyncUpResponse r =
          SyncUpResponse.fromJson(const <String, dynamic>{});

      expect(r.shiftsSynced, 0);
      expect(r.transactionsSynced, 0);
      expect(r.wastesSynced, 0);
      expect(r.failedTransactionIds, isEmpty);
    });

    test('daftar id gagal dibaca apa adanya', () {
      final SyncUpResponse r = SyncUpResponse.fromJson(<String, dynamic>{
        'failed_transactions': <dynamic>['a', 'b'],
      });

      expect(r.failedTransactionIds, <String>['a', 'b']);
    });
  });
}
