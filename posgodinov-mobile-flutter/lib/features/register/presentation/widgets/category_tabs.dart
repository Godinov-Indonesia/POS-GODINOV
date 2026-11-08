import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/catalog.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';

/// Tab kategori pada P-05 ([06 §4.3]).
///
/// Tinggi [Touch.frequent] (56 dp) — sering ditekan, dan salah tekan hanya
/// mengubah penyaringan yang mudah dikoreksi.
class CategoryTabs extends StatelessWidget {
  const CategoryTabs({
    super.key,
    required this.categories,
    required this.selectedId,
    required this.totalProductCount,
    required this.onSelected,
  });

  final List<CatalogCategory> categories;

  /// `null` = tab **SEMUA**.
  final String? selectedId;

  final int totalProductCount;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: Touch.frequent,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: <Widget>[
          _Tab(
            label: 'SEMUA',
            count: totalProductCount,
            selected: selectedId == null,
            onTap: () => onSelected(null),
          ),
          for (final CatalogCategory c in categories) ...<Widget>[
            const SizedBox(width: Gap.sm),
            _Tab(
              label: c.name,
              count: c.productCount,
              selected: selectedId == c.id,
              onTap: () => onSelected(c.id),
            ),
          ],
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.md),
        child: Container(
          constraints: const BoxConstraints(minWidth: 88),
          padding: const EdgeInsets.symmetric(horizontal: Gap.lg),
          decoration: BoxDecoration(
            // Tab aktif: latar accentSubtle + teks accent ([06 §3.3]).
            color: selected ? t.accentSubtle : t.surface,
            borderRadius: BorderRadius.circular(Radii.md),
            border: Border.all(
              color: selected ? t.accent : t.border,
              width: selected ? 2 : 1,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: PosText.sm.copyWith(
                  color: selected ? t.accent : t.fg,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
              Text(
                '$count',
                // Angka non-uang tetap monospace agar kolomnya sejajar.
                style: PosText.xsMono.copyWith(
                  color: selected ? t.accent : t.fgMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
