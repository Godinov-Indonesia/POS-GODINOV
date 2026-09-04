import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/sale_transaction.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/transaction_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-07 — Struk / Konfirmasi.**
///
/// Ditampilkan setelah transaksi **sudah tersimpan**. Kegagalan cetak muncul
/// sebagai peringatan disertai tombol **Cetak Ulang** — bukan sebagai
/// pembatalan ([09 §7.3]).
class ReceiptDialog extends StatelessWidget {
  const ReceiptDialog({super.key});

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return BlocBuilder<TransactionCubit, TransactionState>(
      builder: (BuildContext context, TransactionState state) {
        return Dialog(
          insetPadding: const EdgeInsets.all(Gap.xl),
          backgroundColor: t.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Radii.xl),
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(
              padding: const EdgeInsets.all(Gap.xl),
              child: switch (state) {
                TxPersisting() => const _Busy(label: 'Menyimpan transaksi…'),
                TxPrinting() => const _Busy(label: 'Mencetak struk…'),
                TxCompleted(
                  transaction: final SaleTransaction tx,
                  printOk: final bool ok,
                ) =>
                  _Completed(transaction: tx, printOk: ok),
                TxFailed(message: final String m) => _Failed(message: m),
                _ => const _Busy(label: 'Memproses…'),
              },
            ),
          ),
        );
      },
    );
  }
}

class _Busy extends StatelessWidget {
  const _Busy({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        const CircularProgressIndicator(),
        const SizedBox(height: Gap.lg),
        Text(label, style: PosText.base),
      ],
    );
  }
}

class _Completed extends StatelessWidget {
  const _Completed({required this.transaction, required this.printOk});

  final SaleTransaction transaction;
  final bool printOk;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            Icon(Icons.check_circle, color: t.success, size: 32),
            const SizedBox(width: Gap.md),
            const Expanded(
              child: Text('Transaksi tersimpan', style: PosText.buttonLg),
            ),
          ],
        ),
        const SizedBox(height: Gap.xs),
        Text(
          'No. ${transaction.shortId}',
          style: PosText.xsMono.copyWith(color: t.fgMuted),
        ),

        const SizedBox(height: Gap.lg),
        for (final CartLine l in transaction.lines)
          Padding(
            padding: const EdgeInsets.only(bottom: Gap.xs),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    '${l.quantity}× ${l.productName}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: PosText.sm,
                  ),
                ),
                MoneyText(l.lineTotalMinor, size: MoneySize.sm),
              ],
            ),
          ),

        const Divider(height: Gap.xl),
        _Row(label: 'TOTAL', minor: transaction.totalAmountMinor,
            size: MoneySize.xl,),
        if (transaction.paymentMethod.isCash) ...<Widget>[
          const SizedBox(height: Gap.xs),
          _Row(
            label: 'Tunai',
            minor: transaction.cashReceivedMinor,
            size: MoneySize.md,
          ),
          _Row(
            label: 'Kembalian',
            minor: transaction.changeMinor,
            size: MoneySize.lg,
            tone: MoneyTone.success,
          ),
        ] else
          Padding(
            padding: const EdgeInsets.only(top: Gap.xs),
            child: Text(
              'Metode: ${transaction.paymentMethod.label} '
              '(${transaction.paymentMethod.wireValue})',
              style: PosText.sm.copyWith(color: t.fgMuted),
            ),
          ),

        if (!printOk) ...<Widget>[
          const SizedBox(height: Gap.lg),
          Container(
            padding: const EdgeInsets.all(Gap.md),
            decoration: BoxDecoration(
              color: t.warningSubtle,
              borderRadius: BorderRadius.circular(Radii.md),
              border: Border.all(color: t.warning),
            ),
            child: Row(
              children: <Widget>[
                Icon(Icons.print_disabled_outlined, color: t.warningText),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: Text(
                    // Transaksi TIDAK dibatalkan. Ini masalah operasional,
                    // bukan alasan menghilangkan penjualan yang uangnya sudah
                    // diterima ([09 §7.3]).
                    'Struk gagal dicetak. Transaksi tetap tersimpan dan akan '
                    'tersinkronisasi.',
                    style: PosText.sm.copyWith(color: t.fg),
                  ),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: Gap.xl),
        Row(
          children: <Widget>[
            Expanded(
              child: TouchButton(
                label: 'Cetak Ulang',
                icon: Icons.print_outlined,
                variant: TouchVariant.secondary,
                onPressed: () => context.read<TransactionCubit>().reprint(),
              ),
            ),
            const SizedBox(width: Gap.md),
            Expanded(
              child: TouchButton(
                label: 'Selesai',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Icon(Icons.error_outline, color: t.danger, size: 40),
        const SizedBox(height: Gap.lg),
        Text(
          // Satu-satunya kegagalan yang benar-benar membatalkan transaksi:
          // penyimpanan gagal, sehingga tidak ada apa pun yang tercatat.
          'Transaksi TIDAK tersimpan',
          textAlign: TextAlign.center,
          style: PosText.buttonLg.copyWith(color: t.danger),
        ),
        const SizedBox(height: Gap.sm),
        Text(
          message,
          textAlign: TextAlign.center,
          style: PosText.sm.copyWith(color: t.fgMuted),
        ),
        const SizedBox(height: Gap.xl),
        TouchButton(
          label: 'Kembali ke Keranjang',
          variant: TouchVariant.secondary,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.label,
    required this.minor,
    required this.size,
    this.tone = MoneyTone.normal,
  });

  final String label;
  final int minor;
  final MoneySize size;
  final MoneyTone tone;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(label, style: PosText.sm.copyWith(color: context.tokens.fgMuted)),
        MoneyText(minor, size: size, tone: tone),
      ],
    );
  }
}
