import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/features/register/domain/fast_cash.dart';

/// Rupiah → sen, agar kasus uji terbaca seperti nominal sungguhan.
int _rp(int rupiah) => rupiah * 100;

void main() {
  group('FastCash.smartRoundUps', () {
    test('total Rp 47.000 dibulatkan ke atas ke kelipatan lazim', () {
      final List<int> hasil = FastCash.smartRoundUps(_rp(47000));

      // 5rb → 50rb · 10rb → 50rb · 50rb → 50rb · 100rb → 100rb
      expect(hasil, <int>[_rp(50000), _rp(100000)]);
    });

    test('nilai yang sama dengan total dibuang — itu tugas tombol UANG PAS', () {
      final List<int> hasil = FastCash.smartRoundUps(_rp(50000));
      expect(hasil, isNot(contains(_rp(50000))));
    });

    test('total nol atau negatif tidak menghasilkan preset', () {
      expect(FastCash.smartRoundUps(0), isEmpty);
      expect(FastCash.smartRoundUps(-100), isEmpty);
    });

    test('hasil selalu terurut naik dan lebih besar dari total', () {
      for (final int total in <int>[
        _rp(1),
        _rp(999),
        _rp(12345),
        _rp(87500),
        _rp(1234567),
      ]) {
        final List<int> hasil = FastCash.smartRoundUps(total);
        expect(hasil, orderedEquals(<int>[...hasil]..sort()), reason: '$total');
        for (final int v in hasil) {
          expect(v, greaterThan(total), reason: '$total → $v');
        }
      }
    });

    test('pembagian bilangan bulat tidak meleset pada nominal besar', () {
      // Pembagian ganda `(n / step).ceil()` kehilangan presisi di sini dan
      // dapat menghasilkan preset yang meleset satu Rupiah.
      final int total = _rp(99999999);
      final List<int> hasil = FastCash.smartRoundUps(total);

      for (final int v in hasil) {
        expect(v % _rp(5000) == 0 || v % _rp(10000) == 0 ||
            v % _rp(50000) == 0 || v % _rp(100000) == 0, isTrue,);
      }
    });
  });

  group('FastCash.presets — Lapis 2', () {
    test('maksimal tiga tombol', () {
      expect(FastCash.presets(_rp(1)).length, lessThanOrEqualTo(3));
      expect(FastCash.presets(_rp(123456)).length, lessThanOrEqualTo(3));
    });

    test('tidak menduplikasi pecahan tetap Lapis 3', () {
      final List<int> presets = FastCash.presets(_rp(47000));

      // Rp 50.000 dan Rp 100.000 adalah pecahan tetap, jadi Lapis 2 kosong
      // untuk total ini — dan itu normal ([06 §4.6.3]).
      for (final int denom in FastCash.fixedDenoms) {
        expect(presets, isNot(contains(denom)));
      }
    });

    test('total kecil tetap menghasilkan pilihan yang masuk akal', () {
      final List<int> presets = FastCash.presets(_rp(7500));
      // 5rb → 10rb (bukan pecahan tetap, jadi lolos)
      expect(presets, contains(_rp(10000)));
    });
  });

  group('FastCash.isDenomEnabled — Lapis 3', () {
    test('pecahan di bawah total dinonaktifkan, bukan disembunyikan', () {
      // Posisi tombol yang stabil antar-transaksi membangun memori otot kasir.
      expect(FastCash.isDenomEnabled(_rp(20000), _rp(47000)), isFalse);
      expect(FastCash.isDenomEnabled(_rp(50000), _rp(47000)), isTrue);
      expect(FastCash.isDenomEnabled(_rp(100000), _rp(47000)), isTrue);
    });

    test('pecahan yang sama persis dengan total tetap aktif', () {
      expect(FastCash.isDenomEnabled(_rp(50000), _rp(50000)), isTrue);
    });

    test('ketiga pecahan tetap selalu tersedia sebagai daftar', () {
      // Daftarnya tidak pernah menyusut — hanya keadaan aktifnya yang berubah.
      expect(FastCash.fixedDenoms, hasLength(3));
      expect(
        FastCash.fixedDenoms,
        <int>[_rp(20000), _rp(50000), _rp(100000)],
      );
    });
  });
}
