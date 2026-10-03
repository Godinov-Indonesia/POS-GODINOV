import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/tender_draft.dart';
import 'package:posgodinov_mobile/features/register/domain/fast_cash.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/pos_numpad.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-06a — Layar Cashout All-in-One 2 Kotak Horizontal.**
///
/// Tata letak 2 kotak berdampingan:
/// - **Kotak Kiri**: Preview Struk Thermal fisik di atas + Rincian Tagihan/Uang/Kembalian di bawah.
/// - **Kotak Kanan**: Pemilih Metode (Tunai, QRIS, Debit/Kredit) di atas + Fast Cash / Form Kartu + Keypad Numpad di bawah.
/// - **Baris Bawah**: Tombol [C] Merah (10%) + Tombol [SELESAIKAN TRANSAKSI] Hijau (90%).
class PaymentCashPage extends StatefulWidget {
  const PaymentCashPage({
    super.key,
    required this.remainingMinor,
    required this.onSubmit,
    this.lines = const <CartLine>[],
    this.customerName = '',
    this.outletName = '',
  });

  /// Sisa tagihan yang harus ditutup tender ini.
  final int remainingMinor;

  final Future<void> Function(TenderDraft tender, int cashReceivedMinor)
      onSubmit;

  final List<CartLine> lines;
  final String customerName;
  final String outletName;

  @override
  State<PaymentCashPage> createState() => _PaymentCashPageState();
}

class _PaymentCashPageState extends State<PaymentCashPage> {
  TenderMethod _method = TenderMethod.cash;

  final TextEditingController _last4Ctrl = TextEditingController();
  final TextEditingController _traceCtrl = TextEditingController();

  /// Uang diterima dalam **Rupiah bulat** seperti yang diketik kasir (mode tunai).
  int _rupiah = 0;
  bool _saving = false;

  int get _receivedMinor =>
      _method == TenderMethod.cash ? _rupiah * 100 : widget.remainingMinor;

  int get _changeMinor => _receivedMinor - widget.remainingMinor;

  bool get _insufficient =>
      _method == TenderMethod.cash && _changeMinor < 0;

  bool get _isCardValid {
    if (_method != TenderMethod.debit && _method != TenderMethod.credit) {
      return true;
    }
    return _last4Ctrl.text.trim().length == 4 &&
        _traceCtrl.text.trim().isNotEmpty;
  }

  bool get _canSubmit {
    if (_saving) return false;
    if (_method == TenderMethod.cash) return !_insufficient;
    if (_method == TenderMethod.debit || _method == TenderMethod.credit) {
      return _isCardValid;
    }
    return true; // QRIS selalu pas
  }

  @override
  void dispose() {
    _last4Ctrl.dispose();
    _traceCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit({int? cashReceivedMinor}) async {
    final int received = cashReceivedMinor ?? _receivedMinor;
    if (_method == TenderMethod.cash && received < widget.remainingMinor) return;
    if ((_method == TenderMethod.debit || _method == TenderMethod.credit) &&
        !_isCardValid) {
      return;
    }
    if (_saving) return;

    setState(() => _saving = true);
    try {
      final TenderDraft tender = TenderDraft(
        method: _method,
        amountMinor: widget.remainingMinor,
        cardLast4:
            (_method == TenderMethod.debit || _method == TenderMethod.credit)
                ? _last4Ctrl.text.trim()
                : null,
        traceNumber:
            (_method == TenderMethod.debit || _method == TenderMethod.credit)
                ? _traceCtrl.text.trim()
                : null,
      );
      await widget.onSubmit(tender, received);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// ⚡ Auto-Submit otomatis saat kasir mengklik salah satu tombol Fast Cash.
  void _onFastCashSelected(int presetMinor) {
    if (_saving) return;
    setState(() => _rupiah = presetMinor ~/ 100);
    _submit(cashReceivedMinor: presetMinor);
  }

  void _clearAll() {
    setState(() {
      _rupiah = 0;
      _last4Ctrl.clear();
      _traceCtrl.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final bool isWide = MediaQuery.of(context).size.width >= 600;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppBar(
        title: const Text('Cashout / Pembayaran'),
        actions: <Widget>[
          if (widget.remainingMinor == 0)
            Padding(
              padding: const EdgeInsets.only(right: Gap.md),
              child: Center(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: t.warning.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(Radii.sm),
                  ),
                  child: Text(
                    'TRANSAKSI AUDIT / RP 0',
                    style: PosText.xs.copyWith(
                      color: t.warning,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Expanded(
              child: isWide
                  ? Padding(
                      padding: const EdgeInsets.all(Gap.md),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          // KOTAK KIRI (Preview Struk + Rincian Tagihan)
                          Expanded(
                            flex: 1,
                            child: _buildLeftBox(context),
                          ),
                          const SizedBox(width: Gap.md),
                          // KOTAK KANAN (Metode + Presets/Form Kartu + Keypad)
                          Expanded(
                            flex: 1,
                            child: _buildRightBox(context),
                          ),
                        ],
                      ),
                    )
                  : ListView(
                      padding: const EdgeInsets.all(Gap.md),
                      children: <Widget>[
                        _buildLeftBox(context),
                        const SizedBox(height: Gap.md),
                        _buildRightBox(context),
                      ],
                    ),
            ),

            // BARIS AKSI BAWAH: [C] Merah (10%) + [SELESAIKAN TRANSAKSI] Hijau (90%)
            _buildBottomActionBar(context),
          ],
        ),
      ),
    );
  }

  /// Kotak Kiri: Slip Preview Struk Thermal di atas + Card Rincian di bawah
  Widget _buildLeftBox(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final bool isAllWaste = widget.lines.isNotEmpty &&
        widget.lines.every(
          (CartLine l) => l.note.toLowerCase().contains('waste'),
        );
    final String storeTitle = widget.outletName.isNotEmpty
        ? widget.outletName
        : 'POS GODINOV';

    return Container(
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: t.border),
      ),
      padding: const EdgeInsets.all(Gap.md),
      child: Column(
        children: <Widget>[
          // 1. Slip Preview Struk Thermal (Scrollable)
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(Radii.md),
                border: Border.all(color: Colors.black12),
                boxShadow: const <BoxShadow>[
                  BoxShadow(
                    color: Colors.black12,
                    blurRadius: 4,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(Gap.md),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    // Header Struk
                    Center(
                      child: Text(
                        storeTitle,
                        style: PosText.base.copyWith(
                          color: Colors.black87,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Center(
                      child: Text(
                        _currentDateTimeText(),
                        style: PosText.xsMono.copyWith(color: Colors.black54),
                      ),
                    ),
                    if (widget.customerName.isNotEmpty) ...<Widget>[
                      const SizedBox(height: 2),
                      Center(
                        child: Text(
                          'Pelanggan: ${widget.customerName}',
                          style: PosText.xsMono.copyWith(color: Colors.black54),
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      '- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -',
                      textAlign: TextAlign.center,
                      style: PosText.xsMono.copyWith(color: Colors.black38),
                    ),
                    const SizedBox(height: 6),

                    // Daftar Item
                    if (widget.lines.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: Gap.md),
                        child: Text(
                          'Tagihan Langsung: ${Money.format(widget.remainingMinor)}',
                          textAlign: TextAlign.center,
                          style: PosText.sm.copyWith(color: Colors.black87),
                        ),
                      )
                    else
                      ...widget.lines.map((CartLine item) {
                        final bool isItemWaste =
                            item.note.toLowerCase().contains('waste');
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(
                                      '${item.quantity}× ${item.productName}',
                                      style: PosText.sm.copyWith(
                                        color: Colors.black87,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    if (item.note.isNotEmpty)
                                      Text(
                                        item.note,
                                        style: PosText.xsMono.copyWith(
                                          color: isItemWaste
                                              ? Colors.red.shade700
                                              : Colors.black54,
                                          fontWeight: isItemWaste
                                              ? FontWeight.w700
                                              : FontWeight.normal,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              Text(
                                Money.format(item.lineTotalMinor),
                                style: PosText.moneySm.copyWith(
                                  color: Colors.black87,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        );
                      }),

                    const SizedBox(height: 6),
                    Text(
                      '- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -',
                      textAlign: TextAlign.center,
                      style: PosText.xsMono.copyWith(color: Colors.black38),
                    ),
                    const SizedBox(height: 6),

                    // Subtotal & Total
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: <Widget>[
                        Text(
                          'TOTAL',
                          style: PosText.base.copyWith(
                            color: Colors.black87,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          Money.format(widget.remainingMinor),
                          style: PosText.base.copyWith(
                            color: Colors.black87,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 8),
                    Text(
                      '- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -',
                      textAlign: TextAlign.center,
                      style: PosText.xsMono.copyWith(color: Colors.black38),
                    ),
                    const SizedBox(height: 8),

                    // Watermark / Label Preview
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: isAllWaste
                              ? Colors.red.shade50
                              : Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: isAllWaste
                                ? Colors.red.shade200
                                : Colors.black12,
                          ),
                        ),
                        child: Text(
                          isAllWaste
                              ? '*** BUKTI WASTE PRODUK ***'
                              : '*** PREVIEW STRUK FISIK THERMAL ***',
                          style: PosText.xs.copyWith(
                            color: isAllWaste
                                ? Colors.red.shade800
                                : Colors.black87,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          const SizedBox(height: Gap.md),

          // 2. Card Rincian Tagihan, Bayar, Kembalian
          Container(
            padding: const EdgeInsets.all(Gap.md),
            decoration: BoxDecoration(
              color: t.bg,
              borderRadius: BorderRadius.circular(Radii.md),
              border: Border.all(color: t.border),
            ),
            child: Column(
              children: <Widget>[
                _Row(label: 'Tagihan', minor: widget.remainingMinor),
                const Divider(height: Gap.md),
                _Row(
                  label: 'Uang diterima',
                  minor: _receivedMinor,
                  size: MoneySize.xl,
                ),
                const SizedBox(height: Gap.xs),
                _Row(
                  label: 'Kembalian',
                  minor: _changeMinor,
                  size: MoneySize.xl,
                  tone: _insufficient
                      ? MoneyTone.danger
                      : _changeMinor > 0
                          ? MoneyTone.success
                          : MoneyTone.normal,
                  signed: true,
                ),
                if (_insufficient) ...<Widget>[
                  const SizedBox(height: Gap.xs),
                  Text(
                    '⚠ Uang yang diterima belum menutupi tagihan.',
                    style: PosText.xs.copyWith(color: t.danger),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Kotak Kanan: Selector Metode + Area Dinamis (Fast Cash/Kartu/QRIS) + Keypad
  Widget _buildRightBox(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: t.border),
      ),
      padding: const EdgeInsets.all(Gap.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          // 1. Selector Metode Pembayaran di Paling Atas
          Row(
            children: <Widget>[
              Expanded(
                child: _MethodTabButton(
                  icon: Icons.payments_outlined,
                  label: 'Tunai',
                  selected: _method == TenderMethod.cash,
                  onTap: () => setState(() => _method = TenderMethod.cash),
                ),
              ),
              const SizedBox(width: Gap.xs),
              Expanded(
                child: _MethodTabButton(
                  icon: Icons.qr_code_2,
                  label: 'QRIS',
                  selected: _method == TenderMethod.qris,
                  onTap: () => setState(() => _method = TenderMethod.qris),
                ),
              ),
              const SizedBox(width: Gap.xs),
              Expanded(
                child: _MethodTabButton(
                  icon: Icons.credit_card,
                  label: 'Debit/Kredit',
                  selected: _method == TenderMethod.debit ||
                      _method == TenderMethod.credit,
                  onTap: () => setState(() => _method = TenderMethod.debit),
                ),
              ),
            ],
          ),

          const SizedBox(height: Gap.sm),

          // 2. Area Dinamis: Fast Cash (Tunai), Form Kartu (Debit/Kredit), atau QRIS
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(Gap.sm),
              decoration: BoxDecoration(
                color: t.bg,
                borderRadius: BorderRadius.circular(Radii.md),
                border: Border.all(color: t.border),
              ),
              child: switch (_method) {
                TenderMethod.cash => _buildCashPresets(context),
                TenderMethod.debit ||
                TenderMethod.credit =>
                  _buildCardForm(context),
                _ => _buildQrisDisplay(context),
              },
            ),
          ),

          const SizedBox(height: Gap.sm),

          // 3. Keypad Numpad
          SizedBox(
            height: 240,
            child: PosNumpad(
              enabled: !_saving,
              onDigits: (String digits) {
                if (_method != TenderMethod.cash) return;
                setState(() {
                  for (final int _ in Iterable<int>.generate(digits.length)) {
                    _rupiah *= 10;
                  }
                  _rupiah += int.tryParse(digits) ?? 0;
                });
              },
              onBackspace: () {
                if (_method != TenderMethod.cash) return;
                setState(() => _rupiah = _rupiah ~/ 10);
              },
              onClear: () {
                if (_method != TenderMethod.cash) return;
                setState(() => _rupiah = 0);
              },
            ),
          ),
        ],
      ),
    );
  }

  /// Preset Nominal Cepat Tunai — auto-submit instan saat ditekan!
  Widget _buildCashPresets(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final List<int> presets = widget.remainingMinor <= 0
        ? <int>[0]
        : FastCash.presets(widget.remainingMinor);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Icon(Icons.bolt, size: 16, color: t.accent),
            const SizedBox(width: 4),
            Text(
              'NOMINAL CEPAT (Klik untuk Selesai Otomatis):',
              style: PosText.xs.copyWith(
                fontWeight: FontWeight.w700,
                color: t.fgMuted,
                letterSpacing: 0.4,
              ),
            ),
          ],
        ),
        const SizedBox(height: Gap.xs),
        Expanded(
          child: LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              return Wrap(
                spacing: Gap.sm,
                runSpacing: Gap.xs,
                children: <Widget>[
                  // Tombol Uang Pas
                  SizedBox(
                    width: (constraints.maxWidth - Gap.sm) / 2,
                    height: 52,
                    child: TouchButton(
                      label: widget.remainingMinor <= 0
                          ? 'Rp 0 (Pas)'
                          : 'UANG PAS',
                      variant: TouchVariant.secondary,
                      onPressed: () =>
                          _onFastCashSelected(widget.remainingMinor),
                    ),
                  ),
                  for (final int preset in presets)
                    if (preset != widget.remainingMinor)
                      SizedBox(
                        width: (constraints.maxWidth - Gap.sm) / 2,
                        height: 52,
                        child: TouchButton(
                          label: Money.format(preset),
                          variant: TouchVariant.secondary,
                          onPressed: () => _onFastCashSelected(preset),
                        ),
                      ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }

  /// Form input 4 digit terakhir nomor kartu & trace ID EDC
  Widget _buildCardForm(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(Icons.credit_card, size: 16, color: t.accent),
              const SizedBox(width: 4),
              Text(
                'DETAIL KARTU & EDC',
                style: PosText.xs.copyWith(
                  fontWeight: FontWeight.w700,
                  color: t.fgMuted,
                  letterSpacing: 0.4,
                ),
              ),
            ],
          ),
          const SizedBox(height: Gap.xs),
          Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Text('4 Digit Terakhir', style: PosText.xs),
                    const SizedBox(height: 2),
                    SizedBox(
                      height: 44,
                      child: TextField(
                        controller: _last4Ctrl,
                        keyboardType: TextInputType.number,
                        inputFormatters: <TextInputFormatter>[
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(4),
                        ],
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(
                          hintText: 'Mis. 1234',
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: Gap.sm,
                            vertical: Gap.xs,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Text('Trace ID / No Ref', style: PosText.xs),
                    const SizedBox(height: 2),
                    SizedBox(
                      height: 44,
                      child: TextField(
                        controller: _traceCtrl,
                        inputFormatters: <TextInputFormatter>[
                          LengthLimitingTextInputFormatter(12),
                        ],
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(
                          hintText: 'Nomor Trace EDC',
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: Gap.sm,
                            vertical: Gap.xs,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: Gap.xs),
          Text(
            'Nominal gesek otomatis pas: ${Money.format(widget.remainingMinor)}',
            style: PosText.xs.copyWith(
              color: t.successText,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  /// Display panduan pembayaran QRIS
  Widget _buildQrisDisplay(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.qr_code_2, size: 54, color: t.accent),
          const SizedBox(height: 4),
          Text(
            'Tunjukkan QRIS Dinamis ke Pelanggan',
            style: PosText.sm.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 2),
          Text(
            'Tagihan Pas: ${Money.format(widget.remainingMinor)}',
            style: PosText.xs.copyWith(color: t.fgMuted),
          ),
        ],
      ),
    );
  }

  /// Baris Aksi Bawah: [C] Merah (10%) + [SELESAIKAN TRANSAKSI] Hijau (90%)
  Widget _buildBottomActionBar(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: Gap.md,
        vertical: Gap.sm,
      ),
      decoration: BoxDecoration(
        color: t.surface,
        border: Border(top: BorderSide(color: t.border)),
      ),
      child: Row(
        children: <Widget>[
          // Tombol Clear All [ C ] — porsi 10%
          SizedBox(
            width: 72,
            height: Touch.critical,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: t.danger,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(Radii.md),
                ),
                padding: EdgeInsets.zero,
              ),
              onPressed: _saving ? null : _clearAll,
              child: const Text(
                'C',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
          const SizedBox(width: Gap.sm),

          // Tombol Selesaikan Transaksi — porsi 90%
          Expanded(
            child: TouchButton(
              label: _saving ? 'MENYIMPAN…' : 'SELESAIKAN TRANSAKSI',
              variant: TouchVariant.success,
              height: Touch.critical,
              isLoading: _saving,
              onPressed: _canSubmit ? _submit : null,
            ),
          ),
        ],
      ),
    );
  }

  String _currentDateTimeText() {
    final DateTime now = DateTime.now();
    return '${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year} '
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
  }
}

class _MethodTabButton extends StatelessWidget {
  const _MethodTabButton({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Radii.md),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? t.accent.withValues(alpha: 0.12)
              : t.bg,
          borderRadius: BorderRadius.circular(Radii.md),
          border: Border.all(
            color: selected ? t.accent : t.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Icon(
              icon,
              size: 16,
              color: selected ? t.accent : t.fgMuted,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: PosText.xs.copyWith(
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? t.accent : t.fg,
              ),
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
        Text(
          label,
          style: PosText.base.copyWith(color: context.tokens.fgMuted),
        ),
        MoneyText(minor, size: size, tone: tone, signed: signed),
      ],
    );
  }
}
