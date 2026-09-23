import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_colors.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';

/// Nama keluarga font yang **dibundel** di `pubspec.yaml`.
///
/// Font tidak pernah diunduh saat runtime: perangkat kasir kerap di-*binding*
/// lalu langsung dibawa ke outlet tanpa Wi-Fi, dan font pengganti tidak
/// mendukung `tabularFigures` — seluruh aturan tipografi keuangan [06 §2.4]
/// akan gugur diam-diam.
abstract final class FontFamilies {
  static const String sans = 'Inter';
  static const String mono = 'JetBrainsMono';
}

/// Skala tipografi POS ([06 §2.3]).
///
/// Dirancang untuk jarak pandang 50–70 cm, sering sambil berdiri — berbeda dari
/// skala Admin yang dipakai di meja.
///
/// **Batas bawah yang tidak boleh dilanggar:**
/// - Teks apa pun di POS ≥ 14 dp. Tidak ada `fontSize: 11`.
/// - Nominal uang ≥ 16 dp, dan tidak pernah memakai `fgSubtle`.
abstract final class PosText {
  /// Angka pada nominal wajib berlebar tetap — lihat alasan di `MoneyText`.
  static const List<FontFeature> _tabular = <FontFeature>[
    FontFeature.tabularFigures(),
  ];

  /// 40/44 · mono · 700 — total di modal bayar, nominal kembalian.
  static const TextStyle money2xl = TextStyle(
    fontFamily: FontFamilies.mono,
    fontFeatures: _tabular,
    fontSize: 40,
    height: 44 / 40,
    fontWeight: FontWeight.w700,
  );

  /// 28/34 · mono · 700 — total keranjang, saldo shift.
  static const TextStyle moneyXl = TextStyle(
    fontFamily: FontFamilies.mono,
    fontFeatures: _tabular,
    fontSize: 28,
    height: 34 / 28,
    fontWeight: FontWeight.w700,
  );

  /// 22/28 · mono · 600 — subtotal.
  static const TextStyle moneyLg = TextStyle(
    fontFamily: FontFamilies.mono,
    fontFeatures: _tabular,
    fontSize: 22,
    height: 28 / 22,
    fontWeight: FontWeight.w600,
  );

  /// 18/26 · mono · 600 — nominal baris keranjang, harga di tile produk.
  static const TextStyle moneyMd = TextStyle(
    fontFamily: FontFamilies.mono,
    fontFeatures: _tabular,
    fontSize: 18,
    height: 26 / 18,
    fontWeight: FontWeight.w600,
  );

  /// 14/20 · mono · 500 — nominal sekunder, meta.
  static const TextStyle moneySm = TextStyle(
    fontFamily: FontFamilies.mono,
    fontFeatures: _tabular,
    fontSize: 14,
    height: 20 / 14,
    fontWeight: FontWeight.w500,
  );

  /// 22/28 · sans · 600 — label tombol besar.
  static const TextStyle buttonLg = TextStyle(
    fontFamily: FontFamilies.sans,
    fontSize: 22,
    height: 28 / 22,
    fontWeight: FontWeight.w600,
  );

  /// 16/24 · sans · 500 — nama produk, teks dasar, isi input.
  static const TextStyle base = TextStyle(
    fontFamily: FontFamilies.sans,
    fontSize: 16,
    height: 24 / 16,
    fontWeight: FontWeight.w500,
  );

  /// 14/20 · sans · 500 — label, satuan, nama kategori.
  static const TextStyle sm = TextStyle(
    fontFamily: FontFamilies.sans,
    fontSize: 14,
    height: 20 / 14,
    fontWeight: FontWeight.w500,
  );

  /// 12/16 — meta dan timestamp. **Hanya** untuk teks non-esensial.
  static const TextStyle xs = TextStyle(
    fontFamily: FontFamilies.sans,
    fontSize: 12,
    height: 16 / 12,
    fontWeight: FontWeight.w500,
  );

  /// Varian monospace dari [xs] — nomor transaksi, jam.
  static const TextStyle xsMono = TextStyle(
    fontFamily: FontFamilies.mono,
    fontFeatures: _tabular,
    fontSize: 12,
    height: 16 / 12,
    fontWeight: FontWeight.w500,
  );
}

/// Perakit [ThemeData] aplikasi.
abstract final class AppTheme {
  /// Tema terang — satu-satunya tema yang ada ([06 §1.6]).
  static ThemeData build() {
    const GodinovTokens t = GodinovTokens.light;

    final ColorScheme scheme = ColorScheme.fromSeed(
      seedColor: t.accent,
      brightness: Brightness.light,
    ).copyWith(
      surface: t.surface,
      onSurface: t.fg,
      primary: t.accent,
      onPrimary: t.fgInverse,
      error: t.danger,
      onError: t.fgInverse,
      outline: t.border,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: t.bg,
      fontFamily: FontFamilies.sans,
      extensions: const <ThemeExtension<dynamic>>[t],

      // Seluruh kontrol Material mewarisi ukuran sentuh POS, sehingga widget
      // bawaan pun tidak dapat turun di bawah 48 dp secara tidak sengaja.
      materialTapTargetSize: MaterialTapTargetSize.padded,
      visualDensity: VisualDensity.standard,

      textTheme: const TextTheme(
        displayLarge: PosText.money2xl,
        displayMedium: PosText.moneyXl,
        titleLarge: PosText.buttonLg,
        bodyLarge: PosText.base,
        bodyMedium: PosText.sm,
        bodySmall: PosText.xs,
        labelLarge: PosText.base,
      ),

      appBarTheme: const AppBarTheme(
        backgroundColor: GodinovColors.navy950,
        foregroundColor: GodinovColors.white,
        elevation: 0,
        centerTitle: false,
        toolbarHeight: Sizes.statusBarTablet,
      ),

      // ⚠️ `CardThemeData`/`DialogThemeData` adalah tipe Flutter **3.27+**.
      // Pada SDK 3.24–3.26 namanya masih `CardTheme`/`DialogTheme`; bila
      // `flutter analyze` mengeluh di sini, itu tanda SDK terpasang lebih tua
      // daripada yang diasumsikan — turunkan nama tipenya, bukan hapus temanya.
      cardTheme: CardThemeData(
        color: t.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.lg),
          side: const BorderSide(color: GodinovColors.slate200),
        ),
      ),

      dividerTheme: const DividerThemeData(
        color: GodinovColors.slate200,
        thickness: 1,
        space: 1,
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: t.surface,
        // Tinggi minimum input mengikuti kelas sentuh "sering".
        constraints: const BoxConstraints(minHeight: Touch.frequent),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: Gap.lg,
          vertical: Gap.md,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(Radii.md),
          borderSide: const BorderSide(color: GodinovColors.slate300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(Radii.md),
          borderSide: const BorderSide(color: GodinovColors.slate300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(Radii.md),
          borderSide: const BorderSide(color: GodinovColors.blue600, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(Radii.md),
          borderSide: const BorderSide(color: GodinovColors.red600),
        ),
        hintStyle: PosText.base.copyWith(color: t.fgSubtle),
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: t.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.xl),
        ),
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: t.surfaceInverse,
        contentTextStyle: PosText.base.copyWith(color: t.fgInverse),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.md),
        ),
      ),

      // Cincin fokus keyboard ([06 §5.6]) — POS mendukung keyboard fisik.
      focusColor: t.focusRing,
    );
  }
}
