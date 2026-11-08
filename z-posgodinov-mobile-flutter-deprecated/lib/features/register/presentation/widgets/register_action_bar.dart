import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';

/// Action Bar Kotak di bagian bawah tabel produk terpilih:
/// [ Tahan ] [ Riwayat ] [ Waste ] [ Void Transaksi ] [ Tutup Shift ]
class RegisterActionBar extends StatelessWidget {
  const RegisterActionBar({
    super.key,
    required this.onHold,
    required this.onHistory,
    required this.onWaste,
    required this.onVoidTransaction,
    required this.onCloseShift,
    required this.heldCount,
    required this.hasItems,
    this.isAuditLocked = false,
  });

  final VoidCallback? onHold;
  final VoidCallback onHistory;
  final VoidCallback onWaste;
  final VoidCallback? onVoidTransaction;
  final VoidCallback onCloseShift;
  final int heldCount;
  final bool hasItems;
  final bool isAuditLocked;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.sm),
      decoration: BoxDecoration(
        color: t.surface,
        border: Border(top: BorderSide(color: t.border)),
      ),
      child: Row(
        children: <Widget>[
          // 1. TAHAN
          Expanded(
            child: _ActionSquareButton(
              icon: Icons.pause_circle_outline,
              label: heldCount > 0 ? 'Tahan ($heldCount)' : 'Tahan',
              color: t.fg,
              bgColor: t.bg,
              badgeCount: heldCount,
              onPressed: isAuditLocked ? null : (hasItems ? onHold : null),
            ),
          ),
          const SizedBox(width: Gap.sm),

          // 2. RIWAYAT
          Expanded(
            child: _ActionSquareButton(
              icon: Icons.history_rounded,
              label: 'Riwayat',
              color: t.fg,
              bgColor: t.bg,
              onPressed: isAuditLocked ? null : onHistory,
            ),
          ),
          const SizedBox(width: Gap.sm),

          // 3. WASTE
          Expanded(
            child: _ActionSquareButton(
              icon: Icons.delete_sweep_outlined,
              label: 'Waste',
              color: t.warning,
              bgColor: t.warning.withValues(alpha: 0.08),
              onPressed: isAuditLocked ? null : onWaste,
            ),
          ),
          const SizedBox(width: Gap.sm),

          // 4. VOID TRANSAKSI
          Expanded(
            child: _ActionSquareButton(
              icon: Icons.cancel_outlined,
              label: 'Void',
              color: t.danger,
              bgColor: t.danger.withValues(alpha: 0.1),
              onPressed: isAuditLocked ? null : (hasItems ? onVoidTransaction : null),
            ),
          ),
          const SizedBox(width: Gap.sm),

          // 5. TUTUP SHIFT
          Expanded(
            child: _ActionSquareButton(
              icon: Icons.lock_clock_outlined,
              label: 'Tutup Shift',
              color: t.fgMuted,
              bgColor: t.bg,
              onPressed: isAuditLocked ? null : onCloseShift,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionSquareButton extends StatelessWidget {
  const _ActionSquareButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.bgColor,
    this.badgeCount = 0,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final Color color;
  final Color bgColor;
  final int badgeCount;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final bool isEnabled = onPressed != null;

    return SizedBox(
      height: 72,
      child: Material(
        color: isEnabled ? bgColor : t.bgMuted,
        borderRadius: BorderRadius.circular(Radii.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.md),
          onTap: onPressed,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Radii.md),
              border: Border.all(
                color: isEnabled ? color.withValues(alpha: 0.3) : t.border,
              ),
            ),
            padding: const EdgeInsets.symmetric(
              horizontal: Gap.xs,
              vertical: Gap.xs,
            ),
            child: Stack(
              clipBehavior: Clip.none,
              children: <Widget>[
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: <Widget>[
                      Icon(
                        icon,
                        color: isEnabled ? color : t.fgSubtle,
                        size: 26,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        label,
                        style: PosText.xs.copyWith(
                          color: isEnabled ? color : t.fgSubtle,
                          fontWeight: FontWeight.w700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (badgeCount > 0)
                  Positioned(
                    top: 2,
                    right: 2,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: t.danger,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 18,
                        minHeight: 18,
                      ),
                      child: Text(
                        '$badgeCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
