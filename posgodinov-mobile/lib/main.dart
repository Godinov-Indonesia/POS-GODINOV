import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_colors.dart';

/// PLACEHOLDER FASE M0.
///
/// Entry point sementara yang hanya membuktikan proyek terpasang dan Godinov
/// Palette terbaca. Diganti pada **M1** oleh:
///
///   main.dart      → `runApp(await bootstrap())`
///   bootstrap.dart → buka DB, muat sesi, kunci orientasi, pasang error handler
///   app.dart       → MaterialApp, tema, BlocProvider global
///
/// Lihat `docs/10-flutter-implementation-plan.md` fase M1.
void main() {
  runApp(const PosGodinovApp());
}

class PosGodinovApp extends StatelessWidget {
  const PosGodinovApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'POS Godinov',
      debugShowCheckedModeBanner: false,
      // Mode gelap DIKUNCI MATI untuk POS ([06 §1.6] / [09 §3.3]).
      themeMode: ThemeMode.light,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: GodinovColors.slate50,
        colorScheme: ColorScheme.fromSeed(
          seedColor: GodinovColors.blue600,
          brightness: Brightness.light,
        ),
      ),
      home: const _ScaffoldPlaceholderPage(),
    );
  }
}

/// Satu baris palet pada layar pemeriksa.
class _Swatch {
  const _Swatch(this.name, this.color);

  final String name;
  final Color color;
}

class _ScaffoldPlaceholderPage extends StatelessWidget {
  const _ScaffoldPlaceholderPage();

  static const List<_Swatch> _palette = <_Swatch>[
    _Swatch('Deep Navy', GodinovColors.navy950),
    _Swatch('Electric Blue', GodinovColors.blue600),
    _Swatch('Emerald Green', GodinovColors.emerald600),
    _Swatch('Amber', GodinovColors.amber600),
    _Swatch('Danger Red', GodinovColors.red600),
    _Swatch('Slate Background', GodinovColors.slate50),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: GodinovColors.navy950,
        foregroundColor: GodinovColors.white,
        title: const Text('POS Godinov — scaffold M0'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          const Text(
            'Struktur proyek terbentuk. Fondasi tema, uang, dan DI dikerjakan '
            'pada fase M1 — lihat docs/10-flutter-implementation-plan.md.',
            style: TextStyle(
              fontSize: 16,
              color: GodinovColors.slate600,
            ),
          ),
          const SizedBox(height: 24),
          ..._palette.map(_buildSwatchRow),
        ],
      ),
    );
  }

  Widget _buildSwatchRow(_Swatch swatch) {
    final bool isLight = swatch.color.computeLuminance() > 0.5;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      // 48 dp = Touch.standard, batas bawah absolut ([09 §3.4]).
      height: 48,
      alignment: Alignment.centerLeft,
      decoration: BoxDecoration(
        color: swatch.color,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: GodinovColors.slate200),
      ),
      child: Text(
        swatch.name,
        style: TextStyle(
          color: isLight ? GodinovColors.navy950 : GodinovColors.white,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
