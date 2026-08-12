import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/sync/sync_triggers.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-12 — Tutup Shift.**
///
/// Kasir menghitung uang fisik di laci, lalu aplikasi menampilkan selisihnya.
/// `discrepancy` yang lahir di sini adalah angka yang dijumlahkan pada dashboard
/// pemilik sebagai indikator selisih kas ([02 §2.11]) — jadi layar ini harus
/// membuat hitungannya dapat diperiksa kasir, bukan sekadar mengumumkan hasil.
class CloseShiftPage extends StatefulWidget {
  const CloseShiftPage({super.key, this.onClosed});

  final VoidCallback? onClosed;

  @override
  State<CloseShiftPage> createState() => _CloseShiftPageState();
}

class _CloseShiftPageState extends State<CloseShiftPage> {
  int _rupiah = 0;

  int get _minor => _rupiah * 100;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ShiftCubit>().prepareClose();
    });
  }

  void _setFromText(String raw) {
    final String digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    setState(() => _rupiah = digits.isEmpty ? 0 : int.parse(digits));
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      appBar: AppBar(title: const Text('Tutup Shift')),
      backgroundColor: t.bg,
      body: BlocConsumer<ShiftCubit, ShiftState>(
        listener: (BuildContext context, ShiftState state) {
          if (state is ShiftClosed) widget.onClosed?.call();
        },
        builder: (BuildContext context, ShiftState state) {
          return switch (state) {
            ShiftClosing() => _Form(
                state: state,
                rupiah: _rupiah,
                onChanged: _setFromText,
                onSubmit: () => _confirm(context, state),
              ),
            ShiftClosed(shift: final _) => const _Done(),
            ShiftFailure(message: final String m) => _Failed(message: m),
            _ => const Center(child: CircularProgressIndicator()),
          };
        },
      ),
    );
  }

  /// Konfirmasi ganda bila selisihnya besar.
  ///
  /// Menutup shift tidak dapat dibatalkan, dan selisih yang terlanjur terkirim
  /// akan muncul di dashboard pemilik sebagai dugaan kehilangan uang.
  Future<void> _confirm(BuildContext context, ShiftClosing state) async {
    final int selisih = state.discrepancyFor(_minor);
    final ShiftCubit cubit = context.read<ShiftCubit>();

    if (selisih != 0) {
      final bool? lanjut = await showDialog<bool>(
        context: context,
        builder: (BuildContext ctx) => AlertDialog(
          title: Text('Selisih kas terdeteksi', style: PosText.buttonLg),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                selisih < 0
                    ? 'Uang di laci KURANG dari yang seharusnya.'
                    : 'Uang di laci LEBIH dari yang seharusnya.',
                style: PosText.base,
              ),
              const SizedBox(height: Gap.md),
              MoneyText(
                selisih,
                size: MoneySize.xl,
                signed: true,
                tone: selisih < 0 ? MoneyTone.danger : MoneyTone.success,
              ),
              const SizedBox(height: Gap.md),
              Text(
                'Angka ini akan terlihat pemilik. Periksa ulang hitungan uang '
                'sebelum melanjutkan.',
                style: PosText.sm.copyWith(color: ctx.tokens.fgMuted),
              ),
            ],
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Hitung Ulang'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Tutup Shift'),
            ),
          ],
        ),
      );
      if (lanjut != true) return;
    }

    await cubit.closeShift(
      closingBalanceMinor: _minor,
      // Momen paling penting untuk sinkronisasi: laci sudah dihitung, dan
      // angka selisih inilah yang ditunggu pemilik ([09 §6.4]).
      onClosed: () async => getIt<SyncTriggers>().onShiftClosed(),
    );
  }
}

class _Form extends StatelessWidget {
  const _Form({
    required this.state,
    required this.rupiah,
    required this.onChanged,
    required this.onSubmit,
  });

  final ShiftClosing state;
  final int rupiah;
  final ValueChanged<String> onChanged;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final int selisih = state.discrepancyFor(rupiah * 100);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(Gap.xl),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              // Rincian yang membuat hitungan dapat diperiksa kasir.
              Container(
                padding: const EdgeInsets.all(Gap.lg),
                decoration: BoxDecoration(
                  color: t.surface,
                  borderRadius: BorderRadius.circular(Radii.lg),
                  border: Border.all(color: t.border),
                ),
                child: Column(
                  children: <Widget>[
                    _Row(
                      label: 'Modal awal',
                      minor: state.shift.openingBalanceMinor,
                    ),
                    _Row(
                      label: 'Penjualan tunai',
                      minor: state.cashSalesMinor,
                    ),
                    const Divider(height: Gap.xl),
                    _Row(
                      label: 'SEHARUSNYA DI LACI',
                      minor: state.expectedBalanceMinor,
                      size: MoneySize.xl,
                      bold: true,
                    ),
                    const SizedBox(height: Gap.md),
                    // Non-tunai ditampilkan terpisah supaya kasir tidak
                    // mengiranya hilang dari hitungan.
                    _Row(
                      label: 'Non-tunai (tidak masuk laci)',
                      minor: state.nonCashSalesMinor,
                      size: MoneySize.sm,
                      muted: true,
                    ),
                    _Row(
                      label: '${state.completedCount} transaksi',
                      minor: state.cashSalesMinor + state.nonCashSalesMinor,
                      size: MoneySize.sm,
                      muted: true,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: Gap.xl),
              Text(
                'Uang fisik di laci',
                style: PosText.sm.copyWith(color: t.fgMuted),
              ),
              const SizedBox(height: Gap.xs),
              TextField(
                autofocus: true,
                keyboardType: TextInputType.number,
                inputFormatters: <TextInputFormatter>[
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(9),
                ],
                onChanged: onChanged,
                style: PosText.moneyXl,
                decoration: const InputDecoration(
                  prefixText: 'Rp ',
                  hintText: '0',
                ),
              ),

              const SizedBox(height: Gap.xl),
              _DiscrepancyBlock(discrepancyMinor: selisih),

              const SizedBox(height: Gap.xl),
              TouchButton(
                label: 'Tutup Shift',
                icon: Icons.lock_outline,
                variant: TouchVariant.danger,
                onPressed: onSubmit,
              ),
              const SizedBox(height: Gap.md),
              Text(
                'Setelah shift ditutup, data langsung dikirim ke server.',
                textAlign: TextAlign.center,
                style: PosText.sm.copyWith(color: t.fgMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DiscrepancyBlock extends StatelessWidget {
  const _DiscrepancyBlock({required this.discrepancyMinor});

  final int discrepancyMinor;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    final (Color bg, String label, MoneyTone tone) = switch (discrepancyMinor) {
      0 => (t.successSubtle, 'PAS', MoneyTone.success),
      < 0 => (t.dangerSubtle, 'KURANG', MoneyTone.danger),
      _ => (t.warningSubtle, 'LEBIH', MoneyTone.success),
    };

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(Radii.md),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text('SELISIH · $label', style: PosText.sm.copyWith(color: t.fgMuted)),
          MoneyText(
            discrepancyMinor,
            size: MoneySize.xxl,
            tone: tone,
            signed: true,
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.label,
    required this.minor,
    this.size = MoneySize.md,
    this.bold = false,
    this.muted = false,
  });

  final String label;
  final int minor;
  final MoneySize size;
  final bool bold;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: Gap.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Flexible(
            child: Text(
              label,
              style: PosText.sm.copyWith(
                color: muted ? context.tokens.fgSubtle : context.tokens.fgMuted,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
          MoneyText(
            minor,
            size: size,
            tone: muted ? MoneyTone.muted : MoneyTone.normal,
          ),
        ],
      ),
    );
  }
}

class _Done extends StatelessWidget {
  const _Done();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.check_circle_outline, size: 56, color: context.tokens.success),
          const SizedBox(height: Gap.lg),
          Text('Shift ditutup', style: PosText.buttonLg),
          const SizedBox(height: Gap.sm),
          Text(
            'Data sedang dikirim ke server.',
            style: PosText.sm.copyWith(color: context.tokens.fgMuted),
          ),
        ],
      ),
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Gap.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.error_outline, size: 48, color: context.tokens.danger),
            const SizedBox(height: Gap.lg),
            Text(
              message,
              textAlign: TextAlign.center,
              style: PosText.base.copyWith(color: context.tokens.danger),
            ),
            const SizedBox(height: Gap.xl),
            TouchButton(
              label: 'Kembali',
              variant: TouchVariant.secondary,
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }
}
