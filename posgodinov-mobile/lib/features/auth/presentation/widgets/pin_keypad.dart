import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';

/// Papan tombol numerik 3 × 4 untuk PIN kasir ([06 §3.6]).
///
/// **Tata letak telepon** (`1 2 3` di baris atas), bukan kalkulator — konvensi
/// POS dan mesin EDC. Kasir yang berpindah dari mesin lama membawa memori otot
/// yang sama.
///
/// Setiap tombol berukuran [Touch.frequent] (56 dp): salah tekan hanya mengubah
/// satu digit yang mudah dikoreksi, tetapi sering terjadi.
class PinKeypad extends StatelessWidget {
  const PinKeypad({
    super.key,
    required this.onDigit,
    required this.onBackspace,
    required this.onClear,
    this.enabled = true,
  });

  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;
  final VoidCallback onClear;
  final bool enabled;

  static const List<String> _rows = <String>[
    '1', '2', '3', //
    '4', '5', '6', //
    '7', '8', '9', //
  ];

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 264),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (int row = 0; row < 3; row++)
            Padding(
              padding: const EdgeInsets.only(bottom: Gap.sm),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  for (int col = 0; col < 3; col++) ...<Widget>[
                    if (col > 0) const SizedBox(width: Gap.sm),
                    _KeypadButton(
                      label: _rows[row * 3 + col],
                      enabled: enabled,
                      onPressed: () => onDigit(_rows[row * 3 + col]),
                    ),
                  ],
                ],
              ),
            ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              _KeypadButton(
                label: 'C',
                enabled: enabled,
                isDanger: true,
                onPressed: onClear,
                semanticLabel: 'Kosongkan PIN',
              ),
              const SizedBox(width: Gap.sm),
              _KeypadButton(
                label: '0',
                enabled: enabled,
                onPressed: () => onDigit('0'),
              ),
              const SizedBox(width: Gap.sm),
              _KeypadButton(
                icon: Icons.backspace_outlined,
                enabled: enabled,
                isDanger: true,
                onPressed: onBackspace,
                semanticLabel: 'Hapus satu digit',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _KeypadButton extends StatelessWidget {
  const _KeypadButton({
    this.label,
    this.icon,
    required this.enabled,
    required this.onPressed,
    this.isDanger = false,
    this.semanticLabel,
  }) : assert(
          label != null || icon != null,
          'Tombol keypad harus punya label atau ikon.',
        );

  final String? label;
  final IconData? icon;
  final bool enabled;
  final VoidCallback onPressed;
  final bool isDanger;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final Color foreground = isDanger ? t.danger : t.fg;

    return Semantics(
      label: semanticLabel,
      button: true,
      child: SizedBox(
        width: Touch.frequent,
        height: Touch.frequent,
        child: OutlinedButton(
          onPressed: enabled
              ? () {
                  HapticFeedback.selectionClick();
                  onPressed();
                }
              : null,
          style: OutlinedButton.styleFrom(
            foregroundColor: foreground,
            backgroundColor: t.surface,
            padding: EdgeInsets.zero,
            side: BorderSide(color: t.borderStrong),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(Radii.md),
            ),
          ),
          child: icon != null
              ? Icon(icon, size: 22)
              : Text(
                  label!,
                  // Digit memakai monospace agar lebarnya seragam ([06 §2.6]).
                  style: PosText.moneyLg.copyWith(color: foreground),
                ),
        ),
      ),
    );
  }
}

/// Titik-titik penanda panjang PIN yang sudah diketik.
///
/// PIN **tidak pernah** ditampilkan sebagai angka — layar kasir menghadap ke
/// area publik.
class PinDots extends StatelessWidget {
  const PinDots({super.key, required this.length, this.maxLength = 6});

  final int length;
  final int maxLength;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Semantics(
      label: '$length dari maksimal $maxLength digit terisi',
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          for (int i = 0; i < maxLength; i++)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: Gap.xs),
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: i < length ? t.accent : Colors.transparent,
                border: Border.all(
                  color: i < length ? t.accent : t.borderStrong,
                  width: 2,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
