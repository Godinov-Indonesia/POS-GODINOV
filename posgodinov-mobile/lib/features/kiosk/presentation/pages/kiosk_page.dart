import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/features/kiosk/presentation/cubit/kiosk_cubit.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/catalog.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/catalog_repository.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/breakpoints.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';
import 'package:uuid/uuid.dart';

/// **Mode Kiosk — K-01 … K-03.**
///
/// Tema dan token identik dengan mode kasir; yang berbeda adalah ukuran dan
/// kosakata interaksi — penggunanya pelanggan, bukan kasir terlatih
/// ([09 §3.6]).
///
/// **Seluruh jalur admin disembunyikan**: tidak ada pengaturan, binding,
/// riwayat, void, waste, tutup shift, maupun status sync.
class KioskPage extends StatefulWidget {
  const KioskPage({super.key});

  @override
  State<KioskPage> createState() => _KioskPageState();
}

class _KioskPageState extends State<KioskPage> {
  List<CatalogProduct> _products = const <CatalogProduct>[];

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
  Widget build(BuildContext context) {
    return BlocBuilder<KioskCubit, KioskState>(
      builder: (BuildContext context, KioskState state) {
        return Scaffold(
          backgroundColor: context.tokens.bg,
          body: SafeArea(
            child: switch (state.step) {
              KioskStep.welcome => const _Welcome(),
              KioskStep.browsing => _Catalog(products: _products, state: state),
              KioskStep.review => _Review(state: state),
              KioskStep.submitted => _Submitted(state: state),
            },
          ),
        );
      },
    );
  }
}

/// K-01 — layar sambutan. Juga tempat gerbang keluar tersembunyi.
class _Welcome extends StatelessWidget {
  const _Welcome();

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          // Gerbang keluar: ketuk logo 5× dalam 3 detik. Tidak ada tombol yang
          // terlihat — pelanggan tidak boleh menemukannya tanpa sengaja.
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _onLogoTap(context),
            child: Padding(
              padding: const EdgeInsets.all(Gap.xl),
              child: Icon(Icons.storefront, size: 96, color: t.brand),
            ),
          ),
          const SizedBox(height: Gap.xl),
          Text('Selamat datang', style: PosText.money2xl.copyWith(color: t.fg)),
          const SizedBox(height: Gap.md),
          Text(
            'Sentuh layar untuk mulai memesan',
            style: PosText.buttonLg.copyWith(color: t.fgMuted),
          ),
          const SizedBox(height: Gap.xxl),
          SizedBox(
            width: 320,
            child: TouchButton(
              label: 'MULAI PESAN',
              height: Touch.critical,
              onPressed: () => context.read<KioskCubit>().start(),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _onLogoTap(BuildContext context) async {
    final KioskCubit cubit = context.read<KioskCubit>();
    if (!cubit.registerExitTap()) return;

    final String? pin = await showDialog<String>(
      context: context,
      builder: (_) => const _ExitPinDialog(),
    );
    if (pin == null) return;

    final bool ok = await cubit.attemptExit(pin);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('PIN salah.')),
      );
    }
  }
}

class _ExitPinDialog extends StatefulWidget {
  const _ExitPinDialog();

  @override
  State<_ExitPinDialog> createState() => _ExitPinDialogState();
}

class _ExitPinDialogState extends State<_ExitPinDialog> {
  final TextEditingController _pin = TextEditingController();

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Keluar dari mode Kiosk', style: PosText.buttonLg),
      content: TextField(
        controller: _pin,
        autofocus: true,
        obscureText: true,
        keyboardType: TextInputType.number,
        style: PosText.base,
        decoration: const InputDecoration(hintText: 'PIN staff'),
        onSubmitted: (String v) => Navigator.of(context).pop(v),
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Batal'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(_pin.text),
          child: const Text('Keluar'),
        ),
      ],
    );
  }
}

/// K-02 — katalog. Tile jauh lebih besar daripada mode kasir.
class _Catalog extends StatelessWidget {
  const _Catalog({required this.products, required this.state});

  final List<CatalogProduct> products;
  final KioskState state;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        Expanded(
          child: products.isEmpty
              ? Center(
                  child: Text(
                    'Menu belum tersedia.',
                    style: PosText.buttonLg.copyWith(
                      color: context.tokens.fgMuted,
                    ),
                  ),
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(Gap.xl),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: KioskLayout.gridColumns,
                    mainAxisSpacing: Gap.lg,
                    crossAxisSpacing: Gap.lg,
                    mainAxisExtent: KioskLayout.tileHeight,
                  ),
                  itemCount: products.length,
                  itemBuilder: (BuildContext context, int i) =>
                      _KioskTile(product: products[i]),
                ),
        ),
        if (!state.isEmpty) _CartBar(state: state),
      ],
    );
  }
}

class _KioskTile extends StatelessWidget {
  const _KioskTile({required this.product});

  final CatalogProduct product;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Material(
      color: t.surface,
      borderRadius: BorderRadius.circular(Radii.lg),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.lg),
        onTap: () => context.read<KioskCubit>().addProduct(
              CartLine(
                id: const Uuid().v4(),
                productId: product.id,
                productName: product.name,
                unitPriceMinor: product.priceMinor,
                quantity: 1,
              ),
            ),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Radii.lg),
            border: Border.all(color: t.border),
          ),
          padding: const EdgeInsets.all(Gap.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Container(
                  width: double.infinity,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: t.accentSubtle,
                    borderRadius: BorderRadius.circular(Radii.md),
                  ),
                  child: Text(
                    product.name.isEmpty
                        ? '?'
                        : product.name.substring(0, 1).toUpperCase(),
                    style: PosText.money2xl.copyWith(color: t.accent),
                  ),
                ),
              ),
              const SizedBox(height: Gap.md),
              Text(
                product.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                // 20 dp — pelanggan berdiri lebih jauh daripada kasir.
                style: PosText.base.copyWith(
                  fontSize: KioskLayout.productNameSize,
                ),
              ),
              const SizedBox(height: Gap.xs),
              MoneyText(product.priceMinor, size: MoneySize.lg),
            ],
          ),
        ),
      ),
    );
  }
}

class _CartBar extends StatelessWidget {
  const _CartBar({required this.state});

  final KioskState state;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      height: KioskLayout.cartBarHeight,
      padding: const EdgeInsets.symmetric(horizontal: Gap.xl),
      decoration: BoxDecoration(
        color: t.surface,
        border: Border(top: BorderSide(color: t.border)),
      ),
      child: Row(
        children: <Widget>[
          Text('${state.itemCount} item', style: PosText.buttonLg),
          const SizedBox(width: Gap.lg),
          MoneyText(state.totalMinor, size: MoneySize.xl),
          const Spacer(),
          SizedBox(
            width: 280,
            child: TouchButton(
              label: 'LANJUT',
              height: Touch.critical,
              variant: TouchVariant.success,
              onPressed: () => context.read<KioskCubit>().review(),
            ),
          ),
        ],
      ),
    );
  }
}

/// K-03 — tinjau & kirim.
class _Review extends StatelessWidget {
  const _Review({required this.state});

  final KioskState state;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.all(Gap.xl),
          child: Text('Pesanan Anda', style: PosText.money2xl.copyWith(color: t.fg)),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: Gap.xl),
            itemCount: state.lines.length,
            separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
            itemBuilder: (BuildContext context, int i) {
              final CartLine l = state.lines[i];
              return Container(
                padding: const EdgeInsets.all(Gap.lg),
                decoration: BoxDecoration(
                  color: t.surface,
                  borderRadius: BorderRadius.circular(Radii.md),
                  border: Border.all(color: t.border),
                ),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        l.productName,
                        style: PosText.base.copyWith(
                          fontSize: KioskLayout.productNameSize,
                        ),
                      ),
                    ),
                    _QtyButton(
                      icon: Icons.remove,
                      onTap: () => context
                          .read<KioskCubit>()
                          .setQuantity(l.id, l.quantity - 1),
                    ),
                    SizedBox(
                      width: 64,
                      child: Text(
                        '${l.quantity}',
                        textAlign: TextAlign.center,
                        style: PosText.moneyXl.copyWith(color: t.fg),
                      ),
                    ),
                    _QtyButton(
                      icon: Icons.add,
                      onTap: () => context
                          .read<KioskCubit>()
                          .setQuantity(l.id, l.quantity + 1),
                    ),
                    const SizedBox(width: Gap.lg),
                    MoneyText(l.lineTotalMinor, size: MoneySize.lg),
                  ],
                ),
              );
            },
          ),
        ),
        Container(
          padding: const EdgeInsets.all(Gap.xl),
          decoration: BoxDecoration(
            color: t.surface,
            border: Border(top: BorderSide(color: t.border)),
          ),
          child: Column(
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Text('TOTAL', style: PosText.buttonLg),
                  MoneyText(state.totalMinor, size: MoneySize.xxl),
                ],
              ),
              const SizedBox(height: Gap.lg),
              Row(
                children: <Widget>[
                  Expanded(
                    child: TouchButton(
                      label: 'TAMBAH LAGI',
                      height: Touch.critical,
                      variant: TouchVariant.secondary,
                      onPressed: () =>
                          context.read<KioskCubit>().backToBrowsing(),
                    ),
                  ),
                  const SizedBox(width: Gap.destructive),
                  Expanded(
                    flex: 2,
                    child: TouchButton(
                      label: 'KIRIM KE KASIR',
                      height: Touch.critical,
                      variant: TouchVariant.success,
                      isLoading: state.submitting,
                      onPressed: () => context.read<KioskCubit>().submit(),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _QtyButton extends StatelessWidget {
  const _QtyButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      // 64 dp — pelanggan tidak terlatih dan hanya memakai perangkat sekali.
      width: Touch.kiosk,
      height: Touch.kiosk,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(padding: EdgeInsets.zero),
        child: Icon(icon, size: 28),
      ),
    );
  }
}

/// Konfirmasi + label yang ditunjukkan ke kasir.
class _Submitted extends StatelessWidget {
  const _Submitted({required this.state});

  final KioskState state;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Gap.xxl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Icon(Icons.check_circle_outline, size: 96, color: t.success),
            const SizedBox(height: Gap.xl),
            Text('Pesanan terkirim', style: PosText.money2xl.copyWith(color: t.fg)),
            const SizedBox(height: Gap.lg),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: Gap.xxl,
                vertical: Gap.lg,
              ),
              decoration: BoxDecoration(
                color: t.accentSubtle,
                borderRadius: BorderRadius.circular(Radii.lg),
                border: Border.all(color: t.accent, width: 2),
              ),
              child: Text(
                state.queueLabel ?? '-',
                style: PosText.money2xl.copyWith(color: t.accent),
              ),
            ),
            const SizedBox(height: Gap.xl),
            Text(
              // Pembayaran TIDAK terjadi di kiosk — tidak ada payment gateway
              // di sistem ini ([03 §14]).
              'Tunjukkan nomor ini ke kasir untuk membayar.',
              textAlign: TextAlign.center,
              style: PosText.buttonLg.copyWith(color: t.fgMuted),
            ),
          ],
        ),
      ),
    );
  }
}
