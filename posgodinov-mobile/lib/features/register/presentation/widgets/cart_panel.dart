import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/cart_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// Panel keranjang — kolom kanan 38 % pada tablet ([06 §4.4]).
class CartPanel extends StatelessWidget {
  const CartPanel({
    super.key,
    required this.state,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
    required this.onClear,
    required this.onHold,
    required this.onPay,
  });

  final CartState state;
  final ValueChanged<String> onIncrement;
  final ValueChanged<String> onDecrement;
  final ValueChanged<String> onRemove;
  final VoidCallback onClear;
  final VoidCallback onHold;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      color: t.bgMuted,
      child: Column(
        children: <Widget>[
          _Header(itemCount: state.itemCount, onClear: onClear),
          Expanded(
            child: state.isEmpty
                ? const _EmptyCart()
                : ListView.separated(
                    padding: const EdgeInsets.all(Gap.md),
                    itemCount: state.lines.length,
                    separatorBuilder: (_, __) => const SizedBox(height: Gap.sm),
                    itemBuilder: (BuildContext context, int i) {
                      final CartLine line = state.lines[i];
                      return CartLineTile(
                        line: line,
                        onIncrement: () => onIncrement(line.id),
                        onDecrement: () => onDecrement(line.id),
                        onRemove: () => onRemove(line.id),
                      );
                    },
                  ),
          ),
          _Footer(
            state: state,
            onHold: state.isEmpty ? null : onHold,
            onPay: state.isEmpty ? null : onPay,
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.itemCount, required this.onClear});

  final int itemCount;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      height: Touch.standard,
      padding: const EdgeInsets.symmetric(horizontal: Gap.md),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: t.border)),
      ),
      child: Row(
        children: <Widget>[
          Text('KERANJANG', style: PosText.sm.copyWith(color: t.fgMuted)),
          const SizedBox(width: Gap.sm),
          Text('$itemCount item', style: PosText.xsMono.copyWith(color: t.fg)),
          const Spacer(),
          // "Kosongkan" diletakkan di HEADER, bukan di sudut bawah: sudut bawah
          // adalah tempat telapak tangan menyentuh saat memegang tablet
          // ([06 §2.1]).
          if (itemCount > 0)
            TextButton(
              onPressed: onClear,
              style: TextButton.styleFrom(
                foregroundColor: t.danger,
                minimumSize: const Size(Touch.standard, Touch.standard),
              ),
              child: Text('Kosongkan', style: PosText.sm),
            ),
        ],
      ),
    );
  }
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart();

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Gap.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.shopping_cart_outlined, size: 48, color: t.fgSubtle),
            const SizedBox(height: Gap.md),
            Text(
              'Keranjang kosong',
              style: PosText.base.copyWith(color: t.fgMuted),
            ),
            const SizedBox(height: Gap.xs),
            Text(
              'Ketuk produk untuk menambahkan.',
              textAlign: TextAlign.center,
              style: PosText.sm.copyWith(color: t.fgSubtle),
            ),
          ],
        ),
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.state, required this.onHold, required this.onPay});

  final CartState state;
  final VoidCallback? onHold;
  final VoidCallback? onPay;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: t.surface,
        border: Border(top: BorderSide(color: t.border)),
      ),
      child: Column(
        children: <Widget>[
          _TotalRow(
            label: 'Subtotal',
            minor: state.subtotalMinor,
            size: MoneySize.lg,
            muted: true,
          ),
          const SizedBox(height: Gap.xs),
          _TotalRow(
            label: 'TOTAL',
            minor: state.totalMinor,
            size: MoneySize.xl,
            muted: false,
          ),
          const SizedBox(height: Gap.md),
          Row(
            children: <Widget>[
              Expanded(
                child: TouchButton(
                  label: 'Tahan',
                  variant: TouchVariant.secondary,
                  onPressed: onHold,
                ),
              ),
              // 24 dp memisahkan "Tahan" dari "Bayar" ([06 §2.2]).
              const SizedBox(width: Gap.destructive),
              Expanded(
                flex: 2,
                child: TouchButton(
                  label: 'BAYAR',
                  variant: TouchVariant.success,
                  onPressed: onPay,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({
    required this.label,
    required this.minor,
    required this.size,
    required this.muted,
  });

  final String label;
  final int minor;
  final MoneySize size;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(
          label,
          style: PosText.sm.copyWith(
            color: muted ? context.tokens.fgMuted : context.tokens.fg,
            fontWeight: muted ? FontWeight.w500 : FontWeight.w700,
          ),
        ),
        MoneyText(
          minor,
          size: size,
          tone: muted ? MoneyTone.muted : MoneyTone.normal,
        ),
      ],
    );
  }
}

/// Satu baris keranjang dengan stepper kuantitas ([06 §4.5]).
class CartLineTile extends StatelessWidget {
  const CartLineTile({
    super.key,
    required this.line,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
  });

  final CartLine line;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: t.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Text(
                  line.productName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: PosText.base,
                ),
              ),
              IconButton(
                onPressed: onRemove,
                icon: const Icon(Icons.close),
                color: t.fgSubtle,
                tooltip: 'Hapus baris',
                constraints: const BoxConstraints(
                  minWidth: Touch.standard,
                  minHeight: Touch.standard,
                ),
              ),
            ],
          ),
          Row(
            children: <Widget>[
              MoneyText(line.unitPriceMinor, size: MoneySize.sm,
                  tone: MoneyTone.muted),
              Text(
                ' × ${line.quantity}',
                style: PosText.xsMono.copyWith(color: t.fgMuted),
              ),
            ],
          ),
          if (line.note.isNotEmpty) ...<Widget>[
            const SizedBox(height: Gap.xs),
            Text(
              '• ${line.note}',
              style: PosText.xs.copyWith(color: t.fgMuted),
            ),
          ],
          const SizedBox(height: Gap.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Row(
                children: <Widget>[
                  _StepperButton(
                    icon: Icons.remove,
                    onPressed: onDecrement,
                    semanticLabel: 'Kurangi ${line.productName}',
                  ),
                  SizedBox(
                    width: 48,
                    child: Text(
                      '${line.quantity}',
                      textAlign: TextAlign.center,
                      style: PosText.moneyMd.copyWith(color: t.fg),
                    ),
                  ),
                  _StepperButton(
                    icon: Icons.add,
                    onPressed: onIncrement,
                    semanticLabel: 'Tambah ${line.productName}',
                  ),
                ],
              ),
              MoneyText(line.lineTotalMinor, size: MoneySize.md),
            ],
          ),
        ],
      ),
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({
    required this.icon,
    required this.onPressed,
    required this.semanticLabel,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Semantics(
      label: semanticLabel,
      button: true,
      child: SizedBox(
        // Kelas "sering" — 56 dp ([06 §2.1]).
        width: Touch.frequent,
        height: Touch.frequent,
        child: OutlinedButton(
          onPressed: () {
            HapticFeedback.selectionClick();
            onPressed();
          },
          style: OutlinedButton.styleFrom(
            padding: EdgeInsets.zero,
            foregroundColor: t.fg,
            side: BorderSide(color: t.borderStrong),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(Radii.sm),
            ),
          ),
          child: Icon(icon, size: 20),
        ),
      ),
    );
  }
}
