import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/sync/sync_triggers.dart';
import 'package:posgodinov_mobile/features/auth/presentation/cubit/cashier_auth_cubit.dart';
import 'package:posgodinov_mobile/features/history/presentation/widgets/void_reason_sheet.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/held_cart_cubit.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-08 — Pesanan Ditahan.**
///
/// > Murni lokal, **tidak pernah dikirim ke server** ([03 §14]).
class HeldCartsSheet extends StatelessWidget {
  const HeldCartsSheet({super.key, required this.onResume});

  /// Dipanggil dengan id pesanan yang dipilih untuk diambil kembali.
  final ValueChanged<String> onResume;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return BlocBuilder<HeldCartCubit, List<HeldCartSummary>>(
      builder: (BuildContext context, List<HeldCartSummary> items) {
        return Padding(
          padding: const EdgeInsets.all(Gap.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              const Text('PESANAN DITAHAN', style: PosText.buttonLg),
              const SizedBox(height: Gap.xs),
              Text(
                'Tersimpan hanya di perangkat ini.',
                style: PosText.sm.copyWith(color: t.fgMuted),
              ),
              const SizedBox(height: Gap.lg),

              if (items.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: Gap.xxl),
                  child: Text(
                    'Belum ada pesanan ditahan.',
                    textAlign: TextAlign.center,
                    style: PosText.base.copyWith(color: t.fgMuted),
                  ),
                )
              else
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 420),
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: Gap.sm),
                    itemBuilder: (BuildContext context, int i) =>
                        _HeldTile(item: items[i], onResume: onResume),
                  ),
                ),

              const SizedBox(height: Gap.lg),
              TouchButton(
                label: 'Tutup',
                variant: TouchVariant.secondary,
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _HeldTile extends StatelessWidget {
  const _HeldTile({required this.item, required this.onResume});

  final HeldCartSummary item;
  final ValueChanged<String> onResume;

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
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  item.label.isEmpty ? 'Tanpa nama' : item.label,
                  style: PosText.base,
                ),
                Text(
                  '${item.itemCount} item',
                  style: PosText.xsMono.copyWith(color: t.fgMuted),
                ),
              ],
            ),
          ),
          MoneyText(item.totalMinor, size: MoneySize.md),
          const SizedBox(width: Gap.md),
          SizedBox(
            width: 120,
            child: TouchButton(
              label: 'Ambil',
              height: Touch.standard,
              onPressed: () {
                Navigator.of(context).pop();
                onResume(item.id);
              },
            ),
          ),
          // 24 dp memisahkan aksi destruktif ([06 §2.2]).
          const SizedBox(width: Gap.destructive),
          // BUKAN ikon tempat sampah: aksinya BUKAN penghapusan (butir 13), dan
          // ikon yang berbohong tentang akibatnya adalah cara termudah membuat
          // kasir menekannya tanpa berpikir.
          TextButton.icon(
            onPressed: () => _cancelHeldCart(context, item),
            icon: Icon(Icons.block, size: 18, color: t.danger),
            label: Text(
              'Batalkan',
              style: PosText.sm.copyWith(color: t.danger),
            ),
            style: TextButton.styleFrom(
              minimumSize: const Size(Touch.standard, Touch.standard),
            ),
          ),
        ],
      ),
    );
  }
}

/// Dialog nama pesanan sebelum ditahan.
class HoldLabelDialog extends StatefulWidget {
  const HoldLabelDialog({super.key});

  @override
  State<HoldLabelDialog> createState() => _HoldLabelDialogState();
}

class _HoldLabelDialogState extends State<HoldLabelDialog> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Tahan Pesanan', style: PosText.buttonLg),
      content: TextField(
        controller: _controller,
        autofocus: true,
        style: PosText.base,
        decoration: const InputDecoration(
          hintText: 'Nama pelanggan atau nomor meja',
        ),
        onSubmitted: (String v) => Navigator.of(context).pop(v),
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Batal'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(_controller.text),
          child: const Text('Tahan'),
        ),
      ],
    );
  }
}


/// Membatalkan pesanan tertahan — **butir 13** ([11 §M13.5]).
///
/// Melewati Void Sheet yang SAMA dengan pembatalan transaksi dan penurunan
/// kuantitas: aturan `OTHER` wajib bercatatan dan peringatan struk harus
/// berbunyi identik di mana pun pembatalan terjadi.
Future<void> _cancelHeldCart(
  BuildContext context,
  HeldCartSummary item,
) async {
  final ShiftState shift = context.read<ShiftCubit>().state;
  final CashierAuthState auth = context.read<CashierAuthCubit>().state;

  if (shift is! ShiftActive || auth is! CashierLoggedIn) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Pembatalan harus terikat pada shift dan kasir yang aktif.',
        ),
      ),
    );
    return;
  }

  final HeldCartCubit cubit = context.read<HeldCartCubit>();

  final VoidReasonResult? result = await showVoidReasonSheet(
    context,
    title: 'Batalkan pesanan ${item.label.isEmpty ? 'tanpa nama' : item.label}',
    description:
        '${item.itemCount} item akan dibatalkan. Isinya dicatat utuh pada log '
        'pembatalan — pesanan tertahan tidak pernah ada di server, sehingga '
        'catatan itulah satu-satunya salinan yang tersisa.',
    valueMinor: item.totalMinor,
    // Pembatalan pesanan tertahan tunduk pada kebijakan yang sama dengan
    // pembatalan transaksi; nilainya diambil dari master data pada M15.
    requiresAuth: true,
    submitLabel: 'Ya, batalkan pesanan',
  );

  if (result == null) return;

  await cubit.cancel(
    id: item.id,
    shiftId: shift.shift.id,
    staffId: auth.session.staffId,
    reasonCode: result.reasonCode,
    reasonNotes: result.reasonNotes,
    cashierName: auth.session.name,
  );

  getIt<SyncTriggers>().onVoidSaved();
}
