import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/printer/audit_receipt_data.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/catalog.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/catalog_repository.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/cart_cubit.dart';
import 'package:posgodinov_mobile/features/waste/presentation/cubit/waste_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// Dialog input Waste yang memasukkan item ke POS kasir dan mencetak struk fisik.
class WasteEntryDialog extends StatefulWidget {
  const WasteEntryDialog({
    super.key,
    required this.staffId,
    required this.staffName,
    required this.shiftId,
  });

  final String staffId;
  final String staffName;
  final String? shiftId;

  static Future<void> open(
    BuildContext context, {
    required String staffId,
    required String staffName,
    required String? shiftId,
  }) {
    final CartCubit cartCubit = context.read<CartCubit>();

    return showDialog<void>(
      context: context,
      builder: (BuildContext ctx) => BlocProvider<WasteCubit>(
        create: (_) => getIt<WasteCubit>(),
        child: BlocProvider<CartCubit>.value(
          value: cartCubit,
          child: WasteEntryDialog(
            staffId: staffId,
            staffName: staffName,
            shiftId: shiftId,
          ),
        ),
      ),
    );
  }

  @override
  State<WasteEntryDialog> createState() => _WasteEntryDialogState();
}

class _WasteEntryDialogState extends State<WasteEntryDialog> {
  final TextEditingController _reason = TextEditingController();
  String? _reasonCode;
  List<CatalogProduct> _products = const <CatalogProduct>[];
  CatalogProduct? _selected;
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
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
      _selected != null &&
      _quantity > 0 &&
      _reasonCode != null &&
      _reason.text.trim().isNotEmpty;

  Future<void> _submit() async {
    if (!_canSubmit) return;
    final CatalogProduct p = _selected!;
    final String reasonText = _reason.text.trim();
    final String label =
        ReasonLabels.wasteReasons[_reasonCode!] ?? _reasonCode!;

    // 1. Masukkan ke display POS utama sebagai baris waste (Rp 0)
    context.read<CartCubit>().addProduct(
          productId: p.id,
          productName: p.name,
          priceMinor: 0, // Waste tidak menambah nominal cashflow penjualan
          quantity: _quantity,
          note: '[Waste] $label: $reasonText',
        );

    if (!mounted) return;
    Navigator.of(context).pop();

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Produk waste ditambahkan ke keranjang. Silakan tekan CASHOUT untuk mencetak struk bukti pembuangan.',
        ),
        duration: Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Dialog(
      insetPadding: const EdgeInsets.all(Gap.lg),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: Padding(
          padding: const EdgeInsets.all(Gap.xl),
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
              Row(
                children: <Widget>[
                  Icon(Icons.delete_outline, color: t.danger),
                  const SizedBox(width: Gap.sm),
                  const Text('Lapor Waste Produk', style: PosText.buttonLg),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: Gap.md),
              Text(
                'Item waste akan masuk ke kasir (Rp 0). Struk dicetak saat transaksi di-Cashout.',
                style: PosText.sm.copyWith(color: t.fgMuted),
              ),
              const SizedBox(height: Gap.lg),

              // Pilih Produk
              Text('Pilih Produk',
                  style: PosText.sm.copyWith(color: t.fgMuted),),
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
                onChanged: (CatalogProduct? p) => setState(() => _selected = p),
              ),
              const SizedBox(height: Gap.md),

              // Jumlah
              Text('Jumlah (Qty)',
                  style: PosText.sm.copyWith(color: t.fgMuted),),
              const SizedBox(height: Gap.xs),
              Row(
                children: <Widget>[
                  IconButton(
                    icon: const Icon(Icons.remove_circle_outline),
                    onPressed: _quantity > 1
                        ? () => setState(() => _quantity--)
                        : null,
                  ),
                  Text('$_quantity', style: PosText.buttonLg),
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline),
                    onPressed: () => setState(() => _quantity++),
                  ),
                ],
              ),
              const SizedBox(height: Gap.md),

              // Kategori Alasan
              Text('Kategori Alasan',
                  style: PosText.sm.copyWith(color: t.fgMuted),),
              const SizedBox(height: Gap.xs),
              DropdownButtonFormField<String>(
                initialValue: _reasonCode,
                isExpanded: true,
                hint: const Text('Pilih alasan'),
                items: <DropdownMenuItem<String>>[
                  for (final String code in ReasonCodes.wasteReasons)
                    DropdownMenuItem<String>(
                      value: code,
                      child: Text(ReasonLabels.wasteReasons[code] ?? code),
                    ),
                ],
                onChanged: (String? code) => setState(() => _reasonCode = code),
              ),
              const SizedBox(height: Gap.md),

              // Keterangan
              Text('Keterangan Tambahan',
                  style: PosText.sm.copyWith(color: t.fgMuted),),
              const SizedBox(height: Gap.xs),
              TextField(
                controller: _reason,
                onChanged: (_) => setState(() {}),
                inputFormatters: <TextInputFormatter>[
                  LengthLimitingTextInputFormatter(120),
                ],
                style: PosText.base,
                decoration: const InputDecoration(
                  hintText: 'Contoh: gosong, tumpah saat penyajian',
                ),
              ),
              const SizedBox(height: Gap.xl),

              // Submit Button
              TouchButton(
                label: 'Catat & Cetak Struk Waste',
                icon: Icons.print_outlined,
                variant: TouchVariant.danger,
                onPressed: _canSubmit ? _submit : null,
              ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
