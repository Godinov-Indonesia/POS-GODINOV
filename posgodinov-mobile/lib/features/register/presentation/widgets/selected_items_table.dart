import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';

/// Display utama kasir: Daftar baris item yang telah dipilih (scrollable & locked).
/// Pembatalan transaksi dilakukan secara menyeluruh via tombol [Void] di action bar.
class SelectedItemsTable extends StatelessWidget {
  const SelectedItemsTable({
    super.key,
    required this.lines,
    required this.productCategoryMap,
    required this.onIncrement,
    required this.onDecrement,
    this.isLocked = false,
  });

  final List<CartLine> lines;
  final Map<String, String> productCategoryMap;
  final ValueChanged<String> onIncrement;
  final ValueChanged<String> onDecrement;
  final bool isLocked;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    if (lines.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(Gap.xxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(Icons.receipt_long_outlined, size: 56, color: t.fgSubtle),
              const SizedBox(height: Gap.md),
              Text(
                'Belum Ada Item Terpilih',
                style: PosText.buttonLg.copyWith(color: t.fgMuted),
              ),
              const SizedBox(height: Gap.xs),
              Text(
                'Cari produk di kolom atas atau tekan tombol Katalog [≡] '
                'untuk memilih produk.',
                textAlign: TextAlign.center,
                style: PosText.sm.copyWith(color: t.fgSubtle),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: <Widget>[
        // Header Tabel
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: Gap.md,
            vertical: Gap.sm,
          ),
          decoration: BoxDecoration(
            color: t.surface,
            border: Border(bottom: BorderSide(color: t.border)),
          ),
          child: Row(
            children: <Widget>[
              SizedBox(
                width: 36,
                child: Text(
                  '#',
                  style: PosText.xs.copyWith(
                    fontWeight: FontWeight.w700,
                    color: t.fgMuted,
                  ),
                ),
              ),
              Expanded(
                flex: 3,
                child: Text(
                  'PRODUK',
                  style: PosText.xs.copyWith(
                    fontWeight: FontWeight.w700,
                    color: t.fgMuted,
                  ),
                ),
              ),
              Expanded(
                flex: 2,
                child: Text(
                  'KATEGORI',
                  style: PosText.xs.copyWith(
                    fontWeight: FontWeight.w700,
                    color: t.fgMuted,
                  ),
                ),
              ),
              SizedBox(
                width: 124,
                child: Center(
                  child: Text(
                    'QTY',
                    style: PosText.xs.copyWith(
                      fontWeight: FontWeight.w700,
                      color: t.fgMuted,
                    ),
                  ),
                ),
              ),
              SizedBox(
                width: 96,
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    'HARGA',
                    style: PosText.xs.copyWith(
                      fontWeight: FontWeight.w700,
                      color: t.fgMuted,
                    ),
                  ),
                ),
              ),
              SizedBox(
                width: 104,
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    'SUBTOTAL',
                    style: PosText.xs.copyWith(
                      fontWeight: FontWeight.w700,
                      color: t.fgMuted,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),

        // Daftar Baris Item (Scrollable)
        Expanded(
          child: ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            itemCount: lines.length,
            separatorBuilder: (_, __) => Divider(
              height: 1,
              thickness: 1,
              color: t.border,
            ),
            itemBuilder: (BuildContext context, int index) {
              final CartLine item = lines[index];
              final String categoryName =
                  productCategoryMap[item.productId] ?? '-';
              final bool isWaste = item.note.toLowerCase().contains('waste');
              final bool canDecrement =
                  !isLocked && !isWaste && item.quantity > 1;
              final bool canIncrement = !isLocked && !isWaste;

              return Container(
                color:
                    index.isEven ? t.surface : t.surface.withValues(alpha: 0.6),
                padding: const EdgeInsets.symmetric(
                  horizontal: Gap.md,
                  vertical: Gap.sm,
                ),
                child: Row(
                  children: <Widget>[
                    // Nomor
                    SizedBox(
                      width: 36,
                      child: Text(
                        '${index + 1}',
                        style: PosText.sm.copyWith(color: t.fgMuted),
                      ),
                    ),

                    // Nama Produk & Tag Waste
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          Text(
                            item.productName,
                            style: PosText.base.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (isWaste) ...<Widget>[
                            const SizedBox(height: 2),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: t.danger.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                item.note.isNotEmpty ? item.note : 'WASTE',
                                style: PosText.xs.copyWith(
                                  color: t.danger,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ] else if (item.note.isNotEmpty) ...<Widget>[
                            const SizedBox(height: 2),
                            Text(
                              item.note,
                              style: PosText.xs.copyWith(color: t.fgSubtle),
                            ),
                          ],
                        ],
                      ),
                    ),

                    // Kategori
                    Expanded(
                      flex: 2,
                      child: Text(
                        categoryName,
                        style: PosText.sm.copyWith(color: t.fgMuted),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),

                    // Qty Controls (124 width, minus disabled if qty <= 1 or locked)
                    SizedBox(
                      width: 124,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: <Widget>[
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline),
                            iconSize: 20,
                            color: canDecrement
                                ? t.danger
                                : t.fgSubtle.withValues(alpha: 0.3),
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                            constraints: const BoxConstraints(
                              minWidth: 28,
                              minHeight: 28,
                            ),
                            onPressed: canDecrement
                                ? () => onDecrement(item.id)
                                : null,
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                '${item.quantity}',
                                style: PosText.base.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline),
                            iconSize: 20,
                            color: canIncrement
                                ? t.accent
                                : t.fgSubtle.withValues(alpha: 0.3),
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                            constraints: const BoxConstraints(
                              minWidth: 28,
                              minHeight: 28,
                            ),
                            onPressed: canIncrement
                                ? () => onIncrement(item.id)
                                : null,
                          ),
                        ],
                      ),
                    ),

                    // Harga Satuan
                    SizedBox(
                      width: 96,
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: MoneyText(
                          item.unitPriceMinor,
                          size: MoneySize.sm,
                        ),
                      ),
                    ),

                    // Subtotal
                    SizedBox(
                      width: 104,
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: MoneyText(
                          item.lineTotalMinor,
                          size: MoneySize.sm,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
