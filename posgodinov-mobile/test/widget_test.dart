import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/app.dart';

void main() {
  testWidgets('PosGodinovApp dapat dibangun tanpa bootstrap', (
    WidgetTester tester,
  ) async {
    // `PosGodinovApp` sengaja bebas dependensi asinkron: seluruh perakitan
    // terjadi di `bootstrap.dart`. Uji ini menjaga sifat itu — begitu widget
    // akar mulai membutuhkan basis data, uji ini akan gagal lebih dulu.
    //
    // `home` diisi supaya `AppGate` bawaan tidak ikut dibangun; gerbang itu
    // membaca `getIt` dan memang membutuhkan DI yang sudah dirakit.
    await tester.pumpWidget(
      const PosGodinovApp(home: Scaffold(body: Text('P-01 Binding'))),
    );

    expect(find.text('P-01 Binding'), findsOneWidget);
  });

  testWidgets('tema terpasang dan mode gelap dikunci mati', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      const PosGodinovApp(home: Scaffold(body: SizedBox.shrink())),
    );

    final MaterialApp app = tester.widget<MaterialApp>(
      find.byType(MaterialApp),
    );

    expect(app.themeMode, ThemeMode.light);
    // `darkTheme` tidak pernah didefinisikan ([06 §1.6]): layar kasir dipakai
    // di bawah lampu toko yang terang.
    expect(app.darkTheme, isNull);
  });
}
