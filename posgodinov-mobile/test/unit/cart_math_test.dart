import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/features/register/domain/cart_math.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/pos_numpad.dart';

CartLine _line({
  required int priceMinor,
  int qty = 1,
  String id = 'l1',
}) =>
    CartLine(
      id: id,
      productId: 'p-$id',
      productName: 'Produk $id',
      unitPriceMinor: priceMinor,
      quantity: qty,
    );

void main() {
  group('CartMath — aritmetika integer sen eksak', () {
    test('keranjang kosong bertotal nol', () {
      expect(CartMath.subtotal(const <CartLine>[]), 0);
      expect(CartMath.total(const <CartLine>[]), 0);
      expect(CartMath.itemCount(const <CartLine>[]), 0);
    });

    test('baris tunggal', () {
      // Rp 22.000 × 2 = Rp 44.000
      final CartLine l = _line(priceMinor: 2200000, qty: 2);
      expect(l.lineTotalMinor, 4400000);
      expect(CartMath.subtotal(<CartLine>[l]), 4400000);
    });

    test('contoh keranjang dari wireframe [06 §3.3]', () {
      final List<CartLine> lines = <CartLine>[
        _line(priceMinor: 2200000, qty: 2, id: 'kopi'), // Rp 44.000
        _line(priceMinor: 1800000, id: 'croissant'), //    Rp 18.000
        _line(priceMinor: 800000, id: 'esteh'), //          Rp  8.000
      ];

      expect(CartMath.subtotal(lines), 7000000); // Rp 70.000
      expect(CartMath.itemCount(lines), 4);
    });

    test('total sama dengan subtotal — tidak ada pajak maupun diskon', () {
      // Backend tidak memiliki konsep keduanya ([03 §14]).
      final List<CartLine> lines = <CartLine>[
        _line(priceMinor: 1234567, qty: 3),
      ];
      expect(CartMath.total(lines), CartMath.subtotal(lines));
    });

    test('tidak ada hanyutan pada 1.000 baris kecil', () {
      // Nominal ganjil yang akan mengakumulasi galat bila dihitung dengan
      // double: 1000 × Rp 33,33 harus tepat Rp 33.330.
      final List<CartLine> lines = List<CartLine>.generate(
        1000,
        (int i) => _line(priceMinor: 3333, id: 'l$i'),
      );
      expect(CartMath.subtotal(lines), 3333000);
    });

    test('nominal sangat besar tetap eksak', () {
      final CartLine l = _line(priceMinor: 99999999900, qty: 9);
      expect(l.lineTotalMinor, 899999999100);
    });
  });

  group('CartMath.change', () {
    test('uang lebih menghasilkan kembalian positif', () {
      expect(
        CartMath.change(totalMinor: 4700000, cashReceivedMinor: 5000000),
        300000, // Rp 3.000
      );
    });

    test('uang pas menghasilkan nol', () {
      expect(
        CartMath.change(totalMinor: 4700000, cashReceivedMinor: 4700000),
        0,
      );
    });

    test('uang kurang menghasilkan nilai negatif', () {
      expect(
        CartMath.change(totalMinor: 4700000, cashReceivedMinor: 2000000),
        -2700000,
      );
      expect(
        CartMath.isCashSufficient(
          totalMinor: 4700000,
          cashReceivedMinor: 2000000,
        ),
        isFalse,
      );
    });
  });

  group('Numpad — sisipan digit dari kanan [06 §4.6.4]', () {
    test('5 → 50 → 50.000 lewat tombol 000', () {
      int v = 0;
      v = appendDigits(v, '5');
      expect(v, 5);
      v = appendDigits(v, '0');
      expect(v, 50);
      v = appendDigits(v, '000');
      expect(v, 50000);
    });

    test('dibatasi 9 digit (Rp 999.999.999)', () {
      int v = 999999999;
      expect(appendDigits(v, '9'), 999999999, reason: 'batas tidak boleh dilewati');

      v = 99999999;
      // '000' akan melewati batas pada digit kedua; digit pertama masih muat.
      expect(appendDigits(v, '000'), 999999990);
    });

    test('backspace menghapus satu digit dari kanan', () {
      expect(removeLastDigit(50000), 5000);
      expect(removeLastDigit(5), 0);
      expect(removeLastDigit(0), 0);
    });
  });
}
