import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/catalog.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';

/// Tile produk pada grid P-05 ([06 §4.2]).
///
/// **Tiga aturan yang tidak boleh dilanggar:**
///
/// 1. **Tanpa indikator stok apa pun.** Master data POS tidak memuat stok
///    maupun BOM ([03 §2.2]); tidak ada badge "habis", tidak ada sisa porsi.
/// 2. **Nama minimal 16 dp, maksimal 2 baris**, dipotong `line-clamp`, bukan
///    elipsis satu baris — nama F&B panjang (*"Kopi Susu Gula Aren Large"*)
///    menjadi tidak terbaca bila dipangkas di baris pertama ([06 §2.3]).
/// 3. **Fallback gambar wajib**, bukan opsional: `image_url` boleh `null`, dan
///    URL yang ada pun sering tidak dapat dijangkau saat perangkat offline.
class ProductTile extends StatelessWidget {
  const ProductTile({
    super.key,
    required this.product,
    required this.onTap,
    this.height = 150,
  });

  final CatalogProduct product;
  final VoidCallback onTap;
  final double height;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return SizedBox(
      height: height,
      child: Material(
        color: t.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.lg),
          onTap: () {
            HapticFeedback.selectionClick();
            onTap();
          },
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Radii.lg),
              border: Border.all(color: t.border),
            ),
            padding: const EdgeInsets.all(Gap.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(child: _Thumbnail(product: product)),
                const SizedBox(height: Gap.sm),
                Text(
                  product.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: PosText.base.copyWith(color: t.fg),
                ),
                const SizedBox(height: Gap.xs),
                MoneyText(product.priceMinor, size: MoneySize.md),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Gambar produk dengan **dua lapis fallback**.
///
/// Perangkat kasir sering sepenuhnya offline, sehingga `Image.network` gagal
/// diam-diam dan menyisakan kotak kosong. Inisial produk di atas latar
/// berwarna tetap memberi kasir sesuatu untuk dikenali.
class _Thumbnail extends StatelessWidget {
  const _Thumbnail({required this.product});

  final CatalogProduct product;

  @override
  Widget build(BuildContext context) {
    final String? url = product.imageUrl;

    if (url == null || url.isEmpty) return _InitialAvatar(name: product.name);

    return ClipRRect(
      borderRadius: BorderRadius.circular(Radii.sm),
      child: Image.network(
        url,
        fit: BoxFit.cover,
        width: double.infinity,
        // Kegagalan jaringan TIDAK menampilkan ikon rusak.
        errorBuilder: (_, __, ___) => _InitialAvatar(name: product.name),
        loadingBuilder: (
          BuildContext context,
          Widget child,
          ImageChunkEvent? progress,
        ) {
          if (progress == null) return child;
          return _InitialAvatar(name: product.name);
        },
      ),
    );
  }
}

class _InitialAvatar extends StatelessWidget {
  const _InitialAvatar({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final String initial =
        name.trim().isEmpty ? '?' : name.trim().substring(0, 1).toUpperCase();

    return Container(
      width: double.infinity,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: t.accentSubtle,
        borderRadius: BorderRadius.circular(Radii.sm),
      ),
      child: Text(
        initial,
        style: PosText.moneyXl.copyWith(color: t.accent),
      ),
    );
  }
}
