import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';
import 'package:posgodinov_mobile/features/printer/presentation/cubit/printer_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// Pemasangan printer — bagian dari P-14 Pengaturan.
///
/// Kasir memilih **printer**, bukan transport. Daftar transport di bawah ada
/// untuk teknisi yang tahu persis perangkat kerasnya; pemilihan otomatis
/// menangani sisanya ([09 §4.3]).
class PrinterSetupPage extends StatelessWidget {
  const PrinterSetupPage({super.key});

  /// Transport yang dapat dipindai kasir.
  static const List<(PrinterKind, String, String)> _kinds =
      <(PrinterKind, String, String)>[
    (
      PrinterKind.btClassic,
      'Bluetooth (umum)',
      'Mayoritas printer termal. Pilih ini lebih dulu.',
    ),
    (
      PrinterKind.ble,
      'Bluetooth Hemat Daya',
      'Printer generasi baru yang tidak muncul di daftar Bluetooth biasa.',
    ),
    (
      PrinterKind.usb,
      'USB',
      'Printer yang tersambung kabel ke perangkat.',
    ),
    (
      PrinterKind.sunmiInner,
      'Printer internal',
      'Printer di dalam badan perangkat handheld.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      appBar: AppBar(title: const Text('Printer')),
      body: BlocBuilder<PrinterCubit, PrinterUiState>(
        builder: (BuildContext context, PrinterUiState state) {
          return ListView(
            padding: const EdgeInsets.all(Gap.xl),
            children: <Widget>[
              _StatusCard(state: state),
              const SizedBox(height: Gap.xl),

              Text(
                'CARI PRINTER',
                style: PosText.sm.copyWith(
                  color: t.fgMuted,
                  letterSpacing: 0.6,
                ),
              ),
              const SizedBox(height: Gap.sm),
              for (final (PrinterKind kind, String label, String hint) in _kinds)
                Padding(
                  padding: const EdgeInsets.only(bottom: Gap.sm),
                  child: _KindTile(
                    label: label,
                    hint: hint,
                    enabled: !state.isScanning,
                    onTap: () => context.read<PrinterCubit>().scan(kind),
                  ),
                ),

              if (state.isScanning) ...<Widget>[
                const SizedBox(height: Gap.lg),
                const Center(child: CircularProgressIndicator()),
              ],

              if (state.discovered.isNotEmpty) ...<Widget>[
                const SizedBox(height: Gap.xl),
                Text(
                  'DITEMUKAN',
                  style: PosText.sm.copyWith(
                    color: t.fgMuted,
                    letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(height: Gap.sm),
                for (final PrinterTarget target in state.discovered)
                  Padding(
                    padding: const EdgeInsets.only(bottom: Gap.sm),
                    child: _TargetTile(
                      target: target,
                      selected: state.target?.id == target.id,
                      onTap: () => context.read<PrinterCubit>().select(target),
                    ),
                  ),
              ],

              const SizedBox(height: Gap.xxl),
              const _PaperStatusNote(),
            ],
          );
        },
      ),
      backgroundColor: t.bg,
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.state});

  final PrinterUiState state;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    final (IconData icon, Color color) = switch (state.state) {
      PrinterState.ready => (Icons.print, t.success),
      PrinterState.printing => (Icons.print, t.info),
      PrinterState.connecting => (Icons.sync, t.info),
      PrinterState.outOfPaper => (Icons.warning_amber_rounded, t.danger),
      PrinterState.error => (Icons.error_outline, t.danger),
      PrinterState.disconnected => (Icons.print_disabled, t.warning),
      PrinterState.unavailable => (Icons.print_disabled, t.fgSubtle),
    };

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: t.border),
      ),
      child: Row(
        children: <Widget>[
          Icon(icon, color: color, size: 32),
          const SizedBox(width: Gap.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(state.label, style: PosText.base),
                if (state.status.message != null &&
                    state.status.message != state.label)
                  Text(
                    state.status.message!,
                    style: PosText.sm.copyWith(color: t.fgMuted),
                  ),
              ],
            ),
          ),
          if (state.actionLabel != null)
            SizedBox(
              width: 140,
              child: TouchButton(
                label: state.actionLabel!,
                height: Touch.standard,
                variant: TouchVariant.secondary,
                onPressed: () => context.read<PrinterCubit>().retry(),
              ),
            ),
        ],
      ),
    );
  }
}

class _KindTile extends StatelessWidget {
  const _KindTile({
    required this.label,
    required this.hint,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final String hint;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(Radii.md),
      child: Container(
        constraints: const BoxConstraints(minHeight: Touch.primary),
        padding: const EdgeInsets.all(Gap.md),
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(Radii.md),
          border: Border.all(color: t.border),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(label, style: PosText.base),
                  Text(hint, style: PosText.xs.copyWith(color: t.fgMuted)),
                ],
              ),
            ),
            Icon(Icons.search, color: t.fgSubtle),
          ],
        ),
      ),
    );
  }
}

class _TargetTile extends StatelessWidget {
  const _TargetTile({
    required this.target,
    required this.selected,
    required this.onTap,
  });

  final PrinterTarget target;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Radii.md),
      child: Container(
        constraints: const BoxConstraints(minHeight: Touch.primary),
        padding: const EdgeInsets.all(Gap.md),
        decoration: BoxDecoration(
          color: selected ? t.accentSubtle : t.surface,
          borderRadius: BorderRadius.circular(Radii.md),
          border: Border.all(
            color: selected ? t.accent : t.border,
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(target.name, style: PosText.base),
                  Text(
                    target.id,
                    style: PosText.xsMono.copyWith(color: t.fgMuted),
                  ),
                ],
              ),
            ),
            if (selected) Icon(Icons.check_circle, color: t.accent),
          ],
        ),
      ),
    );
  }
}

/// Menyatakan batas deteksi kertas apa adanya.
class _PaperStatusNote extends StatelessWidget {
  const _PaperStatusNote();

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.warningSubtle,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: t.warning),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.info_outline, color: t.warningText),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Text(
              // Jangan menjanjikan deteksi universal ([09 §4.2]).
              'Deteksi kertas habis hanya bekerja pada printer USB, LAN, dan '
              'printer internal. Pada Bluetooth, kertas habis tidak terdeteksi '
              'otomatis — gunakan Cetak Ulang dari Riwayat bila struk tidak '
              'keluar.',
              style: PosText.sm.copyWith(color: t.fg),
            ),
          ),
        ],
      ),
    );
  }
}
