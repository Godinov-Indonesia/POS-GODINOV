import 'package:flutter_test/flutter_test.dart';

double calculateStock({
  required double looseQty,
  double? packageQty,
  double? ratio,
}) {
  if (packageQty != null && ratio != null && ratio > 0) {
    return (packageQty * ratio) + looseQty;
  }
  return looseQty;
}

void main() {
  group('Dual-Stock Opname Calculation Tests', () {
    test('Calculates dual-stock (Kemasan Utuh + Eceran Terbuka) correctly', () {
      // 4 Dus Susu UHT (isi 12 Liter) + 2.5 Liter sisa di bar
      final total = calculateStock(
        packageQty: 4,
        ratio: 12.0,
        looseQty: 2.5,
      );
      expect(total, 50.5);
    });

    test('Calculates single-stock (No packaging) correctly', () {
      // 25 Pcs Piring
      final total = calculateStock(looseQty: 25.0);
      expect(total, 25.0);
    });

    test('Handles zero loose quantity when only package is present', () {
      // 3 Ball Gula (isi 20 Kg)
      final total = calculateStock(
        packageQty: 3,
        ratio: 20.0,
        looseQty: 0.0,
      );
      expect(total, 60.0);
    });

    test('Handles zero package quantity when only loose is present', () {
      final total = calculateStock(
        packageQty: 0,
        ratio: 10.0,
        looseQty: 4.25,
      );
      expect(total, 4.25);
    });
  });
}
