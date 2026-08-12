import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/features/register/domain/fast_cash.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/transaction_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/pos_numpad.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-06 — Pembayaran.**
///
/// Dialog di atas P-05, bukan halaman penuh: keranjang tetap terlihat di
/// belakang *scrim* sehingga kasir dapat memverifikasi tanpa menutup modal
/// ([06 §4.6.1]).
///
/// `Esc`/tombol kembali menutup; **ketukan pada scrim tidak** — sentuhan tak
/// sengaja saat memegang tablet akan membatalkan transaksi.
class PaymentDialog extends StatefulWidget {
  const PaymentDialog({super.key, required this.onConfirm});

  final VoidCallback onConfirm;

  @override
  State<PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<PaymentDialog> {
  /// Uang diterima dalam **Rupiah bulat** seperti yang diketik kasir.
  int _cashRupiah = 0;

  void _setCash(int rupiah) {
    setState(() => _cashRupiah = rupiah);
    context.read<TransactionCubit>().setCashReceived(rupiah * 100);
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return BlocBuilder<TransactionCubit, TransactionState>(
      builder: (BuildContext context, TransactionState state) {
        final int totalMinor = switch (state) {
          TxSelectingPayment(totalMinor: final int v) => v,
          TxConfirming(totalMinor: final int v) => v,
          _ => 0,
        };
        final PaymentMethod? method =
            state is TxConfirming ? state.method : null;
        final bool isCash = method == PaymentMethod.cash;

        return Dialog(
          insetPadding: const EdgeInsets.all(Gap.xl),
          backgroundColor: t.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Radii.xl),
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 920),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(Gap.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Text('PEMBAYARAN', style: PosText.buttonLg),
                      const Spacer(),
                      IconButton(
                        onPressed: () {
                          context.read<TransactionCubit>().cancel();
                          Navigator.of(context).pop();
                        },
                        icon: const Icon(Icons.close),
                        tooltip: 'Batal',
                      ),
                    ],
                  ),

                  const SizedBox(height: Gap.lg),
                  _TotalBlock(totalMinor: totalMinor),

                  const SizedBox(height: Gap.xl),
                  Text(
                    'METODE PEMBAYARAN',
                    style: PosText.sm.copyWith(color: t.fgMuted),
                  ),
                  const SizedBox(height: Gap.sm),
                  _MethodSelector(selected: method),

                  if (isCash) ...<Widget>[
                    const SizedBox(height: Gap.xl),
                    _CashSection(
                      totalMinor: totalMinor,
                      cashRupiah: _cashRupiah,
                      onCashChanged: _setCash,
                    ),
                  ] else if (method != null) ...<Widget>[
                    const SizedBox(height: Gap.xl),
                    _NonCashNotice(method: method, totalMinor: totalMinor),
                  ],

                  if (state is TxConfirming) ...<Widget>[
                    const SizedBox(height: Gap.xl),
                    _ChangeBlock(state: state),
                  ],

                  const SizedBox(height: Gap.xl),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: TouchButton(
                          label: 'BATAL',
                          variant: TouchVariant.secondary,
                          onPressed: () {
                            context.read<TransactionCubit>().cancel();
                            Navigator.of(context).pop();
                          },
                        ),
                      ),
                      const SizedBox(width: Gap.destructive),
                      Expanded(
                        flex: 2,
                        child: TouchButton(
                          label: 'SELESAIKAN & CETAK',
                          variant: TouchVariant.success,
                          // Nonaktif selama uang kurang ([06 §4.6.5]).
                          onPressed: (state is TxConfirming && state.isPayable)
                              ? widget.onConfirm
                              : null,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _TotalBlock extends StatelessWidget {
  const _TotalBlock({required this.totalMinor});

  final int totalMinor;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.bgMuted,
        borderRadius: BorderRadius.circular(Radii.md),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text('TOTAL TAGIHAN', style: PosText.sm.copyWith(color: t.fgMuted)),
          MoneyText(totalMinor, size: MoneySize.xxl),
        ],
      ),
    );
  }
}

/// Pemilih metode — dirender **hanya** dari `PaymentMethod.values`.
///
/// Tidak ada input teks bebas dan tidak ada opsi "Lainnya": kolom
/// `payment_method` di server adalah `VARCHAR(50)` tanpa enum, sehingga satu
/// nilai liar memecah pengelompokan laporan **secara permanen** ([09 §9.3]).
class _MethodSelector extends StatelessWidget {
  const _MethodSelector({required this.selected});

  final PaymentMethod? selected;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Wrap(
      spacing: Gap.sm,
      runSpacing: Gap.sm,
      children: <Widget>[
        for (final PaymentMethod m in PaymentMethod.values)
          SizedBox(
            width: 200,
            height: Touch.frequent,
            child: Semantics(
              selected: selected == m,
              button: true,
              child: OutlinedButton(
                onPressed: () =>
                    context.read<TransactionCubit>().selectMethod(m),
                style: OutlinedButton.styleFrom(
                  backgroundColor:
                      selected == m ? t.accentSubtle : t.surface,
                  foregroundColor: selected == m ? t.accent : t.fgMuted,
                  side: BorderSide(
                    color: selected == m ? t.accent : t.border,
                    width: selected == m ? 2 : 1,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(Radii.md),
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    Text(m.label, style: PosText.base),
                    // Nilai teknis ditampilkan dengan sengaja: saat terjadi
                    // sengketa laporan, kasir dan pemilik merujuk string yang
                    // sama persis dengan isi kolom `payment_method`
                    // ([06 §4.6.2]).
                    Text(
                      m.wireValue,
                      style: PosText.xsMono.copyWith(
                        color: selected == m ? t.accent : t.fgSubtle,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _CashSection extends StatelessWidget {
  const _CashSection({
    required this.totalMinor,
    required this.cashRupiah,
    required this.onCashChanged,
  });

  final int totalMinor;
  final int cashRupiah;
  final ValueChanged<int> onCashChanged;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text('UANG DITERIMA', style: PosText.sm.copyWith(color: t.fgMuted)),
        const SizedBox(height: Gap.sm),
        Container(
          height: 72,
          padding: const EdgeInsets.symmetric(horizontal: Gap.lg),
          alignment: Alignment.centerRight,
          decoration: BoxDecoration(
            color: t.surface,
            borderRadius: BorderRadius.circular(Radii.md),
            border: Border.all(color: t.borderStrong),
          ),
          child: MoneyText(cashRupiah * 100, size: MoneySize.xxl),
        ),

        const SizedBox(height: Gap.lg),
        // ── Lapis 1 — UANG PAS, lebar penuh, 72 dp ──────────────────────────
        TouchButton(
          label: 'UANG PAS',
          height: Touch.critical,
          variant: TouchVariant.secondary,
          onPressed: () => onCashChanged(totalMinor ~/ 100),
        ),

        const SizedBox(height: Gap.sm),
        // ── Lapis 2 — pembulatan cerdas ─────────────────────────────────────
        _PresetRow(
          values: FastCash.presets(totalMinor),
          totalMinor: totalMinor,
          onTap: onCashChanged,
        ),

        const SizedBox(height: Gap.sm),
        // ── Lapis 3 — pecahan tetap ─────────────────────────────────────────
        _PresetRow(
          values: FastCash.fixedDenoms,
          totalMinor: totalMinor,
          onTap: onCashChanged,
        ),

        const SizedBox(height: Gap.lg),
        Center(
          child: PosNumpad(
            onDigits: (String d) =>
                onCashChanged(appendDigits(cashRupiah, d)),
            onBackspace: () => onCashChanged(removeLastDigit(cashRupiah)),
            onClear: () => onCashChanged(0),
          ),
        ),
      ],
    );
  }
}

class _PresetRow extends StatelessWidget {
  const _PresetRow({
    required this.values,
    required this.totalMinor,
    required this.onTap,
  });

  final List<int> values;
  final int totalMinor;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    if (values.isEmpty) return const SizedBox.shrink();

    return Row(
      children: <Widget>[
        for (int i = 0; i < values.length; i++) ...<Widget>[
          if (i > 0) const SizedBox(width: Gap.sm),
          Expanded(
            child: TouchButton(
              label: 'Rp ${values[i] ~/ 100000}rb',
              height: Touch.critical,
              variant: TouchVariant.secondary,
              // Nilai di bawah total DITAMPILKAN namun nonaktif, bukan
              // disembunyikan: posisi tombol yang stabil antar-transaksi
              // membangun memori otot kasir ([06 §4.6.3]).
              onPressed: FastCash.isDenomEnabled(values[i], totalMinor)
                  ? () => onTap(values[i] ~/ 100)
                  : null,
            ),
          ),
        ],
      ],
    );
  }
}

class _NonCashNotice extends StatelessWidget {
  const _NonCashNotice({required this.method, required this.totalMinor});

  final PaymentMethod method;
  final int totalMinor;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.accentSubtle,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: t.accent),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.lock_outline, color: t.accent),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Text(
              'Nominal ${method.label} dikunci sama dengan total.',
              style: PosText.base.copyWith(color: t.fg),
            ),
          ),
          MoneyText(totalMinor, size: MoneySize.lg),
        ],
      ),
    );
  }
}

/// Blok kembalian ([06 §4.6.5]).
///
/// Untuk metode non-tunai blok ini **disembunyikan** — tidak ada kembalian pada
/// QRIS, debit, maupun transfer.
class _ChangeBlock extends StatelessWidget {
  const _ChangeBlock({required this.state});

  final TxConfirming state;

  @override
  Widget build(BuildContext context) {
    if (state.method != PaymentMethod.cash) return const SizedBox.shrink();

    final GodinovTokens t = context.tokens;
    final int change = state.changeMinor;
    final bool kurang = change < 0;

    final (Color bg, String label, MoneyTone tone) = kurang
        ? (t.dangerSubtle, 'KURANG', MoneyTone.danger)
        : (t.successSubtle, 'KEMBALIAN', MoneyTone.success);

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(Radii.md),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(label, style: PosText.sm.copyWith(color: t.fgMuted)),
              if (!kurang && change == 0)
                Text('Uang pas', style: PosText.xs.copyWith(color: t.fgMuted)),
            ],
          ),
          MoneyText(change.abs(), size: MoneySize.xxl, tone: tone),
        ],
      ),
    );
  }
}
