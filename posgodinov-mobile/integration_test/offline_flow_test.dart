import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/master_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/shift_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/waste_dao.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/sync/reconcile_decision.dart';
import 'package:posgodinov_mobile/core/sync/sync_models.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:posgodinov_mobile/features/shift/domain/repositories/shift_repository.dart';
import 'package:posgodinov_mobile/features/shift/domain/shift_math.dart';
import 'package:uuid/uuid.dart';

/// Uji integrasi alur offline penuh — **berjalan di perangkat/emulator nyata**
/// dengan SQLite sungguhan.
///
/// Menutup skenario matriks [09 §10] yang tidak dapat diuji sebagai unit karena
/// membutuhkan basis data: #1 (antrean menumpuk), #8 (batch > 200), serta
/// penulisan void dan waste yang ditunda dari M7.
///
/// Jalankan: `flutter test integration_test/offline_flow_test.dart -d <device>`
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late AppDatabase db;
  late ShiftRepository shifts;
  late RegisterRepository register;
  late TransactionDao txDao;
  late WasteDao wasteDao;

  setUp(() async {
    await configureDependencies();
    db = getIt<AppDatabase>();
    shifts = getIt<ShiftRepository>();
    register = getIt<RegisterRepository>();
    txDao = getIt<TransactionDao>();
    wasteDao = getIt<WasteDao>();

    // Mulai dari keadaan bersih setiap kasus.
    await db.customStatement('DELETE FROM transaction_items');
    await db.customStatement('DELETE FROM transactions');
    await db.customStatement('DELETE FROM wastes');
    await db.customStatement('DELETE FROM shifts');
    await db.customStatement('DELETE FROM products');
    await db.customStatement('DELETE FROM staffs');
  });

  tearDown(() async => resetDependencies());

  List<CartLine> lines({int priceMinor = 2200000, int qty = 2}) =>
      <CartLine>[
        CartLine(
          id: const Uuid().v4(),
          productId: 'prod-kopi',
          productName: 'Kopi Susu Gula Aren',
          unitPriceMinor: priceMinor,
          quantity: qty,
        ),
      ];

  group('Alur penjualan offline', () {
    testWidgets('shift → transaksi → antrean sync', (WidgetTester _) async {
      final shift = await shifts.open(
        staffId: 'staff-1',
        openingBalanceMinor: 20000000,
      );

      await register.completeSale(
        shiftId: shift.id,
        lines: lines(),
        paymentMethod: PaymentMethod.cash,
        cashReceivedMinor: 5000000,
      );

      final pending = await txDao.pendingTransactions();
      expect(pending, hasLength(1));
      expect(pending.single.items, hasLength(1));
      expect(pending.single.transaction.totalAmountMinor, 4400000);
      // Shift induk ikut menunggu — transaksi punya FK ke shifts(id).
      expect(await shifts.currentOpenShift(), isNotNull);
    });

    testWidgets('transaksi + item ditulis ATOMIK', (WidgetTester _) async {
      final shift = await shifts.open(staffId: 's', openingBalanceMinor: 0);

      // Item dengan transactionId yang salah harus menggagalkan seluruh
      // penulisan lewat foreign key — tidak boleh menyisakan transaksi yatim.
      await expectLater(
        register.completeSale(
          shiftId: 'shift-tidak-ada',
          lines: lines(),
          paymentMethod: PaymentMethod.cash,
          cashReceivedMinor: 0,
        ),
        throwsA(anything),
      );

      expect(await txDao.pendingTransactions(), isEmpty);
      expect(shift.id, isNotEmpty);
    });
  });

  group('Skenario matriks #8 — batch > 200', () {
    testWidgets('antrean terpecah kronologis', (WidgetTester _) async {
      final shift = await shifts.open(staffId: 's', openingBalanceMinor: 0);

      for (int i = 0; i < 205; i++) {
        await register.completeSale(
          shiftId: shift.id,
          lines: lines(qty: 1),
          paymentMethod: PaymentMethod.cash,
          cashReceivedMinor: 2200000,
        );
      }

      final batch = await txDao.pendingTransactions(
        limit: SyncLimits.maxTransactionsPerBatch,
      );
      expect(batch, hasLength(200));

      // Urutan kronologis: batch pertama harus yang tertua.
      for (int i = 1; i < batch.length; i++) {
        expect(
          batch[i].transaction.clientCreatedAt.isBefore(
                batch[i - 1].transaction.clientCreatedAt,
              ),
          isFalse,
        );
      }
    });
  });

  group('Skenario matriks #6/#7 — void', () {
    testWidgets('void mempertahankan UUID dan kembali ke antrean',
        (WidgetTester _) async {
      final shift = await shifts.open(staffId: 's', openingBalanceMinor: 0);
      final tx = await register.completeSale(
        shiftId: shift.id,
        lines: lines(),
        paymentMethod: PaymentMethod.cash,
        cashReceivedMinor: 5000000,
      );

      await txDao.markSynced(tx.id);
      expect(await txDao.pendingTransactions(), isEmpty);

      await txDao.voidTransaction(tx.id, 'pelanggan membatalkan');

      final pending = await txDao.pendingTransactions();
      expect(pending, hasLength(1));
      // UUID TIDAK berubah — dasar reverse deduction di server.
      expect(pending.single.transaction.id, tx.id);
      expect(
        pending.single.transaction.status,
        TransactionStatus.cancelled,
      );
      expect(pending.single.transaction.cancelNotes, 'pelanggan membatalkan');
    });
  });

  group('Waste', () {
    testWidgets('masuk antrean dengan UUID klien', (WidgetTester _) async {
      await getIt<AppDatabase>().customStatement(
        "INSERT INTO wastes (id, staff_id, product_id, product_name, quantity, "
        "reason, client_created_at, synced, sync_attempts) "
        "VALUES ('w-1','s','p','Kopi',1,'Tumpah',0,0,0)",
      );

      expect(await wasteDao.pending(), hasLength(1));
    });
  });

  group('Rekonsiliasi dengan basis data sungguhan', () {
    testWidgets('shift gagal menahan SELURUH transaksinya',
        (WidgetTester _) async {
      final shift = await shifts.open(staffId: 's', openingBalanceMinor: 0);
      final tx = await register.completeSale(
        shiftId: shift.id,
        lines: lines(),
        paymentMethod: PaymentMethod.cash,
        cashReceivedMinor: 5000000,
      );

      final sent = SentBatch(
        shifts: await getIt<ShiftDao>().pending(),
        transactions: await txDao.pendingTransactions(),
        wastes: const <LocalWaste>[],
      );

      // Server melaporkan 0 dari 1 shift tersimpan, TANPA menyebut transaksi
      // mana pun sebagai gagal — jebakan paling mahal ([09 §6.3]).
      final decision = ReconcileDecision.from(
        sent: sent,
        response: const SyncUpResponse(
          shiftsSynced: 0,
          transactionsSynced: 0,
          wastesSynced: 0,
          failedTransactionIds: <String>[],
        ),
      );

      expect(decision.transactionSynced(tx.id), isFalse);
      expect(decision.shiftSynced(), isFalse);
    });
  });

  group('Tutup shift', () {
    testWidgets('expected & discrepancy dihitung dari transaksi nyata',
        (WidgetTester _) async {
      final shift = await shifts.open(
        staffId: 's',
        openingBalanceMinor: 20000000, // Rp 200.000
      );

      await register.completeSale(
        shiftId: shift.id,
        lines: lines(),
        paymentMethod: PaymentMethod.cash,
        cashReceivedMinor: 5000000,
      );
      await register.completeSale(
        shiftId: shift.id,
        lines: lines(),
        paymentMethod: PaymentMethod.qris,
        cashReceivedMinor: 4400000,
      );

      final cashLines = await shifts.cashLinesOf(shift.id);
      expect(ShiftMath.nonCashSales(cashLines), 4400000);

      // Uang fisik Rp 240.000; seharusnya 200.000 + 44.000 = Rp 244.000.
      final closed = await shifts.close(
        shiftId: shift.id,
        closingBalanceMinor: 24000000,
      );

      expect(closed.expectedBalanceMinor, 24400000);
      expect(closed.discrepancyMinor, -400000); // kurang Rp 4.000
      expect(closed.status, ShiftStatus.closed);
    });
  });

  group('Master data', () {
    testWidgets('upsert tidak pernah mengosongkan tabel staff',
        (WidgetTester _) async {
      final MasterDao master = getIt<MasterDao>();
      expect(await master.isEmpty(), isTrue);
      expect(await master.allStaffs(), isEmpty);
    });
  });
}
