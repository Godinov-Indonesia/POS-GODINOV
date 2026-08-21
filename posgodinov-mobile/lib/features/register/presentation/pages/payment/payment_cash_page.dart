import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/tender_draft.dart';
import 'package:posgodinov_mobile/features/register/domain/fast_cash.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/transaction_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/pos_numpad.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';

/// **P-06a — Pembayaran Tunai**, layar penuh ([11 §M17.2]).
///
/// Keypad dan Fast-Cash menempati layar penuh, bukan setengah panel di dalam
/// dialog. Uang tunai adalah satu-satunya metode yang menuntut kasir mengetik
/// angka sambil memegang uang fisik — pekerjaan dua tangan yang tidak boleh
/// berbagi layar dengan apa pun.
///
/// ⚠️ Tombol kembali **tidak menghapus keranjang**; ia hanya mundur ke pemilih
/// metode.
class PaymentCashPage extends StatefulWidget {
  const PaymentCashPage({
    super.key,
    required this.remainingMinor,
    required this.onSubmit,
  });

  /// Sisa tagihan yang harus ditutup tender ini.
  final int remainingMinor;

  final Future<void> Function(TenderDraft tender, int cashReceivedMinor) onSubmit;

  @override
  State<PaymentCashPage> createState() => _PaymentCashPageState();
}

class _PaymentCashPageState extends State<PaymentCashPage> {
  /// Uang diterima dalam **Rupiah bulat** seperti yang diketik kasir.
  int _rupiah = 0;
  bool _saving = false;

  int get _receivedMinor => _rupiah * 100;
  int get _changeMinor => _receivedMinor - widget.remainingMinor;
  bool get _insufficient => _changeMinor < 0;

  Future<void> _submit() async {
    if (_insufficient || _saving) return;
    setState(() => _saving = true);
    try {
      await widget.onSubmit(
        TenderDraft(
          method: TenderMethod.cash,
          // Nominal TENDER adalah sisa tagihan, bukan uang yang diserahkan.
          // Kembalian bukan bagian dari pembayaran; mencatatnya sebagai tender
          // membuat `Σ tenders` melebihi total dan seluruh transaksi ditolak
          // saat sinkronisasi.
          amountMinor: widget.remainingMinor,
        ),
        _receivedMinor,
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppBar(title: const Text('Tunai')),
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
              child: Column(
                children: <Widget>[
                  _Row(label: 'Tagihan', minor: widget.remainingMinor),
                  const Divider(height: Gap.xl),
                  _Row(
                    label: 'Uang diterima',
                    minor: _receivedMinor,
                    size: MoneySize.xxl,
                  ),
                  const SizedBox(height: Gap.sm),
                  _Row(
                    label: 'Kembalian',
                    minor: _changeMinor,
                    size: MoneySize.xxl,
                    tone: _insufficient
                        ? MoneyTone.danger
                        : _changeMinor > 0
                            ? MoneyTone.success
                            : MoneyTone.normal,
                    signed: true,
                  ),
                  if (_insufficient) ...<Widget>[
                    const SizedBox(height: Gap.sm),
                    Text(
                      '⚠ Uang yang diterima belum menutupi tagihan.',
                      style: PosText.sm.copyWith(color: t.danger),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: Gap.xl),
            // Fast-Cash — kelas "Kritis": salah tekan membuat uang fisik keluar
            // salah ([06 §2.1]).
            Wrap(
              spacing: Gap.sm,
              runSpacing: Gap.sm,
              children: <Widget>[
                for (final int preset
                    in FastCash.presets(widget.remainingMinor))
                  SizedBox(
                    width: 140,
                    child: TouchButton(
                      // Label string, bukan widget: `TouchButton` menjamin
                      // tinggi, haptik, dan warna Lapis 2 justru dengan TIDAK
                      // menerima anak sembarang ([06 §2.1]).
                      label: Money.format(preset),
                      // 72 dp — kelas "Kritis". `Touch.critical`, bukan
                      // konstanta baru: seluruh nominal Fast-Cash memakai kelas
                      // yang sama dengan tombol bayar.
                      height: Touch.critical,
                      variant: TouchVariant.secondary,
                      onPressed: () => setState(() => _rupiah = preset ~/ 100),
                    ),
                  ),
              ],
            ),

            const SizedBox(height: Gap.xl),
            // `onDigits` menerima `'000'` sekaligus, bukan hanya satu angka —
            // pecahan Rupiah membuat kasir mengetik tiga nol beruntun puluhan
            // kali per shift.
            PosNumpad(
              enabled: !_saving,
              onDigits: (String digits) => setState(() {
                for (final int _ in Iterable<int>.generate(digits.length)) {
                  _rupiah *= 10;
                }
                _rupiah += int.tryParse(digits) ?? 0;
              }),
              onBackspace: () => setState(() => _rupiah = _rupiah ~/ 10),
              onClear: () => setState(() => _rupiah = 0),
            ),

            const SizedBox(height: Gap.xl),
            TouchButton(
              label: _saving ? 'MENYIMPAN…' : 'SELESAIKAN TRANSAKSI',
              variant: TouchVariant.success,
              height: Touch.critical,
              isLoading: _saving,
              onPressed: _insufficient || _saving ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.label,
    required this.minor,
    this.size = MoneySize.lg,
    this.tone = MoneyTone.normal,
    this.signed = false,
  });

  final String label;
  final int minor;
  final MoneySize size;
  final MoneyTone tone;
  final bool signed;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(label, style: PosText.base.copyWith(color: context.tokens.fgMuted)),
        MoneyText(minor, size: size, tone: tone, signed: signed),
      ],
    );
  }
}
