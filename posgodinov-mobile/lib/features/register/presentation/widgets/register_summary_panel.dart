import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/cart_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';

/// Panel ringkasan sisi kanan:
/// 1. Kolom Member Card (mock 123456789)
/// 2. Subtotal besar
/// 3. [SLOT PROMO]
/// 4. Tombol CASHOUT raksasa yang memenuhi area bawah.
class RegisterSummaryPanel extends StatelessWidget {
  const RegisterSummaryPanel({
    super.key,
    required this.state,
    required this.onCashout,
    this.memberId = '123456789',
    this.memberName = 'Member Godinov',
    this.onMemberTap,
  });

  final CartState state;
  final VoidCallback? onCashout;
  final String memberId;
  final String memberName;
  final VoidCallback? onMemberTap;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      color: t.bgMuted,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          // 1. INPUT MEMBER (Di paling atas Sub Total)
          InkWell(
            onTap: onMemberTap,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: Gap.md,
                vertical: Gap.sm,
              ),
              decoration: BoxDecoration(
                color: t.surface,
                border: Border(bottom: BorderSide(color: t.border)),
              ),
              child: Row(
                children: <Widget>[
                  Icon(
                    Icons.card_membership_rounded,
                    color: t.brand,
                    size: 20,
                  ),
                  const SizedBox(width: Gap.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          'MEMBER',
                          style: PosText.xs.copyWith(
                            color: t.fgMuted,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                          ),
                        ),
                        Text(
                          '$memberId • $memberName',
                          style: PosText.sm.copyWith(
                            fontWeight: FontWeight.w600,
                            color: t.fg,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right,
                    size: 20,
                    color: t.fgSubtle,
                  ),
                ],
              ),
            ),
          ),

          // 2. SUB TOTAL BESAR DI ATAS
          Container(
            padding: const EdgeInsets.all(Gap.lg),
            decoration: BoxDecoration(
              color: t.surface,
              border: Border(bottom: BorderSide(color: t.border)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'SUB TOTAL',
                  style: PosText.sm.copyWith(
                    color: t.fgMuted,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: Gap.xs),
                MoneyText(state.totalMinor, size: MoneySize.xxl),
                const SizedBox(height: Gap.xs),
                Text(
                  '${state.itemCount} item terpilih',
                  style: PosText.xs.copyWith(color: t.fgSubtle),
                ),
              ],
            ),
          ),

          // 3. [SLOT PROMO] DI BAWAH SUB TOTAL
          Expanded(
            child: Container(
              margin: const EdgeInsets.all(Gap.md),
              padding: const EdgeInsets.all(Gap.lg),
              decoration: BoxDecoration(
                color: t.surface,
                borderRadius: BorderRadius.circular(Radii.md),
                border: Border.all(
                  color: t.border,
                  style: BorderStyle.solid,
                ),
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Icon(
                      Icons.local_offer_outlined,
                      size: 44,
                      color: t.fgSubtle,
                    ),
                    const SizedBox(height: Gap.sm),
                    Text(
                      'SLOT PROMO',
                      style: PosText.base.copyWith(
                        color: t.fgMuted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: Gap.xs),
                    Text(
                      'Tidak ada promo aktif',
                      style: PosText.xs.copyWith(color: t.fgSubtle),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 4. TOMBOL CASHOUT SUPER BESAR (MEMENUHI SELURUH AREA BAWAH)
          Container(
            padding: const EdgeInsets.all(Gap.md),
            decoration: BoxDecoration(
              color: t.surface,
              border: Border(top: BorderSide(color: t.border)),
            ),
            child: SizedBox(
              height: 80,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: t.success,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: t.bgMuted,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(Radii.lg),
                  ),
                ),
                icon: const Icon(Icons.payments_outlined, size: 36),
                label: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Text(
                      'CASHOUT',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.2,
                      ),
                    ),
                    Text(
                      state.isEmpty
                          ? 'Pilih produk untuk bayar'
                          : 'Selesaikan Pembayaran Tunai',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                    ),
                  ],
                ),
                onPressed: state.isEmpty ? null : onCashout,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
