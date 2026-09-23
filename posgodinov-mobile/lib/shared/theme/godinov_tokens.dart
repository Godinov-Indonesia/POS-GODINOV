import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_colors.dart';

/// **LAPIS 2 — token semantik** ([06 §1.3] / [09 §3.3]).
///
/// Inilah satu-satunya lapisan warna yang boleh disentuh widget. Aturan
/// mutlaknya:
///
/// - Widget memakai `context.tokens.accent`, **bukan** `GodinovColors.blue600`
///   dan **bukan** `Theme.of(context).primaryColor`.
/// - `Color(0xFF…)` hanya boleh muncul di `godinov_colors.dart`; aturan
///   `no_raw_palette_outside_theme` di `import_lint.yaml` menolak impor Lapis 1
///   dari dalam `lib/features/**`.
///
/// Konsekuensinya: menyesuaikan kontras atau melakukan *rebranding* adalah
/// perubahan satu berkas, bukan perburuan literal di ratusan widget.
@immutable
class GodinovTokens extends ThemeExtension<GodinovTokens> {
  const GodinovTokens({
    required this.bg,
    required this.bgMuted,
    required this.surface,
    required this.surfaceInverse,
    required this.border,
    required this.borderStrong,
    required this.borderInverse,
    required this.fg,
    required this.fgMuted,
    required this.fgSubtle,
    required this.fgInverse,
    required this.brand,
    required this.accent,
    required this.accentHover,
    required this.accentSubtle,
    required this.info,
    required this.success,
    required this.successText,
    required this.successSubtle,
    required this.warning,
    required this.warningText,
    required this.warningSubtle,
    required this.danger,
    required this.dangerHover,
    required this.dangerSubtle,
    required this.focusRing,
  });

  // ── Permukaan ──────────────────────────────────────────────────────────────

  /// Kanvas aplikasi.
  final Color bg;

  /// Panel keranjang, header tabel, area numpad.
  final Color bgMuted;

  /// Kartu, tile, modal, baris keranjang.
  final Color surface;

  /// StatusBar POS, sidebar Admin.
  final Color surfaceInverse;

  // ── Garis ──────────────────────────────────────────────────────────────────

  final Color border;
  final Color borderStrong;
  final Color borderInverse;

  // ── Teks ───────────────────────────────────────────────────────────────────

  final Color fg;
  final Color fgMuted;
  final Color fgSubtle;
  final Color fgInverse;

  // ── Identitas & aksi ───────────────────────────────────────────────────────

  final Color brand;
  final Color accent;
  final Color accentHover;
  final Color accentSubtle;
  final Color info;

  // ── Status ─────────────────────────────────────────────────────────────────

  final Color success;

  /// **Teks hijau di atas latar terang.**
  ///
  /// `emerald700`, bukan `emerald600`: hanya varian ini yang lolos kontras AA
  /// pada latar `slate50` ([06 §1.5]). Memakai [success] untuk teks adalah
  /// kesalahan aksesibilitas yang paling sering terjadi.
  final Color successText;

  final Color successSubtle;

  final Color warning;
  final Color warningText;
  final Color warningSubtle;

  final Color danger;
  final Color dangerHover;
  final Color dangerSubtle;

  final Color focusRing;

  /// Satu-satunya set token yang dipakai aplikasi.
  ///
  /// **Mode gelap dikunci mati untuk POS** ([06 §1.6]): layar kasir dipakai di
  /// bawah lampu toko yang terang, dan mode gelap menurunkan keterbacaan
  /// nominal. Karena itu tidak ada varian `dark`.
  static const GodinovTokens light = GodinovTokens(
    bg: GodinovColors.slate50,
    bgMuted: GodinovColors.slate100,
    surface: GodinovColors.white,
    surfaceInverse: GodinovColors.navy950,
    border: GodinovColors.slate200,
    borderStrong: GodinovColors.slate300,
    borderInverse: GodinovColors.navy800,
    fg: GodinovColors.navy950,
    fgMuted: GodinovColors.slate600,
    fgSubtle: GodinovColors.slate500,
    fgInverse: GodinovColors.white,
    brand: GodinovColors.navy950,
    accent: GodinovColors.blue600,
    accentHover: GodinovColors.blue700,
    accentSubtle: GodinovColors.blue50,
    info: GodinovColors.cyan600,
    success: GodinovColors.emerald600,
    successText: GodinovColors.emerald700,
    successSubtle: GodinovColors.emerald50,
    warning: GodinovColors.amber600,
    warningText: GodinovColors.amber700,
    warningSubtle: GodinovColors.amber50,
    danger: GodinovColors.red600,
    dangerHover: GodinovColors.red700,
    dangerSubtle: GodinovColors.red50,
    focusRing: GodinovColors.blue600,
  );

  @override
  GodinovTokens copyWith({
    Color? bg,
    Color? bgMuted,
    Color? surface,
    Color? surfaceInverse,
    Color? border,
    Color? borderStrong,
    Color? borderInverse,
    Color? fg,
    Color? fgMuted,
    Color? fgSubtle,
    Color? fgInverse,
    Color? brand,
    Color? accent,
    Color? accentHover,
    Color? accentSubtle,
    Color? info,
    Color? success,
    Color? successText,
    Color? successSubtle,
    Color? warning,
    Color? warningText,
    Color? warningSubtle,
    Color? danger,
    Color? dangerHover,
    Color? dangerSubtle,
    Color? focusRing,
  }) {
    return GodinovTokens(
      bg: bg ?? this.bg,
      bgMuted: bgMuted ?? this.bgMuted,
      surface: surface ?? this.surface,
      surfaceInverse: surfaceInverse ?? this.surfaceInverse,
      border: border ?? this.border,
      borderStrong: borderStrong ?? this.borderStrong,
      borderInverse: borderInverse ?? this.borderInverse,
      fg: fg ?? this.fg,
      fgMuted: fgMuted ?? this.fgMuted,
      fgSubtle: fgSubtle ?? this.fgSubtle,
      fgInverse: fgInverse ?? this.fgInverse,
      brand: brand ?? this.brand,
      accent: accent ?? this.accent,
      accentHover: accentHover ?? this.accentHover,
      accentSubtle: accentSubtle ?? this.accentSubtle,
      info: info ?? this.info,
      success: success ?? this.success,
      successText: successText ?? this.successText,
      successSubtle: successSubtle ?? this.successSubtle,
      warning: warning ?? this.warning,
      warningText: warningText ?? this.warningText,
      warningSubtle: warningSubtle ?? this.warningSubtle,
      danger: danger ?? this.danger,
      dangerHover: dangerHover ?? this.dangerHover,
      dangerSubtle: dangerSubtle ?? this.dangerSubtle,
      focusRing: focusRing ?? this.focusRing,
    );
  }

  /// Tidak ada interpolasi: hanya ada satu tema, dan transisi warna antar-tema
  /// tidak pernah terjadi.
  @override
  GodinovTokens lerp(ThemeExtension<GodinovTokens>? other, double t) {
    if (other is! GodinovTokens) return this;
    return t < 0.5 ? this : other;
  }
}
