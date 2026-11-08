import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/core/config/device_profile.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/breakpoints.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// Pratinjau design system — **alat verifikasi M1, bukan layar produksi**.
///
/// Aturan tipografi keuangan dan skala sentuh hanya dapat benar-benar diperiksa
/// di perangkat sungguhan: apakah `tabularFigures` benar-benar aktif, apakah
/// tombol 48 dp benar-benar terasa cukup di bawah jempol, apakah `successText`
/// terbaca di bawah lampu toko. Halaman ini membuat seluruhnya terlihat dalam
/// satu layar.
///
/// Diganti oleh gerbang navigasi P-01…P-05 pada M3 ([09 §8]).
class DesignSystemPreviewPage extends StatelessWidget {
  const DesignSystemPreviewPage({super.key});

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final DeviceProfile profile = context.profile;
    final PosLayout layout = context.layout;

    return Scaffold(
      appBar: AppBar(
        title: const Text('POS Godinov — Design System M1'),
        toolbarHeight: layout.statusBarHeight,
      ),
      body: ListView(
        padding: EdgeInsets.all(layout.panelPadding),
        children: <Widget>[
          _Section(
            title: 'Perangkat terdeteksi',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('Profil: ${profile.name}', style: PosText.base),
                Text(
                  'Lebar: ${MediaQuery.sizeOf(context).width.toStringAsFixed(0)} dp',
                  style: PosText.sm.copyWith(color: t.fgMuted),
                ),
                Text(
                  'Grid: ${layout.gridColumns} kolom · '
                  'panel ${layout.productFlex}/${layout.cartFlex}',
                  style: PosText.sm.copyWith(color: t.fgMuted),
                ),
              ],
            ),
          ),

          // Deretan nominal dengan panjang digit berbeda. Bila `tabularFigures`
          // aktif, seluruh angka rata sempurna di kanan.
          const _Section(
            title: 'Nominal — monospace & tabular',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                MoneyText(800000, size: MoneySize.md),
                MoneyText(2200000, size: MoneySize.md),
                MoneyText(4700000, size: MoneySize.lg),
                MoneyText(12345678900, size: MoneySize.xl),
                MoneyText(0, size: MoneySize.md, tone: MoneyTone.muted),
                MoneyText(300000, size: MoneySize.xxl, tone: MoneyTone.success),
                MoneyText(
                  -1500000,
                  size: MoneySize.lg,
                  tone: MoneyTone.danger,
                  signed: true,
                ),
                MoneyText(
                  1500000,
                  size: MoneySize.lg,
                  tone: MoneyTone.success,
                  signed: true,
                ),
              ],
            ),
          ),

          _Section(
            title: 'Skala sentuh',
            child: Column(
              children: <Widget>[
                TouchButton(
                  label: 'Kritis · 72 dp — Fast-Cash',
                  height: Touch.critical,
                  variant: TouchVariant.success,
                  onPressed: () {},
                ),
                const SizedBox(height: Gap.sm),
                TouchButton(
                  label: 'Utama · 64 dp — Bayar',
                  onPressed: () {},
                ),
                const SizedBox(height: Gap.sm),
                TouchButton(
                  label: 'Sering · 56 dp',
                  height: Touch.frequent,
                  variant: TouchVariant.secondary,
                  onPressed: () {},
                ),
                const SizedBox(height: Gap.sm),
                TouchButton(
                  label: 'Standar · 48 dp',
                  height: Touch.standard,
                  variant: TouchVariant.ghost,
                  onPressed: () {},
                ),
                // Jarak destruktif 24 dp — Void tidak pernah bersebelahan
                // langsung dengan aksi lain ([06 §2.2]).
                const SizedBox(height: Gap.destructive),
                TouchButton(
                  label: 'Destruktif · jarak 24 dp',
                  variant: TouchVariant.danger,
                  onPressed: () {},
                ),
                const SizedBox(height: Gap.sm),
                const TouchButton(
                  label: 'Nonaktif',
                  onPressed: null,
                ),
                const SizedBox(height: Gap.sm),
                const TouchButton(
                  label: 'Memuat',
                  onPressed: null,
                  isLoading: true,
                ),
              ],
            ),
          ),

          _Section(
            title: 'Token semantik (Lapis 2)',
            child: Wrap(
              spacing: Gap.sm,
              runSpacing: Gap.sm,
              children: <Widget>[
                _Swatch('accent', t.accent, t.fgInverse),
                _Swatch('success', t.success, t.fgInverse),
                _Swatch('successText', t.successText, t.fgInverse),
                _Swatch('warning', t.warning, t.fgInverse),
                _Swatch('danger', t.danger, t.fgInverse),
                _Swatch('brand', t.brand, t.fgInverse),
                _Swatch('bgMuted', t.bgMuted, t.fg),
                _Swatch('border', t.border, t.fg),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            title.toUpperCase(),
            style: PosText.sm.copyWith(
              color: t.fgMuted,
              letterSpacing: 0.6,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: Gap.sm),
          Container(
            padding: const EdgeInsets.all(Gap.lg),
            decoration: BoxDecoration(
              color: t.surface,
              borderRadius: BorderRadius.circular(Radii.lg),
              border: Border.all(color: t.border),
            ),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch(this.label, this.color, this.foreground);

  final String label;
  final Color color;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 132,
      height: Touch.standard,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(Radii.sm),
        border: Border.all(color: context.tokens.border),
      ),
      child: Text(
        label,
        style: PosText.sm.copyWith(color: foreground),
      ),
    );
  }
}
