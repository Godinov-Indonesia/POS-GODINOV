import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/sync/sync_triggers.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/catalog.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/catalog_repository.dart';
import 'package:posgodinov_mobile/features/waste/domain/repositories/waste_repository.dart';
import 'package:posgodinov_mobile/features/waste/presentation/cubit/waste_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-11 — Lapor Waste Produk.**
///
/// Produk jadi yang terbuang: tumpah, gosong, kedaluwarsa. Masuk antrean
/// sinkronisasi dan mengurangi bahan baku di server lewat BOM.
class WastePage extends StatefulWidget {
  const WastePage({super.key, required this.staffId});

  final String staffId;

  @override
  State<WastePage> createState() => _WastePageState();
}

class _WastePageState extends State<WastePage> {
  final TextEditingController _reason = TextEditingController();
  List<CatalogProduct> _products = const <CatalogProduct>[];
  CatalogProduct? _selected;
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await context.read<WasteCubit>().observe();
      final List<CatalogProduct> items =
          await getIt<CatalogRepository>().watchProducts().first;
      if (mounted) setState(() => _products = items);
    });
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _selected != null && _quantity > 0 && _reason.text.trim().isNotEmpty;

  Future<void> _submit() async {
    final CatalogProduct p = _selected!;
    await context.read<WasteCubit>().submit(
          staffId: widget.staffId,
          productId: p.id,
          productName: p.name,
          quantity: _quantity,
          reason: _reason.text,
          onReported: () async => getIt<SyncTriggers>().onTransactionSaved(),
        );

    if (!mounted) return;
    setState(() {
      _selected = null;
      _quantity = 1;
      _reason.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppBar(title: const Text('Lapor Waste Produk')),
      body: BlocBuilder<WasteCubit, WasteState>(
        builder: (BuildContext context, WasteState state) {
          return ListView(
            padding: const EdgeInsets.all(Gap.xl),
            children: <Widget>[
              Text('Produk', style: PosText.sm.copyWith(color: t.fgMuted)),
              const SizedBox(height: Gap.xs),
              DropdownButtonFormField<CatalogProduct>(
                initialValue: _selected,
                isExpanded: true,
                hint: const Text('Pilih produk'),
                items: _products
                    .map(
                      (CatalogProduct p) => DropdownMenuItem<CatalogProduct>(
                        value: p,
                        child: Text(p.name, overflow: TextOverflow.ellipsis),
                      ),
                    )
                    .toList(growable: false),
                onChanged: (CatalogProduct? p) =>
                    setState(() => _selected = p),
              ),

              const SizedBox(height: Gap.lg),
              Text('Jumlah', style: PosText.sm.copyWith(color: t.fgMuted)),
              const SizedBox(height: Gap.xs),
              Row(
                children: <Widget>[
                  _StepButton(
                    icon: Icons.remove,
                    onPressed: _quantity > 1
                        ? () => setState(() => _quantity--)
                        : null,
                  ),
                  SizedBox(
                    width: 80,
                    child: Text(
                      '$_quantity',
                      textAlign: TextAlign.center,
                      style: PosText.moneyXl.copyWith(color: t.fg),
                    ),
                  ),
                  _StepButton(
                    icon: Icons.add,
                    onPressed: () => setState(() => _quantity++),
                  ),
                ],
              ),

              const SizedBox(height: Gap.lg),
              Text('Alasan', style: PosText.sm.copyWith(color: t.fgMuted)),
              const SizedBox(height: Gap.xs),
              TextField(
                controller: _reason,
                onChanged: (_) => setState(() {}),
                inputFormatters: <TextInputFormatter>[
                  LengthLimitingTextInputFormatter(120),
                ],
                style: PosText.base,
                decoration: const InputDecoration(
                  hintText: 'Contoh: tumpah saat penyajian',
                ),
              ),

              if (state.error != null) ...<Widget>[
                const SizedBox(height: Gap.lg),
                Text(
                  state.error!,
                  style: PosText.base.copyWith(color: t.danger),
                ),
              ],

              const SizedBox(height: Gap.xl),
              TouchButton(
                label: 'Laporkan Waste',
                icon: Icons.delete_outline,
                variant: TouchVariant.danger,
                isLoading: state.submitting,
                onPressed: _canSubmit ? _submit : null,
              ),

              if (state.recent.isNotEmpty) ...<Widget>[
                const SizedBox(height: Gap.xxl),
                Text(
                  'LAPORAN TERAKHIR',
                  style: PosText.sm.copyWith(
                    color: t.fgMuted,
                    letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(height: Gap.sm),
                for (final WasteEntry w in state.recent.take(10))
                  Padding(
                    padding: const EdgeInsets.only(bottom: Gap.sm),
                    child: Container(
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
                                  '${w.quantity}× ${w.productName}',
                                  style: PosText.base,
                                ),
                                Text(
                                  w.reason,
                                  style: PosText.xs.copyWith(color: t.fgMuted),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            w.synced ? Icons.cloud_done_outlined : Icons.schedule,
                            size: 18,
                            color: w.synced ? t.successText : t.warningText,
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({required this.icon, required this.onPressed});

  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: Touch.frequent,
      height: Touch.frequent,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(padding: EdgeInsets.zero),
        child: Icon(icon),
      ),
    );
  }
}
