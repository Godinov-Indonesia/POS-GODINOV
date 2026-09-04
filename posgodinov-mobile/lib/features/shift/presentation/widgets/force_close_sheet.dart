import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/features/auth/presentation/cubit/cashier_auth_cubit.dart';
import 'package:posgodinov_mobile/features/shift/domain/close_shift_saga.dart';
import 'package:posgodinov_mobile/features/shift/domain/entities/shift.dart';
import 'package:posgodinov_mobile/features/shift/domain/repositories/shift_repository.dart';
import 'package:posgodinov_mobile/features/shift/domain/supervisor_authorizer.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// Jalur darurat **Force Close Shift** — butir 12 ([11 §M15.2]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// MENGAPA JALUR INI HARUS ADA
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Identity Lock mengunci perangkat selama ada shift `OPEN`. Tanpa jalan
/// keluar, kasir yang pulang tanpa menutup shift mengunci perangkat itu
/// **selamanya** — dan outlet membuka hari berikutnya dengan mesin kasir yang
/// tidak dapat dipakai siapa pun.
///
/// Tiga hal yang membuatnya tetap jalur darurat, bukan pintu belakang:
///
///   1. PIN supervisor, bukan PIN kasir yang sedang login
///   2. Alasan wajib, minimal 10 karakter — bukan daftar pilihan yang dapat
///      diketuk tanpa berpikir
///   3. `pos_security_events` **CRITICAL** yang muncul di dashboard pemilik
///
/// ⚠️ Tidak ada isian angka kas di sini, dan itu disengaja. Force Close berarti
/// tidak ada yang menghitung laci: mengisi angka deklarasi atas nama orang yang
/// sudah pulang justru menciptakan kesaksian palsu.
///
/// Mengembalikan `true` lewat `Navigator.pop` bila shift benar-benar tertutup.
class ForceCloseSheet extends StatefulWidget {
  const ForceCloseSheet({super.key});

  @override
  State<ForceCloseSheet> createState() => _ForceCloseSheetState();
}

class _ForceCloseSheetState extends State<ForceCloseSheet> {
  final TextEditingController _identifier = TextEditingController();
  final TextEditingController _pin = TextEditingController();
  final TextEditingController _reason = TextEditingController();

  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    // PIN supervisor tidak boleh menganggur di memori setelah sheet ditutup.
    _identifier.dispose();
    _pin.dispose();
    _reason.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _identifier.text.trim().isNotEmpty &&
      _pin.text.isNotEmpty &&
      _reason.text.trim().length >= ReasonCodes.otherNotesMinLength;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final SupervisorVerdict verdict =
          await getIt<SupervisorAuthorizer>().authorize(
        staffIdentifier: _identifier.text,
        pin: _pin.text,
      );

      if (!verdict.ok) {
        setState(() {
          _error = verdict.message;
          _pin.clear();
        });
        return;
      }

      final Shift? shift = await getIt<ShiftRepository>().currentOpenShift();
      if (shift == null) {
        setState(() => _error = 'Tidak ada shift terbuka untuk ditutup.');
        return;
      }

      final CloseShiftOutcome outcome =
          await getIt<CloseShiftSaga>().forceClose(
        shift: shift,
        supervisorId: verdict.staffId,
        supervisorName: verdict.staffName,
        reason: _reason.text,
      );

      if (!outcome.ok) {
        setState(() => _error = outcome.error);
        return;
      }

      // Sesi kasir lama dibersihkan: perangkat baru saja dilepas dari shift
      // orang lain, dan meninggalkan namanya di StatusBar akan membuat kasir
      // berikutnya berjualan atas identitas yang salah.
      getIt<CashierAuthCubit>().clearSession();

      if (mounted) Navigator.of(context).pop(true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final int sisa =
        ReasonCodes.otherNotesMinLength - _reason.text.trim().length;

    return Padding(
      padding: EdgeInsets.only(
        left: Gap.xl,
        right: Gap.xl,
        top: Gap.xl,
        // Menghindari isian tertutup papan ketik pada handheld.
        bottom: MediaQuery.of(context).viewInsets.bottom + Gap.xl,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            const Text('Tutup Paksa Shift', style: PosText.buttonLg),
            const SizedBox(height: Gap.md),

            Container(
              padding: const EdgeInsets.all(Gap.lg),
              decoration: BoxDecoration(
                color: t.dangerSubtle,
                borderRadius: BorderRadius.circular(Radii.md),
              ),
              child: Text(
                'Shift akan ditutup TANPA hitungan laci. Pemilik akan melihat '
                'siapa yang menutupnya dan alasannya. Gunakan hanya bila kasir '
                'pemilik shift benar-benar tidak dapat dihubungi.',
                style: PosText.sm.copyWith(color: t.fgMuted),
              ),
            ),

            const SizedBox(height: Gap.lg),
            Text('ID Supervisor', style: PosText.sm.copyWith(color: t.fgMuted)),
            const SizedBox(height: Gap.xs),
            TextField(
              controller: _identifier,
              enabled: !_busy,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(hintText: 'mis. SPV01'),
            ),

            const SizedBox(height: Gap.lg),
            Text('PIN Supervisor', style: PosText.sm.copyWith(color: t.fgMuted)),
            const SizedBox(height: Gap.xs),
            TextField(
              controller: _pin,
              enabled: !_busy,
              obscureText: true,
              keyboardType: TextInputType.number,
              inputFormatters: <TextInputFormatter>[
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              onChanged: (_) => setState(() {}),
            ),

            const SizedBox(height: Gap.lg),
            Text(
              'Alasan penutupan paksa (wajib)',
              style: PosText.sm.copyWith(color: t.fgMuted),
            ),
            const SizedBox(height: Gap.xs),
            TextField(
              controller: _reason,
              enabled: !_busy,
              maxLines: 3,
              inputFormatters: <TextInputFormatter>[
                LengthLimitingTextInputFormatter(200),
              ],
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                hintText: 'mis. kasir Andi pulang pukul 21.00 tanpa menutup shift',
              ),
            ),
            const SizedBox(height: Gap.xs),
            // Sisa karakter ditampilkan, bukan sekadar tombol yang mati. Tombol
            // mati tanpa penjelasan membuat supervisor mengira aplikasinya rusak.
            Text(
              sisa > 0
                  ? 'Kurang $sisa karakter lagi.'
                  : 'Alasan ini dibaca pemilik, bukan sistem.',
              style: PosText.xs.copyWith(color: t.fgMuted),
            ),

            if (_error != null) ...<Widget>[
              const SizedBox(height: Gap.lg),
              Text('⚠ $_error', style: PosText.sm.copyWith(color: t.danger)),
            ],

            const SizedBox(height: Gap.xl),
            TouchButton(
              label: 'Tutup Paksa Shift',
              icon: Icons.gpp_maybe_outlined,
              variant: TouchVariant.danger,
              isLoading: _busy,
              onPressed: _canSubmit && !_busy ? () => unawaited(_submit()) : null,
            ),
            const SizedBox(height: Gap.md),
            TextButton(
              onPressed: _busy ? null : () => Navigator.of(context).pop(false),
              child: const Text('Batal'),
            ),
          ],
        ),
      ),
    );
  }
}
