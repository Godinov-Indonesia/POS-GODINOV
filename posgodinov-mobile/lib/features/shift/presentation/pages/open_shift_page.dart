import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/features/auth/domain/entities/cashier_session.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-04 — Buka Shift.**
///
/// Kasir memasukkan modal awal laci. Nilai ini menjadi dasar `expected_balance`
/// saat tutup shift, dan `discrepancy` yang lahir darinya adalah angka yang
/// muncul di dashboard pemilik ([04 §A.3]) — jadi salah ketik di sini berbuntut
/// panjang.
class OpenShiftPage extends StatefulWidget {
  const OpenShiftPage({super.key, required this.session, this.onOpened});

  final CashierSession session;
  final VoidCallback? onOpened;

  @override
  State<OpenShiftPage> createState() => _OpenShiftPageState();
}

class _OpenShiftPageState extends State<OpenShiftPage> {
  /// Modal awal dalam **Rupiah bulat** seperti yang diketik kasir; dikonversi ke
  /// sen tepat sebelum disimpan.
  int _rupiah = 0;

  /// Pecahan yang benar-benar dipakai sebagai modal laci di Indonesia.
  static const List<int> _presets = <int>[100000, 200000, 500000, 1000000];

  int get _minor => _rupiah * 100;

  void _setFromText(String raw) {
    final String digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    setState(() => _rupiah = digits.isEmpty ? 0 : int.parse(digits));
  }

  void _submit() {
    context.read<ShiftCubit>().openShift(
          staffId: widget.session.staffId,
          openingBalanceMinor: _minor,
        );
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      appBar: AppBar(title: const Text('Buka Shift')),
      body: BlocConsumer<ShiftCubit, ShiftState>(
        listener: (BuildContext context, ShiftState state) {
          if (state is ShiftActive) widget.onOpened?.call();
        },
        builder: (BuildContext context, ShiftState state) {
          final bool busy = state is ShiftOpening;

          return Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(Gap.xl),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Text(
                      'Kasir bertugas',
                      style: PosText.sm.copyWith(color: t.fgMuted),
                    ),
                    const SizedBox(height: Gap.xs),
                    Text(widget.session.name, style: PosText.buttonLg),

                    const SizedBox(height: Gap.xxl),
                    Text(
                      'Modal Awal Laci',
                      style: PosText.sm.copyWith(color: t.fgMuted),
                    ),
                    const SizedBox(height: Gap.xs),
                    TextField(
                      enabled: !busy,
                      autofocus: true,
                      keyboardType: TextInputType.number,
                      inputFormatters: <TextInputFormatter>[
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(9),
                      ],
                      onChanged: _setFromText,
                      style: PosText.moneyXl,
                      decoration: const InputDecoration(
                        prefixText: 'Rp ',
                        hintText: '0',
                      ),
                    ),

                    const SizedBox(height: Gap.md),
                    // Pratinjau memakai MoneyText supaya kasir melihat nominal
                    // dalam format yang sama persis dengan struk nanti.
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: <Widget>[
                        Text(
                          'Tersimpan sebagai ',
                          style: PosText.sm.copyWith(color: t.fgMuted),
                        ),
                        MoneyText(_minor, size: MoneySize.md),
                      ],
                    ),

                    const SizedBox(height: Gap.xl),
                    Text(
                      'Pilih cepat',
                      style: PosText.sm.copyWith(color: t.fgMuted),
                    ),
                    const SizedBox(height: Gap.sm),
                    Wrap(
                      spacing: Gap.sm,
                      runSpacing: Gap.sm,
                      children: <Widget>[
                        for (final int preset in _presets)
                          SizedBox(
                            width: 140,
                            child: TouchButton(
                              label: 'Rp ${preset ~/ 1000}rb',
                              height: Touch.frequent,
                              variant: TouchVariant.secondary,
                              onPressed: busy
                                  ? null
                                  : () => setState(() => _rupiah = preset),
                            ),
                          ),
                      ],
                    ),

                    if (state is ShiftFailure) ...<Widget>[
                      const SizedBox(height: Gap.lg),
                      Row(
                        children: <Widget>[
                          Icon(Icons.error_outline, color: t.danger),
                          const SizedBox(width: Gap.sm),
                          Expanded(
                            child: Text(
                              state.message,
                              style: PosText.base.copyWith(color: t.danger),
                            ),
                          ),
                        ],
                      ),
                    ],

                    const SizedBox(height: Gap.xxl),
                    TouchButton(
                      label: 'Buka Shift',
                      icon: Icons.play_arrow,
                      variant: TouchVariant.success,
                      isLoading: busy,
                      onPressed: busy ? null : _submit,
                    ),

                    const SizedBox(height: Gap.md),
                    Text(
                      // Modal Rp 0 sah — sebagian outlet memulai tanpa kembalian
                      // di laci. Yang tidak boleh adalah nilai negatif.
                      'Modal Rp 0 diperbolehkan bila laci dimulai kosong.',
                      textAlign: TextAlign.center,
                      style: PosText.sm.copyWith(color: t.fgMuted),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
