import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/app_gate.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';

/// Akar aplikasi.
///
/// Sengaja **tanpa dependensi asinkron**: seluruh perakitan terjadi di
/// `bootstrap.dart`, sehingga widget ini dapat dibangun langsung di dalam uji
/// widget tanpa membuka basis data maupun menyentuh kanal platform.
class PosGodinovApp extends StatelessWidget {
  const PosGodinovApp({super.key, this.home});

  /// Layar awal. Bawaannya adalah [AppGate] — gerbang navigasi P-01…P-04
  /// ([09 §8]). Dapat diganti pada pengujian widget.
  final Widget? home;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'POS Godinov',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.build(),
      // Mode gelap DIKUNCI MATI ([06 §1.6]): layar kasir dipakai di bawah lampu
      // toko yang terang, dan mode gelap menurunkan keterbacaan nominal.
      // `darkTheme` sengaja tidak didefinisikan.
      themeMode: ThemeMode.light,

      // ⚠️ `locale` sengaja TIDAK diset ke `id_ID`.
      //
      // MaterialApp hanya menyediakan MaterialLocalizations untuk bahasa
      // Inggris; menyetel locale lain tanpa `flutter_localizations` membuat
      // widget seperti Tooltip dan date picker melempar saat dibuka.
      //
      // Pemformatan Rupiah TIDAK bergantung pada ini — `Money.format` menetapkan
      // locale `id_ID` secara eksplisit di `NumberFormat` ([09 §3.5]).
      //
      // Tambahkan `flutter_localizations` + delegasi bila kelak ada date picker
      // (paling awal dibutuhkan pada layar riwayat P-09).
      home: home ?? const AppGate(),
    );
  }
}
