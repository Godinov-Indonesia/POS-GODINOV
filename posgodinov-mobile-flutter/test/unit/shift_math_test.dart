import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/features/shift/domain/shift_math.dart';

CashLine _line(
  int rupiah, {
  PaymentMethod method = PaymentMethod.cash,
  TransactionStatus status = TransactionStatus.completed,
}) =>
    CashLine(totalMinor: rupiah * 100, method: method, status: status);

void main() {
  group('expectedBalance — HANYA tunai yang masuk laci', () {
    test('modal awal tanpa transaksi', () {
      expect(
        ShiftMath.expectedBalance(
          openingBalanceMinor: 20000000, // Rp 200.000
          lines: const <CashLine>[],
        ),
        20000000,
      );
    });

    test('penjualan tunai menambah laci', () {
      expect(
        ShiftMath.expectedBalance(
          openingBalanceMinor: 20000000,
          lines: <CashLine>[_line(44000), _line(18000)],
        ),
        26200000, // Rp 262.000
      );
    });

    test('QRIS, debit, dan transfer TIDAK pernah masuk laci', () {
      // Memasukkannya membuat setiap shift tampak kekurangan uang sebesar
      // total pembayaran non-tunai ([04 §A.3]).
      final int hasil = ShiftMath.expectedBalance(
        openingBalanceMinor: 20000000,
        lines: <CashLine>[
          _line(44000),
          _line(100000, method: PaymentMethod.qris),
          _line(250000, method: PaymentMethod.debit),
          _line(500000, method: PaymentMethod.transfer),
        ],
      );

      expect(hasil, 24400000); // hanya modal + Rp 44.000
    });

    test('transaksi CANCELLED dikecualikan — uangnya sudah dikembalikan', () {
      final int hasil = ShiftMath.expectedBalance(
        openingBalanceMinor: 20000000,
        lines: <CashLine>[
          _line(44000),
          _line(99000, status: TransactionStatus.cancelled),
        ],
      );

      expect(hasil, 24400000);
    });

    test('modal Rp 0 sah — sebagian laci dimulai kosong', () {
      expect(
        ShiftMath.expectedBalance(
          openingBalanceMinor: 0,
          lines: <CashLine>[_line(15000)],
        ),
        1500000,
      );
    });

    test('eksak pada 500 transaksi kecil', () {
      final List<CashLine> lines =
          List<CashLine>.generate(500, (_) => _line(3333));

      expect(
        ShiftMath.expectedBalance(openingBalanceMinor: 0, lines: lines),
        166650000, // 500 × Rp 3.333
      );
    });
  });

  group('discrepancy', () {
    test('uang pas menghasilkan nol', () {
      expect(
        ShiftMath.discrepancy(
          closingBalanceMinor: 26200000,
          expectedBalanceMinor: 26200000,
        ),
        0,
      );
    });

    test('kas kurang menghasilkan nilai NEGATIF', () {
      // Inilah tanda yang dibaca pemilik sebagai dugaan kehilangan uang.
      expect(
        ShiftMath.discrepancy(
          closingBalanceMinor: 26000000,
          expectedBalanceMinor: 26200000,
        ),
        -200000, // −Rp 2.000
      );
    });

    test('kas lebih menghasilkan nilai positif', () {
      expect(
        ShiftMath.discrepancy(
          closingBalanceMinor: 26500000,
          expectedBalanceMinor: 26200000,
        ),
        300000,
      );
    });
  });

  group('Rincian yang ditampilkan di P-12', () {
    final List<CashLine> lines = <CashLine>[
      _line(44000),
      _line(18000),
      _line(100000, method: PaymentMethod.qris),
      _line(50000, status: TransactionStatus.cancelled),
    ];

    test('cashSales tidak menyertakan modal awal', () {
      expect(ShiftMath.cashSales(lines), 6200000); // Rp 62.000
    });

    test('nonCashSales dihitung terpisah dan tidak memengaruhi laci', () {
      expect(ShiftMath.nonCashSales(lines), 10000000); // Rp 100.000
    });

    test('completedCount mengabaikan transaksi batal', () {
      expect(ShiftMath.completedCount(lines), 3);
    });

    test('tunai + non-tunai = seluruh penjualan yang selesai', () {
      expect(
        ShiftMath.cashSales(lines) + ShiftMath.nonCashSales(lines),
        16200000, // Rp 162.000
      );
    });
  });
}
