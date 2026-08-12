import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/held_cart_cubit.dart';
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
              Text('PESANAN DITAHAN', style: PosText.buttonLg),
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
          IconButton(
            onPressed: () => context.read<HeldCartCubit>().discard(item.id),
            icon: const Icon(Icons.delete_outline),
            color: t.danger,
            tooltip: 'Buang pesanan',
            constraints: const BoxConstraints(
              minWidth: Touch.standard,
              minHeight: Touch.standard,
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
      title: Text('Tahan Pesanan', style: PosText.buttonLg),
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
