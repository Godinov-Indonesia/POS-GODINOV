import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/network/clock_skew_monitor.dart';
import 'package:posgodinov_mobile/core/network/interceptors/clock_skew_interceptor.dart';

DateTime _utc(int year, int month, int day, int hour, int minute) =>
    DateTime.utc(year, month, day, hour, minute);

void main() {
  group('ClockSkew', () {
    test('nilai awal belum terukur dan tidak memicu peringatan', () {
      expect(ClockSkew.unknown.isMeasured, isFalse);
      expect(ClockSkew.unknown.exceedsThreshold, isFalse);
    });

    test('selisih di bawah 5 menit tidak memicu peringatan', () {
      final ClockSkew skew = ClockSkew(
        offset: const Duration(minutes: 4, seconds: 59),
        measuredAt: _utc(2026, 8, 12, 10, 0),
      );

      expect(skew.exceedsThreshold, isFalse);
    });

    test('selisih di atas 5 menit memicu peringatan, arah mana pun', () {
      final ClockSkew maju = ClockSkew(
        offset: const Duration(minutes: 6),
        measuredAt: _utc(2026, 8, 12, 10, 0),
      );
      final ClockSkew mundur = ClockSkew(
        offset: const Duration(minutes: -6),
        measuredAt: _utc(2026, 8, 12, 10, 0),
      );

      expect(maju.exceedsThreshold, isTrue);
      expect(mundur.exceedsThreshold, isTrue);
      expect(maju.magnitude, mundur.magnitude);
    });

    test('label peringatan menyebut arah yang benar', () {
      final ClockSkew maju = ClockSkew(
        offset: const Duration(minutes: 12),
        measuredAt: _utc(2026, 8, 12, 10, 0),
      );
      final ClockSkew mundur = ClockSkew(
        offset: const Duration(minutes: -12),
        measuredAt: _utc(2026, 8, 12, 10, 0),
      );

      expect(maju.warningLabel, contains('mendahului'));
      expect(mundur.warningLabel, contains('tertinggal'));
      expect(maju.warningLabel, contains('12 menit'));
    });
  });

  group('ClockSkewMonitor.record', () {
    late ClockSkewMonitor monitor;

    setUp(() => monitor = ClockSkewMonitor());
    tearDown(() => monitor.dispose());

    test('menghitung offset sebagai perangkat dikurangi server', () {
      monitor.record(
        serverUtc: _utc(2026, 8, 12, 10, 0),
        deviceUtc: _utc(2026, 8, 12, 10, 7),
      );

      // Perangkat 7 menit di depan server.
      expect(monitor.current.offset, const Duration(minutes: 7));
      expect(monitor.current.exceedsThreshold, isTrue);
    });

    test('jam perangkat yang tertinggal menghasilkan offset negatif', () {
      monitor.record(
        serverUtc: _utc(2026, 8, 12, 10, 0),
        deviceUtc: _utc(2026, 8, 12, 9, 50),
      );

      expect(monitor.current.offset, const Duration(minutes: -10));
      expect(monitor.current.exceedsThreshold, isTrue);
    });

    test('menormalkan waktu non-UTC sebelum membandingkan', () {
      // Perangkat dengan zona waktu WIB tetapi jam dinding benar.
      final DateTime deviceLocal =
          _utc(2026, 8, 12, 10, 0).toLocal();

      monitor.record(
        serverUtc: _utc(2026, 8, 12, 10, 0),
        deviceUtc: deviceLocal,
      );

      expect(monitor.current.offset.inSeconds, 0);
      expect(monitor.current.exceedsThreshold, isFalse);
    });

    test('memancarkan pengukuran pertama', () async {
      final Future<ClockSkew> first = monitor.changes.first;

      monitor.record(
        serverUtc: _utc(2026, 8, 12, 10, 0),
        deviceUtc: _utc(2026, 8, 12, 10, 0),
      );

      expect((await first).isMeasured, isTrue);
    });

    test('tidak memancarkan ulang untuk pergeseran kecil', () async {
      final List<ClockSkew> emitted = <ClockSkew>[];
      final StreamSubscription<ClockSkew> subscription =
          monitor.changes.listen(emitted.add);
      addTearDown(subscription.cancel);

      // Pengukuran pertama — selalu dipancarkan.
      monitor.record(
        serverUtc: _utc(2026, 8, 12, 10, 0),
        deviceUtc: _utc(2026, 8, 12, 10, 0),
      );
      // Bergeser 5 detik: di bawah ambang emit 30 detik, tidak dipancarkan.
      monitor.record(
        serverUtc: _utc(2026, 8, 12, 10, 1),
        deviceUtc: _utc(2026, 8, 12, 10, 1).add(const Duration(seconds: 5)),
      );

      await Future<void>.delayed(Duration.zero);

      expect(emitted, hasLength(1));
    });

    test('memancarkan saat ambang batas terlampaui', () async {
      final List<ClockSkew> emitted = <ClockSkew>[];
      monitor.changes.listen(emitted.add);

      monitor.record(
        serverUtc: _utc(2026, 8, 12, 10, 0),
        deviceUtc: _utc(2026, 8, 12, 10, 0),
      );
      // Kasir mengubah jam perangkat satu jam ke depan.
      monitor.record(
        serverUtc: _utc(2026, 8, 12, 10, 1),
        deviceUtc: _utc(2026, 8, 12, 11, 1),
      );

      await Future<void>.delayed(Duration.zero);

      expect(emitted, hasLength(2));
      expect(emitted.last.exceedsThreshold, isTrue);
    });
  });

  group('ClockSkewInterceptor.parseHttpDate', () {
    test('mengurai IMF-fixdate yang dikirim net/http Go', () {
      final DateTime? parsed =
          ClockSkewInterceptor.parseHttpDate('Wed, 12 Aug 2026 03:22:11 GMT');

      expect(parsed, isNotNull);
      expect(parsed!.isUtc, isTrue);
      expect(parsed, _utc(2026, 8, 12, 3, 22).add(const Duration(seconds: 11)));
    });

    test('menerima ISO-8601 dari proxy yang tidak baku', () {
      final DateTime? parsed =
          ClockSkewInterceptor.parseHttpDate('2026-08-12T03:22:11Z');

      expect(parsed, isNotNull);
      expect(parsed!.isUtc, isTrue);
    });

    test('mengembalikan null untuk header yang tidak dapat diurai', () {
      // Header aneh tidak boleh menggagalkan permintaan yang isinya sah.
      expect(ClockSkewInterceptor.parseHttpDate('kemarin sore'), isNull);
      expect(ClockSkewInterceptor.parseHttpDate(''), isNull);
    });
  });
}
