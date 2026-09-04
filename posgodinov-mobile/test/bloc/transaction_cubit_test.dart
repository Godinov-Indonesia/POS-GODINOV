import 'dart:typed_data';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/sale_transaction.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/transaction_cubit.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/tender_draft.dart';

const List<CartLine> _lines = <CartLine>[
  CartLine(
    id: 'item-uuid-1',
    productId: 'prod-1',
    productName: 'Kopi Susu Gula Aren',
    unitPriceMinor: 2200000,
    quantity: 2,
  ),
];

const int _total = 4400000; // Rp 44.000

class _FakeRegisterRepository implements RegisterRepository {
  _FakeRegisterRepository({this.shouldThrow = false});

  final bool shouldThrow;
  int saveCount = 0;
  List<CartLine>? savedLines;

  /// Butir 5 — tidak dipakai uji ini; `TransactionCubit` tidak pernah
  /// membatalkan baris keranjang ([11 §M13.4]).
  @override
  Future<void> recordCartLineVoid({
    required String shiftId,
    required String staffId,
    required CartLine line,
    required int quantityBefore,
    required int quantityAfter,
    required String reasonCode,
    required String reasonNotes,
    String? authorizedBy,
    String cashierName = '',
    String? authorizedByName,
  }) async {}

  /// Tender yang diterima pemanggil terakhir — dipakai uji M17.2.
  List<TenderDraft> savedTenders = const <TenderDraft>[];

  @override
  Future<SaleTransaction> completeSale({
    required String shiftId,
    required List<CartLine> lines,
    required PaymentMethod paymentMethod,
    required int cashReceivedMinor,
    String customerName = '',
    List<TenderDraft> tenders = const <TenderDraft>[],
  }) async {
    saveCount++;
    if (shouldThrow) throw StateError('disk penuh');
    savedLines = lines;
    savedTenders = tenders;

    return SaleTransaction(
      // UUID v4 penuh, bukan 'tx-uuid-1': `SaleTransaction.shortId` mengambil
      // 8 karakter pertama setelah tanda hubung dibuang, dan id pendek buatan
      // membuatnya melempar RangeError — kegagalan fixture, bukan kegagalan alur.
      id: 'aaaa1111-2222-4333-8444-555566667777',
      shiftId: shiftId,
      lines: lines,
      totalAmountMinor: _total,
      // Ringkasan mengikuti jumlah tender — sama seperti implementasi
      // sesungguhnya ([11 §M17.2]).
      paymentMethod: tenders.length > 1
          ? PaymentSummary.split
          : PaymentSummary.fromPaymentMethod(paymentMethod),
      status: TransactionStatus.completed,
      clientCreatedAt: DateTime.utc(2026, 8, 12, 10, 30),
      cashReceivedMinor: cashReceivedMinor,
    );
  }
}

class _FakePrinter implements ReceiptPrinter {
  _FakePrinter({this.succeeds = true});

  final bool succeeds;
  int printCount = 0;

  @override
  PrinterKind get kind => PrinterKind.btClassic;

  @override
  Future<bool> isAvailable() async => succeeds;

  @override
  Future<bool> printReceipt(ReceiptData data) async {
    printCount++;
    return succeeds;
  }

  @override
  Future<bool> printBytes(Uint8List bytes) async => succeeds;

  @override
  Stream<PrinterStatus> get status => const Stream<PrinterStatus>.empty();
}

TransactionCubit _build({
  _FakeRegisterRepository? repo,
  _FakePrinter? printer,
}) =>
    TransactionCubit(
      repository: repo ?? _FakeRegisterRepository(),
      printer: printer ?? _FakePrinter(),
      outletName: 'Outlet Sudirman',
    );

void main() {
  group('Transisi state machine', () {
    blocTest<TransactionCubit, TransactionState>(
      'idle → selectingPayment → confirming',
      build: _build,
      act: (TransactionCubit c) {
        c.startPayment(_total);
        c.selectMethod(PaymentMethod.cash);
      },
      expect: () => <Matcher>[
        isA<TxSelectingPayment>(),
        isA<TxConfirming>(),
      ],
    );

    blocTest<TransactionCubit, TransactionState>(
      'total nol tidak membuka pembayaran',
      build: _build,
      act: (TransactionCubit c) => c.startPayment(0),
      expect: () => <Matcher>[],
    );

    blocTest<TransactionCubit, TransactionState>(
      'confirmPayment dari state tidak sah diabaikan',
      // Transisi yang tidak sah tidak boleh menyimpan apa pun.
      build: _build,
      act: (TransactionCubit c) => c.confirmPayment(
        shiftId: 's1',
        cashierName: 'Siti',
        lines: _lines,
      ),
      expect: () => <Matcher>[],
    );
  });

  group('Metode pembayaran', () {
    test('non-tunai mengunci nominal sama dengan total', () {
      final TransactionCubit c = _build();
      c.startPayment(_total);
      c.selectMethod(PaymentMethod.qris);

      final TxConfirming s = c.state as TxConfirming;
      expect(s.cashReceivedMinor, _total);
      expect(s.changeMinor, 0);
      expect(s.isPayable, isTrue);
    });

    test('tunai dimulai dari nol dan belum dapat diselesaikan', () {
      final TransactionCubit c = _build();
      c.startPayment(_total);
      c.selectMethod(PaymentMethod.cash);

      final TxConfirming s = c.state as TxConfirming;
      expect(s.cashReceivedMinor, 0);
      expect(s.isPayable, isFalse);
    });

    test('setCashReceived diabaikan pada metode non-tunai', () {
      final TransactionCubit c = _build();
      c.startPayment(_total);
      c.selectMethod(PaymentMethod.debit);
      c.setCashReceived(9999999);

      expect((c.state as TxConfirming).cashReceivedMinor, _total);
    });

    test('kembalian dihitung eksak', () {
      final TransactionCubit c = _build();
      c.startPayment(_total);
      c.selectMethod(PaymentMethod.cash);
      c.setCashReceived(5000000); // Rp 50.000

      expect((c.state as TxConfirming).changeMinor, 600000); // Rp 6.000
    });
  });

  group('confirmPayment — urutan yang tidak boleh ditukar', () {
    test('menyimpan DULU, baru mencetak', () async {
      final _FakeRegisterRepository repo = _FakeRegisterRepository();
      final _FakePrinter printer = _FakePrinter();
      final TransactionCubit c = _build(repo: repo, printer: printer);

      c.startPayment(_total);
      c.selectMethod(PaymentMethod.cash);
      c.setCashReceived(5000000);
      await c.confirmPayment(
        shiftId: 's1',
        cashierName: 'Siti',
        lines: _lines,
      );

      expect(repo.saveCount, 1);
      expect(printer.printCount, 1);
      expect(c.state, isA<TxCompleted>());
      await c.close();
    });

    test('KEGAGALAN CETAK TIDAK membatalkan transaksi', () async {
      // Ini kesalahan paling mahal yang mungkin terjadi: uang sudah diterima,
      // dan printer bermasalah bukan alasan menghilangkan penjualan
      // ([09 §7.3]).
      final _FakeRegisterRepository repo = _FakeRegisterRepository();
      final TransactionCubit c = _build(
        repo: repo,
        printer: _FakePrinter(succeeds: false),
      );

      c.startPayment(_total);
      c.selectMethod(PaymentMethod.cash);
      c.setCashReceived(_total);
      await c.confirmPayment(
        shiftId: 's1',
        cashierName: 'Siti',
        lines: _lines,
      );

      expect(repo.saveCount, 1, reason: 'transaksi tetap tersimpan');
      expect(c.state, isA<TxCompleted>());
      expect((c.state as TxCompleted).printOk, isFalse);
      await c.close();
    });

    test('kegagalan MENYIMPAN adalah satu-satunya yang membatalkan', () async {
      final TransactionCubit c = _build(
        repo: _FakeRegisterRepository(shouldThrow: true),
      );

      c.startPayment(_total);
      c.selectMethod(PaymentMethod.cash);
      c.setCashReceived(_total);
      await c.confirmPayment(
        shiftId: 's1',
        cashierName: 'Siti',
        lines: _lines,
      );

      expect(c.state, isA<TxFailed>());
      await c.close();
    });

    test('UUID baris keranjang dipertahankan apa adanya', () async {
      // Meregenerasi UUID saat menyimpan akan merusak idempotensi backend
      // ([03 §2.3]).
      final _FakeRegisterRepository repo = _FakeRegisterRepository();
      final TransactionCubit c = _build(repo: repo);

      c.startPayment(_total);
      c.selectMethod(PaymentMethod.cash);
      c.setCashReceived(_total);
      await c.confirmPayment(
        shiftId: 's1',
        cashierName: 'Siti',
        lines: _lines,
      );

      expect(repo.savedLines!.single.id, 'item-uuid-1');
      await c.close();
    });

    test('uang kurang menolak penyelesaian', () async {
      final _FakeRegisterRepository repo = _FakeRegisterRepository();
      final TransactionCubit c = _build(repo: repo);

      c.startPayment(_total);
      c.selectMethod(PaymentMethod.cash);
      c.setCashReceived(1000000); // kurang
      await c.confirmPayment(
        shiftId: 's1',
        cashierName: 'Siti',
        lines: _lines,
      );

      expect(repo.saveCount, 0);
      await c.close();
    });

    test('keranjang kosong tidak pernah tersimpan', () async {
      final _FakeRegisterRepository repo = _FakeRegisterRepository();
      final TransactionCubit c = _build(repo: repo);

      c.startPayment(_total);
      c.selectMethod(PaymentMethod.cash);
      c.setCashReceived(_total);
      await c.confirmPayment(
        shiftId: 's1',
        cashierName: 'Siti',
        lines: const <CartLine>[],
      );

      expect(repo.saveCount, 0);
      await c.close();
    });
  });

  group('reprint', () {
    test('mencetak ulang transaksi yang sudah tersimpan', () async {
      final _FakePrinter printer = _FakePrinter(succeeds: false);
      final TransactionCubit c = _build(printer: printer);

      c.startPayment(_total);
      c.selectMethod(PaymentMethod.cash);
      c.setCashReceived(_total);
      await c.confirmPayment(
        shiftId: 's1',
        cashierName: 'Siti',
        lines: _lines,
      );
      await c.reprint();

      expect(printer.printCount, 2);
      expect(c.state, isA<TxCompleted>());
      await c.close();
    });
  });

  group('SaleTransaction', () {
    test('shortId adalah 8 karakter pertama UUID, huruf besar', () {
      final SaleTransaction tx = SaleTransaction(
        id: 'aaaa1111-2222-4333-8444-555566667777',
        shiftId: 's1',
        lines: _lines,
        totalAmountMinor: _total,
        paymentMethod: PaymentSummary.cash,
        status: TransactionStatus.completed,
        clientCreatedAt: _fixedDate,
      );

      expect(tx.shortId, 'AAAA1111');
    });

    test('metode non-tunai tidak menghasilkan kembalian', () {
      final SaleTransaction tx = SaleTransaction(
        id: 'x',
        shiftId: 's1',
        lines: _lines,
        totalAmountMinor: _total,
        paymentMethod: PaymentSummary.qris,
        status: TransactionStatus.completed,
        clientCreatedAt: _fixedDate,
        cashReceivedMinor: _total,
      );

      expect(tx.changeMinor, 0);
    });
  });
}

final DateTime _fixedDate = DateTime.utc(2026, 8, 12, 10, 30);
