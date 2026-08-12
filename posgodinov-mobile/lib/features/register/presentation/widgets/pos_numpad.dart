import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';

/// Numpad virtual modal pembayaran ([06 §4.6.4]).
///
/// | Aspek | Spesifikasi |
/// |---|---|
/// | Tombol | 56 × 56 dp, grid 3 × 4, gutter 8 dp |
/// | Tata letak | `1 2 3` / `4 5 6` / `7 8 9` / `000 0 ⌫` — **tata letak telepon**, konvensi POS & mesin EDC |
/// | `000` | Tombol khusus Rupiah — mempercepat input nominal ribuan secara dramatis |
/// | Sisipan | Digit masuk dari kanan, seperti kalkulator kasir |
/// | Batas | 9 digit (`Rp 999.999.999`) |
///
/// Field nominalnya sendiri memakai `inputMode: none` agar keyboard OS tidak
/// muncul dan menutupi layar.
class PosNumpad extends StatelessWidget {
  const PosNumpad({
    super.key,
    required this.onDigits,
    required this.onBackspace,
    required this.onClear,
    this.enabled = true,
  });

  /// Menerima `'0'`–`'9'` maupun `'000'`.
  final ValueChanged<String> onDigits;
  final VoidCallback onBackspace;
  final VoidCallback onClear;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 264),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (final List<String> row in const <List<String>>[
            <String>['1', '2', '3'],
            <String>['4', '5', '6'],
            <String>['7', '8', '9'],
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: Gap.sm),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  for (int i = 0; i < row.length; i++) ...<Widget>[
                    if (i > 0) const SizedBox(width: Gap.sm),
                    _Key(
                      label: row[i],
                      enabled: enabled,
                      onPressed: () => onDigits(row[i]),
                    ),
                  ],
                ],
              ),
            ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              _Key(
                label: '000',
                enabled: enabled,
                onPressed: () => onDigits('000'),
              ),
              const SizedBox(width: Gap.sm),
              _Key(label: '0', enabled: enabled, onPressed: () => onDigits('0')),
              const SizedBox(width: Gap.sm),
              _Key(
                icon: Icons.backspace_outlined,
                enabled: enabled,
                isDanger: true,
                onPressed: onBackspace,
                semanticLabel: 'Hapus satu digit',
              ),
            ],
          ),
          const SizedBox(height: Gap.sm),
          SizedBox(
            width: 264,
            height: Touch.standard,
            child: OutlinedButton(
              onPressed: enabled ? onClear : null,
              style: OutlinedButton.styleFrom(
                foregroundColor: context.tokens.danger,
                side: BorderSide(color: context.tokens.borderStrong),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(Radii.md),
                ),
              ),
              child: Text('C  Hapus', style: PosText.base),
            ),
          ),
        ],
      ),
    );
  }
}

class _Key extends StatelessWidget {
  const _Key({
    this.label,
    this.icon,
    required this.enabled,
    required this.onPressed,
    this.isDanger = false,
    this.semanticLabel,
  });

  final String? label;
  final IconData? icon;
  final bool enabled;
  final VoidCallback onPressed;
  final bool isDanger;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final Color fg = isDanger ? t.danger : t.fg;

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
            foregroundColor: fg,
            backgroundColor: t.surface,
            padding: EdgeInsets.zero,
            side: BorderSide(color: t.borderStrong),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(Radii.md),
            ),
          ),
          child: icon != null
              ? Icon(icon, size: 22)
              : FittedBox(
                  child: Text(
                    label!,
                    style: PosText.moneyLg.copyWith(color: fg),
                  ),
                ),
        ),
      ),
    );
  }
}

/// Menyisipkan digit dari kanan, seperti kalkulator kasir.
///
/// `5` → `Rp 5`, lalu `0` → `Rp 50`, lalu `000` → `Rp 50.000`.
/// Mengembalikan nilai dalam **Rupiah bulat**, dibatasi 9 digit.
int appendDigits(int currentRupiah, String digits) {
  const int maxRupiah = 999999999;

  int hasil = currentRupiah;
  for (int i = 0; i < digits.length; i++) {
    final int d = int.parse(digits[i]);
    final int berikutnya = hasil * 10 + d;
    if (berikutnya > maxRupiah) return hasil; // batas tercapai, abaikan sisanya
    hasil = berikutnya;
  }
  return hasil;
}

/// Menghapus satu digit dari kanan.
int removeLastDigit(int currentRupiah) => currentRupiah ~/ 10;
