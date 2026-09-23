import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';

/// Peran visual tombol.
enum TouchVariant {
  /// Aksi utama — Electric Blue solid. Checkout, Submit, Lanjut.
  primary,

  /// Konfirmasi pembayaran — Emerald solid. `BAYAR TUNAI`, `SELESAIKAN`.
  success,

  /// Destruktif — Merah solid. Void, Hapus, Batalkan.
  ///
  /// Wajib berjarak ≥ [Gap.destructive] dari aksi non-destruktif ([06 §2.2]).
  danger,

  /// Netral bergaris — Batal, Tahan Pesanan.
  secondary,

  /// Tanpa latar — aksi tersier di dalam panel.
  ghost,
}

/// Tombol standar POS.
///
/// **Seluruh tombol aplikasi melewati widget ini.** Bukan karena keseragaman
/// visual semata, melainkan karena tiga jaminan yang mudah hilang bila setiap
/// layar merakit tombolnya sendiri:
///
/// 1. **Tinggi tidak pernah turun di bawah [Touch.standard] (48 dp).**
/// 2. **Umpan balik haptik** pada setiap ketukan — kasir sering menekan sambil
///    melihat pelanggan, bukan melihat layar ([06 §6.3]).
/// 3. **Warna berasal dari Lapis 2**, tidak pernah dari nilai heksadesimal.
class TouchButton extends StatelessWidget {
  const TouchButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = TouchVariant.primary,
    this.height = Touch.primary,
    this.icon,
    this.expand = true,
    this.isLoading = false,
  }) : assert(
          height >= Touch.standard,
          'Target sentuh POS tidak boleh di bawah 48 dp ([06 §2.1]).',
        );

  final String label;

  /// `null` menonaktifkan tombol.
  final VoidCallback? onPressed;

  final TouchVariant variant;

  /// Tinggi dalam dp. Pakai konstanta [Touch], bukan angka lepas.
  final double height;

  final IconData? icon;

  /// `true` membuat tombol memenuhi lebar induknya.
  final bool expand;

  /// Menampilkan spinner dan menonaktifkan tombol.
  ///
  /// Dipakai P-03 saat verifikasi bcrypt berjalan di isolate: ketukan ganda
  /// tidak boleh memicu dua isolate sekaligus ([09 §5.3]).
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final bool enabled = onPressed != null && !isLoading;

    final (Color background, Color foreground, Color? outline) =
        switch (variant) {
      TouchVariant.primary => (tokens.accent, tokens.fgInverse, null),
      TouchVariant.success => (tokens.success, tokens.fgInverse, null),
      TouchVariant.danger => (tokens.danger, tokens.fgInverse, null),
      TouchVariant.secondary => (
          tokens.surface,
          tokens.fg,
          tokens.borderStrong,
        ),
      TouchVariant.ghost => (Colors.transparent, tokens.fgMuted, null),
    };

    final Widget child = isLoading
        ? SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              valueColor: AlwaysStoppedAnimation<Color>(foreground),
            ),
          )
        : Row(
            mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              if (icon != null) ...<Widget>[
                Icon(icon, size: 22),
                const SizedBox(width: Gap.sm),
              ],
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: PosText.buttonLg,
                ),
              ),
            ],
          );

    return SizedBox(
      height: height,
      width: expand ? double.infinity : null,
      child: FilledButton(
        onPressed: enabled
            ? () {
                HapticFeedback.selectionClick();
                onPressed!();
              }
            : null,
        style: FilledButton.styleFrom(
          backgroundColor: background,
          foregroundColor: foreground,
          disabledBackgroundColor: tokens.bgMuted,
          disabledForegroundColor: tokens.fgSubtle,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: Gap.lg),
          // Menjamin batas bawah walau pemanggil mengecilkan `height`.
          minimumSize: const Size(Touch.standard, Touch.standard),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Radii.md),
            side: outline == null
                ? BorderSide.none
                : BorderSide(color: outline),
          ),
        ),
        child: child,
      ),
    );
  }
}
