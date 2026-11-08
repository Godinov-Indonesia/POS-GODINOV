import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/catalog.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/cart_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/catalog_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/product_tile.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';

/// Modal pop-up katalog produk dengan kategori horizontal dan kartu produk besar.
/// Otomatis menutup saat produk berhasil dipilih.
class CatalogModal extends StatelessWidget {
  const CatalogModal({super.key});

  static Future<void> open(BuildContext context) {
    final CatalogCubit catalogCubit = context.read<CatalogCubit>();
    final CartCubit cartCubit = context.read<CartCubit>();

    return showDialog<void>(
      context: context,
      builder: (BuildContext ctx) => MultiBlocProvider(
        providers: <BlocProvider<dynamic>>[
          BlocProvider<CatalogCubit>.value(value: catalogCubit),
          BlocProvider<CartCubit>.value(value: cartCubit),
        ],
        child: const Dialog(
          insetPadding: EdgeInsets.all(Gap.md),
          child: CatalogModal(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final Size screenSize = MediaQuery.of(context).size;
    final double dialogWidth = screenSize.width * 0.94;
    final double dialogHeight = screenSize.height * 0.90;

    return Container(
      width: dialogWidth,
      height: dialogHeight,
      decoration: BoxDecoration(
        color: t.bg,
        borderRadius: BorderRadius.circular(Radii.lg),
      ),
      child: BlocBuilder<CatalogCubit, CatalogState>(
        builder: (BuildContext context, CatalogState state) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              // Header
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: Gap.lg,
                  vertical: Gap.md,
                ),
                decoration: BoxDecoration(
                  color: t.surface,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(Radii.lg),
                  ),
                  border: Border(bottom: BorderSide(color: t.border)),
                ),
                child: Row(
                  children: <Widget>[
                    Icon(Icons.storefront_outlined, color: t.fg, size: 28),
                    const SizedBox(width: Gap.sm),
                    Text(
                      'Katalog Produk',
                      style: PosText.buttonLg.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close),
                      iconSize: 26,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),

              // Bar Kategori Horizontal
              Container(
                height: 56,
                padding: const EdgeInsets.symmetric(vertical: Gap.xs),
                decoration: BoxDecoration(
                  color: t.surface,
                  border: Border(bottom: BorderSide(color: t.border)),
                ),
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: Gap.md),
                  children: <Widget>[
                    _CategoryChip(
                      label: 'Semua (${state.totalProductCount})',
                      selected: state.selectedCategoryId == null,
                      onTap: () =>
                          context.read<CatalogCubit>().selectCategory(null),
                    ),
                    for (final CatalogCategory cat
                        in state.categories) ...<Widget>[
                      const SizedBox(width: Gap.sm),
                      _CategoryChip(
                        label: '${cat.name} (${cat.productCount})',
                        selected: state.selectedCategoryId == cat.id,
                        onTap: () =>
                            context.read<CatalogCubit>().selectCategory(cat.id),
                      ),
                    ],
                  ],
                ),
              ),

              // Grid Produk yang Lebih Luas & Gambar Lebih Besar
              Expanded(
                child: state.loading
                    ? const Center(child: CircularProgressIndicator())
                    : state.visibleProducts.isEmpty
                        ? Center(
                            child: Text(
                              'Tidak ada produk di kategori ini.',
                              style: PosText.base.copyWith(color: t.fgMuted),
                            ),
                          )
                        : GridView.builder(
                            padding: const EdgeInsets.all(Gap.lg),
                            gridDelegate:
                                const SliverGridDelegateWithMaxCrossAxisExtent(
                              maxCrossAxisExtent: 220,
                              mainAxisSpacing: Gap.md,
                              crossAxisSpacing: Gap.md,
                              mainAxisExtent: 190,
                            ),
                            itemCount: state.visibleProducts.length,
                            itemBuilder: (BuildContext ctx, int i) {
                              final CatalogProduct p =
                                  state.visibleProducts[i];
                              return ProductTile(
                                product: p,
                                height: 190,
                                onTap: () {
                                  context.read<CartCubit>().addProduct(
                                        productId: p.id,
                                        productName: p.name,
                                        priceMinor: p.priceMinor,
                                      );
                                  // Tutup modal katalog otomatis setelah produk terpilih
                                  Navigator.of(context).pop();
                                },
                              );
                            },
                          ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return FilterChip(
      selected: selected,
      label: Text(label),
      labelStyle: PosText.sm.copyWith(
        color: selected ? Colors.white : t.fg,
        fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
      ),
      backgroundColor: t.bg,
      selectedColor: t.brand,
      checkmarkColor: Colors.white,
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(
        horizontal: Gap.md,
        vertical: Gap.xs,
      ),
      onSelected: (_) => onTap(),
    );
  }
}
