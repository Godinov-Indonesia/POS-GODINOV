import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/sync/backoff.dart';

/// `Random` yang selalu mengembalikan 0.5 → jitter tepat nol.
class _NoJitter implements Random {
  @override
  double nextDouble() => 0.5;

  @override
  bool nextBool() => false;

  @override
  int nextInt(int max) => 0;
}

void main() {
  final Backoff jitterFree = Backoff(random: _NoJitter());

  group('Kurva eksponensial', () {
    test('kegagalan pertama menunggu 5 detik', () {
      expect(jitterFree.nextDelay(1), const Duration(seconds: 5));
    });

    test('berlipat dua setiap kegagalan', () {
      expect(jitterFree.nextDelay(2), const Duration(seconds: 10));
      expect(jitterFree.nextDelay(3), const Duration(seconds: 20));
      expect(jitterFree.nextDelay(4), const Duration(seconds: 40));
      expect(jitterFree.nextDelay(5), const Duration(seconds: 80));
    });

    test('berhenti bertambah di 5 menit', () {
      expect(jitterFree.nextDelay(7), const Duration(minutes: 5));
      expect(jitterFree.nextDelay(20), const Duration(minutes: 5));
      // Perangkat yang berhari-hari offline dapat mengumpulkan ratusan
      // kegagalan; pangkat harus dibatasi sebelum menggeser bit.
      expect(jitterFree.nextDelay(500), const Duration(minutes: 5));
    });

    test('nol kegagalan tidak menunda', () {
      expect(jitterFree.nextDelay(0), Duration.zero);
      expect(jitterFree.nextDelay(-3), Duration.zero);
    });
  });

  group('Jitter', () {
    test('tetap dalam ±20 % dari nilai dasar', () {
      const Backoff backoff = Backoff();

      for (int i = 0; i < 200; i++) {
        final Duration d = backoff.nextDelay(3); // dasar 20 detik
        expect(d.inMilliseconds, greaterThanOrEqualTo(16000));
        expect(d.inMilliseconds, lessThanOrEqualTo(24000));
      }
    });

    test('tidak pernah menghasilkan penundaan nol atau negatif', () {
      const Backoff backoff = Backoff();

      for (int failures = 1; failures <= 30; failures++) {
        final Duration d = backoff.nextDelay(failures);
        expect(d.inMilliseconds, greaterThan(0), reason: '$failures');
      }
    });

    test('nilai bervariasi antar-pemanggilan', () {
      // Tanpa variasi, seluruh perangkat dalam satu outlet menyerbu server
      // bersamaan tepat setelah Wi-Fi pulih.
      const Backoff backoff = Backoff();
      final Set<int> hasil = <int>{
        for (int i = 0; i < 50; i++) backoff.nextDelay(4).inMilliseconds,
      };

      expect(hasil.length, greaterThan(1));
    });
  });

  group('Tanpa batas percobaan', () {
    test('selalu mengembalikan penundaan, tidak pernah menyerah', () {
      const Backoff backoff = Backoff();

      // Ini data keuangan. Berapa pun kegagalannya, mesin tetap menjadwalkan
      // percobaan berikutnya ([09 §6.4]).
      for (final int failures in <int>[1, 10, 100, 1000, 100000]) {
        expect(backoff.nextDelay(failures), isA<Duration>());
        expect(
          backoff.nextDelay(failures).inMilliseconds,
          lessThanOrEqualTo(
            (Backoff.maxDelay.inMilliseconds * 1.2).round(),
          ),
        );
      }
    });
  });
}
