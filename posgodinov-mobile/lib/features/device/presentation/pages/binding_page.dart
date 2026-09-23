import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/features/device/presentation/cubit/device_binding_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-01 — Pemasangan Perangkat.**
///
/// Dijalankan **satu kali** oleh teknisi saat perangkat dipasang di outlet
/// ([03 §2.1]). Kasir tidak pernah melihat layar ini lagi setelahnya.
///
/// Membutuhkan password **Business Owner**, sehingga teknisi harus mengetahuinya
/// atau pemilik harus hadir saat pemasangan.
class BindingPage extends StatefulWidget {
  const BindingPage({super.key, this.onBound});

  /// Dipanggil setelah binding berhasil — gerbang navigasi melanjutkan ke P-02.
  final VoidCallback? onBound;

  @override
  State<BindingPage> createState() => _BindingPageState();
}

class _BindingPageState extends State<BindingPage> {
  final TextEditingController _business = TextEditingController();
  final TextEditingController _outlet = TextEditingController();
  final TextEditingController _password = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _business.dispose();
    _outlet.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    context.read<DeviceBindingCubit>().submit(
          serialBusiness: _business.text,
          serialOutlet: _outlet.text,
          password: _password.text,
        );
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      appBar: AppBar(title: const Text('Pemasangan Perangkat')),
      body: BlocConsumer<DeviceBindingCubit, DeviceBindingState>(
        listener: (BuildContext context, DeviceBindingState state) {
          if (state is BindingSuccess) widget.onBound?.call();
        },
        builder: (BuildContext context, DeviceBindingState state) {
          final bool busy = state is BindingSubmitting;

          return Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(Gap.xl),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Text(
                      'Masukkan serial bisnis, serial outlet, dan password '
                      'pemilik untuk mengikat perangkat ini ke satu outlet.',
                      style: PosText.base.copyWith(color: t.fgMuted),
                    ),
                    const SizedBox(height: Gap.xl),

                    _Field(
                      controller: _business,
                      label: 'Serial Bisnis',
                      hint: 'KOPBU100826',
                      enabled: !busy,
                    ),
                    const SizedBox(height: Gap.lg),

                    _Field(
                      controller: _outlet,
                      label: 'Serial Outlet',
                      // outlets.serial_tenant, BUKAN outlets.id ([03 §2.1]).
                      hint: 'KOPBU100826001',
                      enabled: !busy,
                    ),
                    const SizedBox(height: Gap.lg),

                    _Field(
                      controller: _password,
                      label: 'Password Pemilik',
                      hint: '••••••••',
                      enabled: !busy,
                      obscure: _obscure,
                      onSubmitted: busy ? null : (_) => _submit(),
                      suffix: IconButton(
                        // Kesalahan ketik password adalah penyebab kegagalan
                        // pemasangan paling sering; teknisi harus bisa melihat
                        // apa yang diketiknya.
                        icon: Icon(
                          _obscure ? Icons.visibility : Icons.visibility_off,
                        ),
                        onPressed: () => setState(() => _obscure = !_obscure),
                        tooltip: _obscure
                            ? 'Tampilkan password'
                            : 'Sembunyikan password',
                      ),
                    ),

                    if (state is BindingFailure) ...<Widget>[
                      const SizedBox(height: Gap.lg),
                      _ErrorBanner(message: state.message),
                    ],

                    const SizedBox(height: Gap.xl),
                    TouchButton(
                      label: 'Pasang Perangkat',
                      icon: Icons.link,
                      isLoading: busy,
                      onPressed: busy ? null : _submit,
                    ),

                    const SizedBox(height: Gap.xl),
                    const _UnbindWarning(),
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

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    required this.enabled,
    this.obscure = false,
    this.suffix,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final bool enabled;
  final bool obscure;
  final Widget? suffix;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: PosText.sm.copyWith(color: context.tokens.fgMuted)),
        const SizedBox(height: Gap.xs),
        TextField(
          controller: controller,
          enabled: enabled,
          obscureText: obscure,
          onSubmitted: onSubmitted,
          autocorrect: false,
          enableSuggestions: false,
          // Serial bersifat alfanumerik huruf besar; mematikan kapitalisasi
          // otomatis mencegah keyboard menyisipkan huruf kecil.
          textCapitalization:
              obscure ? TextCapitalization.none : TextCapitalization.characters,
          style: PosText.base,
          decoration: InputDecoration(hintText: hint, suffixIcon: suffix),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.dangerSubtle,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: t.danger),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          // Penanda kedua selain warna ([06 §1.5]).
          Icon(Icons.error_outline, color: t.danger),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Text(
              // Pesan server ditampilkan APA ADANYA — sudah berbahasa Indonesia
              // dan layak dibaca pengguna ([03 §0]).
              message,
              style: PosText.base.copyWith(color: t.fg),
            ),
          ),
        ],
      ),
    );
  }
}

/// Menyatakan batasan backend apa adanya, bukan menyembunyikannya.
///
/// Tidak ada endpoint *unbind*, tidak ada daftar perangkat, tidak ada mekanisme
/// pencabutan ([03 §2.1]). Pemilik berhak tahu ini **sebelum** menyerahkan
/// password, bukan setelah perangkat hilang.
class _UnbindWarning extends StatelessWidget {
  const _UnbindWarning();

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.warningSubtle,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: t.warning),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.warning_amber_outlined, color: t.warningText),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Text(
              'Perangkat yang sudah dipasang tidak dapat dilepas dari jarak '
              'jauh. Bila perangkat hilang atau dicuri, akses sinkronisasi ke '
              'outlet ini tetap berlaku. Simpan perangkat dengan aman.',
              style: PosText.sm.copyWith(color: t.fg),
            ),
          ),
        ],
      ),
    );
  }
}
