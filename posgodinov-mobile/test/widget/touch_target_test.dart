import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// Membungkus [child] dengan tema aplikasi sungguhan.
///
/// Memakai [AppTheme.build] — bukan `ThemeData()` polos — supaya
/// `context.tokens` benar-benar teruji terpasang.
Widget _wrap(Widget child) {
  return MaterialApp(
    theme: AppTheme.build(),
    home: Scaffold(
      body: Center(
        child: SizedBox(width: 400, child: child),
      ),
    ),
  );
}

void main() {
  group('TouchButton — batas bawah sentuh [06 §2.1]', () {
    testWidgets('tinggi bawaan adalah kelas Utama (64 dp)', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        _wrap(TouchButton(label: 'Bayar', onPressed: () {})),
      );

      final Size size = tester.getSize(find.byType(TouchButton));
      expect(size.height, Touch.primary);
    });

    testWidgets('setiap kelas sentuh merender tinggi yang dijanjikan', (
      WidgetTester tester,
    ) async {
      const Map<String, double> kelas = <String, double>{
        'standard': Touch.standard,
        'frequent': Touch.frequent,
        'primary': Touch.primary,
        'critical': Touch.critical,
      };

      for (final MapEntry<String, double> entry in kelas.entries) {
        await tester.pumpWidget(
          _wrap(
            TouchButton(
              label: entry.key,
              height: entry.value,
              onPressed: () {},
            ),
          ),
        );

        final Size size = tester.getSize(find.byType(TouchButton));
        expect(size.height, entry.value, reason: entry.key);
        // Tidak satu pun kelas boleh turun di bawah batas absolut.
        expect(size.height, greaterThanOrEqualTo(Touch.standard));
      }
    });

    test('tinggi di bawah 48 dp ditolak saat konstruksi', () {
      // Assertion adalah pertahanan paling awal: pelanggaran tertangkap saat
      // menulis kode, bukan saat kasir salah tekan di outlet.
      expect(
        () => TouchButton(label: 'terlalu kecil', height: 40, onPressed: () {}),
        throwsAssertionError,
      );
    });

    testWidgets('tombol nonaktif tetap mempertahankan ukuran sentuh', (
      WidgetTester tester,
    ) async {
      // Ukuran yang menyusut saat nonaktif membuat tata letak bergeser tepat
      // ketika kasir menunggu — misalnya saat verifikasi PIN berjalan.
      await tester.pumpWidget(
        _wrap(const TouchButton(label: 'Nonaktif', onPressed: null)),
      );

      expect(tester.getSize(find.byType(TouchButton)).height, Touch.primary);
    });

    testWidgets('mode memuat menonaktifkan tombol dan menampilkan spinner', (
      WidgetTester tester,
    ) async {
      int ketukan = 0;
      await tester.pumpWidget(
        _wrap(
          TouchButton(
            label: 'Masuk',
            isLoading: true,
            onPressed: () => ketukan++,
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      await tester.tap(find.byType(TouchButton));
      await tester.pump();

      // Ketukan ganda tidak boleh memicu dua isolate bcrypt ([09 §5.3]).
      expect(ketukan, 0);
    });
  });

  group('MoneyText — tipografi keuangan [06 §2.4]', () {
    testWidgets('memakai monospace dengan angka tabular', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(_wrap(const MoneyText(2200000)));

      final Text text = tester.widget<Text>(find.byType(Text));
      expect(text.style?.fontFamily, FontFamilies.mono);
      expect(
        text.style?.fontFeatures,
        contains(const FontFeature.tabularFigures()),
      );
    });

    testWidgets('merender sen sebagai Rupiah tanpa desimal', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(_wrap(const MoneyText(2200000)));
      expect(find.text('Rp 22.000'), findsOneWidget);
    });

    testWidgets('nol tampil sebagai Rp 0', (WidgetTester tester) async {
      await tester.pumpWidget(_wrap(const MoneyText(0)));
      expect(find.text('Rp 0'), findsOneWidget);
    });

    testWidgets('signed menampilkan tanda + untuk selisih shift lebih', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          const MoneyText(
            1500000,
            tone: MoneyTone.success,
            signed: true,
          ),
        ),
      );

      expect(find.text('+Rp 15.000'), findsOneWidget);
    });

    testWidgets('ukuran terbesar dipakai untuk total modal bayar', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        _wrap(const MoneyText(7000000, size: MoneySize.xxl)),
      );

      final Text text = tester.widget<Text>(find.byType(Text));
      expect(text.style?.fontSize, 40);
    });

    testWidgets('nominal tidak pernah dipotong menjadi dua baris', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(_wrap(const MoneyText(12345678900)));

      final Text text = tester.widget<Text>(find.byType(Text));
      expect(text.maxLines, 1);
      expect(text.softWrap, isFalse);
    });
  });
}
