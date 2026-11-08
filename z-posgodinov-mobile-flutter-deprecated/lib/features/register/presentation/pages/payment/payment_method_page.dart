import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/tender_draft.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/transaction_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/payment/payment_flow.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-06 — Pemilih metode pembayaran**, layar penuh ([11 §M17.2]).
///
/// Menyimpan daftar tender yang sedang disusun. State-nya hidup DI SINI, bukan
/// di sub-layar: sub-layar dilepas dan dipasang ulang setiap kali kasir menekan
/// back, dan tender yang tinggal di dalamnya akan lenyap bersamanya.
class PaymentMethodPage extends StatefulWidget {
  const PaymentMethodPage({
    super.key,
    required this.totalMinor,
    required this.onConfirm,
  });

  final int totalMinor;

  /// Dipanggil setelah seluruh tagihan tertutup.
  final Future<void> Function(List<TenderDraft> tenders, int cashReceivedMinor)
      onConfirm;

  @override
  State<PaymentMethodPage> createState() => _PaymentMethodPageState();
}

class _PaymentMethodPageState extends State<PaymentMethodPage> {
  final List<TenderDraft> _tenders = <TenderDraft>[];

  /// Uang tunai yang diterima — hanya bermakna bila ada tender tunai.
  int _cashReceivedMinor = 0;

  int get _tendered =>
      _tenders.fold(0, (int sum, TenderDraft t) => sum + t.amountMinor);

  int get _remaining => widget.totalMinor - _tendered;

  /// Menyelesaikan transaksi lalu menutup SELURUH rantai sub-layar.
  ///
  /// `popUntil` sampai rute pemilih metode, lalu `pop(true)`: tanpa itu, layar
  /// struk muncul di atas tumpukan form kartu, dan back dari struk mengembalikan
  /// kasir ke form pembayaran transaksi yang sudah selesai.
  Future<void> _finish() async {
    await widget.onConfirm(
      List<TenderDraft>.unmodifiable(_tenders),
      _cashReceivedMinor,
    );
    if (mounted) Navigator.of(context).pop(true);
  }

  Future<void> _openCash() async {
    await Navigator.of(context).push<bool>(
      PaymentFlow.cash(
        cubit: context.read<TransactionCubit>(),
        remainingMinor: _remaining,
        onSubmit: (TenderDraft tender, int cashReceived) async {
          setState(() {
            _tenders.add(tender);
            _cashReceivedMinor = cashReceived;
          });
          await _finish();
        },
      ),
    );
  }

  Future<void> _openCard(TenderMethod method) async {
    await Navigator.of(context).push<bool>(
      PaymentFlow.card(
        cubit: context.read<TransactionCubit>(),
        method: method,
        remainingMinor: _remaining,
        onSubmit: (TenderDraft tender) async {
          setState(() => _tenders.add(tender));
          await _finish();
        },
        onAddAndContinue: (TenderDraft tender) {
          setState(() => _tenders.add(tender));
          Navigator.of(context).pop();
          unawaited(_openSplit());
        },
      ),
    );
  }

  Future<void> _openSplit() async {
    await Navigator.of(context).push<bool>(
      PaymentFlow.split(
        cubit: context.read<TransactionCubit>(),
        totalMinor: widget.totalMinor,
        tenders: List<TenderDraft>.unmodifiable(_tenders),
        onRemove: (int index) => setState(() => _tenders.removeAt(index)),
        onAdd: () => _openCard(TenderMethod.debit),
        onSubmit: _finish,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppBar(title: const Text('Pembayaran')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(Gap.xl),
          children: <Widget>[
            Container(
              padding: const EdgeInsets.all(Gap.lg),
              decoration: BoxDecoration(
                color: t.surface,
                borderRadius: BorderRadius.circular(Radii.lg),
                border: Border.all(color: t.border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Text('Total', style: PosText.base.copyWith(color: t.fgMuted)),
                  MoneyText(widget.totalMinor, size: MoneySize.xxl),
                ],
              ),
            ),

            const SizedBox(height: Gap.xl),
            Text(
              'Metode pembayaran',
              style: PosText.sm.copyWith(color: t.fgMuted),
            ),
            const SizedBox(height: Gap.sm),

            // Satu kolom, target 64 dp. Grid dua kolom memuat lebih banyak
            // metode di layar, tetapi memaksa jempol bergerak mendatar — dan
            // salah tekan memilih metode yang salah untuk uang yang sudah
            // diterima.
            for (final TenderMethod m in TenderMethod.values) ...<Widget>[
              TouchButton(
                label: m.label,
                icon: _iconFor(m),
                variant: TouchVariant.secondary,
                height: Touch.critical,
                onPressed: () =>
                    m == TenderMethod.cash ? _openCash() : _openCard(m),
              ),
              const SizedBox(height: Gap.sm),
            ],

            const SizedBox(height: Gap.md),
            TouchButton(
              label: 'Bayar Terpisah (Split)',
              icon: Icons.call_split,
              variant: TouchVariant.secondary,
              height: Touch.critical,
              onPressed: _openSplit,
            ),
          ],
        ),
      ),
    );
  }

  static IconData _iconFor(TenderMethod m) => switch (m) {
        TenderMethod.cash => Icons.payments_outlined,
        TenderMethod.qris => Icons.qr_code_2,
        TenderMethod.debit => Icons.credit_card,
        TenderMethod.credit => Icons.credit_card,
        TenderMethod.transfer => Icons.account_balance_outlined,
      };
}
