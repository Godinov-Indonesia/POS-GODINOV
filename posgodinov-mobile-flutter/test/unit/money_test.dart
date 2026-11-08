import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';

void main() {
  group('Money.toMinor — batas API masuk', () {
    test('Rupiah bulat dari master data menjadi sen', () {
      // Server mengirim `"price": 22000`.
      expect(Money.toMinor(22000), 2200000);
    });

    test('nol tetap nol', () {
      expect(Money.toMinor(0), 0);
    });

    test('nilai pecahan dibulatkan, bukan dipotong', () {
      // Kolom server DECIMAL(15,2) mengizinkan pecahan walau dalam praktik
      // seluruh harga adalah Rupiah bulat.
      expect(Money.toMinor(22000.5), 2200050);
      expect(Money.toMinor(0.01), 1);
      expect(Money.toMinor(0.005), 1);
    });

    test('tidak kehilangan presisi pada nilai yang rawan float', () {
      // 0.1 + 0.2 != 0.3 pada IEEE-754; pembulatan eksplisit menutup celah itu.
      expect(Money.toMinor(0.1 + 0.2), 30);
      expect(Money.toMinor(1.1), 110);
      expect(Money.toMinor(8.7), 870);
    });
  });

  group('Money.toMajor — batas API keluar', () {
    test('sen menjadi Rupiah desimal', () {
      expect(Money.toMajor(2200000), 22000);
      expect(Money.toMajor(0), 0);
    });

    test('bolak-balik tidak mengubah nilai', () {
      const List<int> nominal = <int>[0, 1, 100, 800000, 2200000, 12345678900];
      for (final int sen in nominal) {
        expect(Money.toMinor(Money.toMajor(sen)), sen, reason: 'sen=$sen');
      }
    });
  });

  group('Money.format — tabel konversi tampilan [06 §2.5]', () {
    test('harga produk standar', () {
      expect(Money.format(2200000), 'Rp 22.000');
    });

    test('nol tampil sebagai Rp 0, bukan tanda hubung', () {
      // Placeholder "-" menciptakan ambiguitas antara "nol" dan "tidak
      // diketahui".
      expect(Money.format(0), 'Rp 0');
    });

    test('total keranjang', () {
      expect(Money.format(4700000), 'Rp 47.000');
    });

    test('kembalian', () {
      expect(Money.format(300000), 'Rp 3.000');
    });

    test('ringkasan besar memakai pemisah ribuan titik', () {
      expect(Money.format(12345678900), 'Rp 123.456.789');
    });

    test('tanpa desimal — sen tidak pernah ditampilkan', () {
      expect(Money.format(2200099), isNot(contains(',')));
      expect(Money.format(2200099), startsWith('Rp '));
    });
  });

  group('Money.format — nilai negatif', () {
    test('memakai minus tipografis U+2212, bukan tanda hubung', () {
      const String minus = '−';
      final String hasil = Money.format(-1500000);

      expect(hasil, '${minus}Rp 15.000');
      expect(
        hasil.contains('-'),
        isFalse,
        reason: 'tanda hubung ASCII dilarang',
      );
    });
  });

  group('Money.formatSigned', () {
    test('positif mendapat tanda + eksplisit — selisih shift lebih', () {
      expect(Money.formatSigned(1500000), '+Rp 15.000');
    });

    test('negatif memakai minus tipografis tanpa tambahan tanda', () {
      final String hasil = Money.formatSigned(-1500000);
      expect(hasil.codeUnitAt(0), 0x2212);
      expect(hasil, endsWith('Rp 15.000'));
    });

    test('nol tidak mendapat tanda apa pun', () {
      expect(Money.formatSigned(0), 'Rp 0');
    });
  });
}
