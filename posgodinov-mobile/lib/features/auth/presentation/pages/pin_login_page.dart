import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/features/auth/presentation/cubit/cashier_auth_cubit.dart';
import 'package:posgodinov_mobile/features/auth/presentation/widgets/pin_keypad.dart';
import 'package:posgodinov_mobile/features/device/presentation/cubit/master_sync_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-03 — Login Kasir.**
///
/// 100% offline: PIN dibandingkan terhadap `pin_hash` bcrypt dari master data,
/// di background isolate ([09 §5.3]).
class PinLoginPage extends StatefulWidget {
  const PinLoginPage({super.key, this.onLoggedIn});

  final VoidCallback? onLoggedIn;

  @override
  State<PinLoginPage> createState() => _PinLoginPageState();
}

class _PinLoginPageState extends State<PinLoginPage> {
  final TextEditingController _identifier = TextEditingController();
  String _pin = '';

  static const int _minPin = 4;
  static const int _maxPin = 6;

  @override
  void dispose() {
    _identifier.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _identifier.text.trim().isNotEmpty && _pin.length >= _minPin;

  void _appendDigit(String d) {
    if (_pin.length >= _maxPin) return;
    final String next = _pin + d;
    setState(() => _pin = next);
    context.read<CashierAuthCubit>().clearError();
    if (next.length == _maxPin && _identifier.text.trim().isNotEmpty) {
      context
          .read<CashierAuthCubit>()
          .login(staffIdentifier: _identifier.text.trim(), pin: next);
    }
  }

  void _backspace() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  void _clear() => setState(() => _pin = '');

  void _submit() {
    context
        .read<CashierAuthCubit>()
        .login(staffIdentifier: _identifier.text, pin: _pin);
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: <Widget>[
          BlocConsumer<MasterSyncCubit, MasterSyncState>(
            bloc: getIt<MasterSyncCubit>(),
            listener: (BuildContext context, MasterSyncState syncState) {
              if (syncState is MasterSyncDone) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Master data berhasil diperbarui.'),
                    backgroundColor: Colors.green,
                  ),
                );
              } else if (syncState is MasterSyncFailure) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content:
                        Text('Gagal memperbarui data: ${syncState.message}'),
                    backgroundColor: Colors.red,
                  ),
                );
              }
            },
            builder: (BuildContext context, MasterSyncState syncState) {
              final bool syncing = syncState is MasterSyncDownloading;
              return TextButton.icon(
                onPressed:
                    syncing ? null : () => getIt<MasterSyncCubit>().sync(),
                icon: syncing
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.sync),
                label: Text(syncing ? 'Menyinkronkan…' : 'Sinkronisasi Data'),
              );
            },
          ),
          const SizedBox(width: Gap.md),
        ],
      ),
      body: SafeArea(
        child: BlocConsumer<CashierAuthCubit, CashierAuthState>(
          listener: (BuildContext context, CashierAuthState state) {
            if (state is CashierLoggedIn) {
              widget.onLoggedIn?.call();
            } else if (state is CashierAuthFailure) {
              // PIN dikosongkan setelah gagal; identifier dibiarkan agar kasir
              // tidak perlu mengetik ulang.
              setState(() => _pin = '');
            }
          },
          builder: (BuildContext context, CashierAuthState state) {
            final bool busy = state is CashierVerifying;

            return LayoutBuilder(
              builder: (BuildContext context, BoxConstraints constraints) {
                return SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(Gap.xl),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight - (Gap.xl * 2),
                      minWidth: constraints.maxWidth,
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 420),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: <Widget>[
                            const Text(
                              'MASUK SEBAGAI KASIR',
                              textAlign: TextAlign.center,
                              style: PosText.buttonLg,
                            ),
                            const SizedBox(height: Gap.xl),
                            Text(
                              'ID / Username Staff',
                              style: PosText.sm.copyWith(color: t.fgMuted),
                            ),
                            const SizedBox(height: Gap.xs),
                            TextField(
                              controller: _identifier,
                              enabled: !busy,
                              autocorrect: false,
                              enableSuggestions: false,
                              textCapitalization: TextCapitalization.none,
                              style: PosText.base,
                              onChanged: (_) => setState(() {}),
                              decoration:
                                  const InputDecoration(hintText: 'kasir01'),
                            ),
                            const SizedBox(height: Gap.xl),
                            Text(
                              'PIN ($_minPin–$_maxPin digit)',
                              textAlign: TextAlign.center,
                              style: PosText.sm.copyWith(color: t.fgMuted),
                            ),
                            const SizedBox(height: Gap.md),
                            PinDots(length: _pin.length, maxLength: _maxPin),
                            if (state is CashierAuthFailure) ...<Widget>[
                              const SizedBox(height: Gap.lg),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: <Widget>[
                                  Icon(
                                    Icons.error_outline,
                                    color: t.danger,
                                    size: 20,
                                  ),
                                  const SizedBox(width: Gap.sm),
                                  Text(
                                    // Pesan sama untuk ID tidak dikenal maupun PIN
                                    // salah — lihat CashierAuthCubit.
                                    state.message,
                                    style:
                                        PosText.base.copyWith(color: t.danger),
                                  ),
                                ],
                              ),
                            ],
                            const SizedBox(height: Gap.xl),
                            PinKeypad(
                              enabled: !busy,
                              onDigit: _appendDigit,
                              onBackspace: _backspace,
                              onClear: _clear,
                            ),
                            const SizedBox(height: Gap.xl),
                            TouchButton(
                              label: 'MASUK',
                              isLoading: busy,
                              // Dinonaktifkan selama verifikasi: ketukan ganda tidak
                              // boleh memicu dua isolate bcrypt ([09 §5.3]).
                              onPressed: (_canSubmit && !busy) ? _submit : null,
                            ),
                            const SizedBox(height: Gap.lg),
                            Text(
                              // TIDAK ADA tautan "Reset PIN" — endpointnya tidak ada
                              // di backend ([03 §14] / [09 §9.5]). Menawarkannya akan
                              // menjadi janji kosong.
                              'Lupa PIN? Hubungi pemilik untuk membuat ulang akun '
                              'staff.',
                              textAlign: TextAlign.center,
                              style: PosText.sm.copyWith(color: t.fgMuted),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
