import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/tender_draft.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-06b — Pembayaran Kartu / Non-Tunai**, butir 8 & 11 ([11 §M17.2]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// TRACE NUMBER DAN 4 DIGIT AKHIR — WAJIB, DITEGAKKAN TIGA LAPIS
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Tanpa keduanya, tender kartu tidak dapat dicocokkan dengan struk settlement
/// EDC saat Blind Closing ([11 §M15.3]). "EDC Rp 4.200.000" yang tidak dapat
/// dipecah menjadi transaksi mana saja adalah selisih yang tidak dapat
/// ditelusuri siapa pun — dan tidak dapat diperbaiki setelah harinya lewat.
///
/// Aturannya hidup di [CardTenderRules] dan dipakai bersama oleh layar ini
/// serta `assertTenderIntegrity`. Regex yang disalin ke dua tempat akan berbeda
/// pada perbaikan pertama.
///
/// ⛔ **TIDAK ADA** kolom untuk nomor kartu penuh, CVV, PIN, maupun data
/// magstripe (aturan R8). Ketiadaannya bukan kelalaian: menyimpannya
/// memindahkan seluruh sistem ke ruang lingkup PCI-DSS penuh.
class PaymentCardPage extends StatefulWidget {
  const PaymentCardPage({
    super.key,
    required this.method,
    required this.remainingMinor,
    required this.onSubmit,
    required this.onAddAndContinue,
  });

  final TenderMethod method;

  /// Sisa tagihan. Nominal gesek default = angka ini.
  final int remainingMinor;

  /// Tender ini menutup seluruh sisa → selesaikan transaksi.
  final Future<void> Function(TenderDraft tender) onSubmit;

  /// Tender ini hanya sebagian → simpan lalu lanjut ke penyusun split.
  final void Function(TenderDraft tender) onAddAndContinue;

  @override
  State<PaymentCardPage> createState() => _PaymentCardPageState();
}

class _PaymentCardPageState extends State<PaymentCardPage> {
  final TextEditingController _trace = TextEditingController();
  final TextEditingController _last4 = TextEditingController();

  late int _amountMinor = widget.remainingMinor;
  bool _touched = false;
  bool _saving = false;

  bool get _requiresCard => widget.method.requiresCardDetails;

  String? get _traceError =>
      _touched ? CardTenderRules.validateTrace(_trace.text) : null;

  String? get _last4Error =>
      _touched ? CardTenderRules.validateLast4(_last4.text) : null;

  bool get _valid =>
      _amountMinor > 0 &&
      _amountMinor <= widget.remainingMinor &&
      (!_requiresCard ||
          (CardTenderRules.validateTrace(_trace.text) == null &&
              CardTenderRules.validateLast4(_last4.text) == null));

  bool get _closesTotal => _amountMinor == widget.remainingMinor;

  TenderDraft _build() => TenderDraft(
        method: widget.method,
        amountMinor: _amountMinor,
        traceNumber: _requiresCard ? _trace.text.trim() : null,
        cardLast4: _requiresCard ? _last4.text.trim() : null,
      );

  @override
  void dispose() {
    _trace.dispose();
    _last4.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _touched = true);
    if (!_valid || _saving) return;

    setState(() => _saving = true);
    try {
      await widget.onSubmit(_build());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _addAndContinue() {
    setState(() => _touched = true);
    if (!_valid) return;
    widget.onAddAndContinue(_build());
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppBar(title: Text(widget.method.label)),
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: <Widget>[
                      Text(
                        'Sisa tagihan',
                        style: PosText.base.copyWith(color: t.fgMuted),
                      ),
                      MoneyText(widget.remainingMinor, size: MoneySize.lg),
                    ],
                  ),
                  const Divider(height: Gap.xl),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: <Widget>[
                      Text(
                        'Nominal gesek',
                        style: PosText.base.copyWith(color: t.fgMuted),
                      ),
                      MoneyText(_amountMinor, size: MoneySize.xxl),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: Gap.lg),
            Text(
              'Ubah nominal gesek (kosongkan untuk memakai sisa tagihan)',
              style: PosText.sm.copyWith(color: t.fgMuted),
            ),
            const SizedBox(height: Gap.xs),
            TextField(
              keyboardType: TextInputType.number,
              inputFormatters: <TextInputFormatter>[
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(9),
              ],
              onChanged: (String raw) {
                final String digits = CardTenderRules.digitsOnly(raw);
                setState(() {
                  _amountMinor = digits.isEmpty
                      ? widget.remainingMinor
                      : int.parse(digits) * 100;
                });
              },
              style: PosText.moneyXl,
              decoration: InputDecoration(
                prefixText: 'Rp ',
                hintText: Money.format(widget.remainingMinor),
              ),
            ),
            if (_amountMinor > widget.remainingMinor) ...<Widget>[
              const SizedBox(height: Gap.xs),
              Text(
                '⚠ Nominal gesek melebihi sisa tagihan.',
                style: PosText.sm.copyWith(color: t.danger),
              ),
            ],

            if (_requiresCard) ...<Widget>[
              const SizedBox(height: Gap.xl),
              _Field(
                label: 'Trace Number',
                hint: 'Tercetak pada struk EDC. Tanpa angka ini, tender kartu '
                    'tidak dapat dicocokkan saat tutup shift.',
                error: _traceError,
                child: TextField(
                  controller: _trace,
                  keyboardType: TextInputType.number,
                  inputFormatters: <TextInputFormatter>[
                    // Disaring saat DIKETIK, bukan saat submit: sebagian
                    // pemindai kartu mengirimkan karakter kontrol yang tidak
                    // terlihat di layar.
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(
                      CardTenderRules.traceMaxLength,
                    ),
                  ],
                  onChanged: (_) => setState(() {}),
                  onEditingComplete: () => setState(() => _touched = true),
                  style: PosText.base,
                  decoration: const InputDecoration(hintText: 'mis. 004512'),
                ),
              ),

              const SizedBox(height: Gap.lg),
              _Field(
                label: '4 Digit Akhir Kartu',
                hint: 'Empat angka terakhir pada kartu — bukan nomor kartu '
                    'penuh.',
                error: _last4Error,
                child: TextField(
                  controller: _last4,
                  keyboardType: TextInputType.number,
                  inputFormatters: <TextInputFormatter>[
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
                  ],
                  onChanged: (_) => setState(() {}),
                  onEditingComplete: () => setState(() => _touched = true),
                  style: PosText.moneyXl,
                  decoration: const InputDecoration(hintText: '····'),
                ),
              ),

              const SizedBox(height: Gap.lg),
              Container(
                padding: const EdgeInsets.all(Gap.lg),
                decoration: BoxDecoration(
                  color: t.info.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(Radii.md),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Icon(Icons.verified_user_outlined, size: 20, color: t.info),
                    const SizedBox(width: Gap.sm),
                    Expanded(
                      child: Text(
                        'Aplikasi ini tidak pernah menyimpan nomor kartu penuh, '
                        'CVV, maupun PIN. Hanya trace number dan empat digit '
                        'akhir — cukup untuk rekonsiliasi, tidak cukup untuk '
                        'menyalahgunakan kartu.',
                        style: PosText.sm.copyWith(color: t.fgMuted),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: Gap.xl),
            // Tombol "tambah tender" hanya muncul bila nominalnya TIDAK menutup
            // sisa. Menawarkan keduanya sekaligus membuat kasir memilih antara
            // dua tombol yang salah satunya pasti keliru.
            if (!_closesTotal &&
                _amountMinor > 0 &&
                _amountMinor < widget.remainingMinor) ...<Widget>[
              TouchButton(
                label: 'Simpan tender & lanjut ke sisa',
                variant: TouchVariant.secondary,
                onPressed: _saving ? null : _addAndContinue,
              ),
              const SizedBox(height: Gap.sm),
            ],
            TouchButton(
              label: _saving ? 'MENYIMPAN…' : 'SELESAIKAN TRANSAKSI',
              variant: TouchVariant.success,
              height: Touch.critical,
              isLoading: _saving,
              onPressed: (_valid && _closesTotal && !_saving) ? _submit : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.hint,
    required this.error,
    required this.child,
  });

  final String label;
  final String hint;
  final String? error;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: PosText.sm.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: Gap.xs),
        child,
        const SizedBox(height: Gap.xs),
        // Galat selalu punya penanda KEDUA selain warna: prefiks "⚠"
        // ([06 §1.5]).
        Text(
          error != null ? '⚠ $error' : hint,
          style: PosText.xs.copyWith(color: error != null ? t.danger : t.fgMuted),
        ),
      ],
    );
  }
}
