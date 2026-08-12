import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/features/auth/domain/entities/cashier_session.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/catalog.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/held_cart_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/held_carts_page.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/cart_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/catalog_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/transaction_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/payment_page.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/receipt_page.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/cart_panel.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/category_tabs.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/product_tile.dart';
import 'package:posgodinov_mobile/features/device/presentation/pages/settings_page.dart';
import 'package:posgodinov_mobile/features/history/domain/repositories/history_repository.dart';
import 'package:posgodinov_mobile/features/history/presentation/cubit/history_cubit.dart';
import 'package:posgodinov_mobile/features/history/presentation/pages/history_page.dart';
import 'package:posgodinov_mobile/features/printer/presentation/cubit/printer_cubit.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';
import 'package:posgodinov_mobile/features/shift/presentation/pages/close_shift_page.dart';
import 'package:posgodinov_mobile/features/sync/presentation/cubit/sync_cubit.dart';
import 'package:posgodinov_mobile/features/waste/presentation/cubit/waste_cubit.dart';
import 'package:posgodinov_mobile/features/waste/presentation/pages/waste_page.dart';
import 'package:posgodinov_mobile/features/sync/presentation/pages/sync_status_page.dart';
import 'package:posgodinov_mobile/features/sync/presentation/widgets/sync_badge_chip.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/breakpoints.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-05 — Kasir Utama.**
///
/// Tampilan bawaan sepanjang shift. Split-screen 62/38 pada tablet; pada
/// handheld keranjang menjadi *bottom sheet* dengan bar ringkasan permanen —
/// prinsip "keranjang tidak pernah hilang" dipertahankan lewat bar itu
/// ([06 §3.7]).
class RegisterPage extends StatefulWidget {
  const RegisterPage({
    super.key,
    required this.session,
    required this.shiftId,
  });

  final CashierSession session;
  final String shiftId;

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<CatalogCubit>().load();
    });
  }

  Future<void> _openPayment() async {
    final CartState cart = context.read<CartCubit>().state;
    if (cart.isEmpty) return;

    final TransactionCubit tx = context.read<TransactionCubit>();
    tx.startPayment(cart.totalMinor);

    await showDialog<void>(
      context: context,
      // Ketukan pada scrim TIDAK menutup: sentuhan tak sengaja saat memegang
      // tablet akan membatalkan transaksi ([06 §4.6.1]).
      barrierDismissible: false,
      builder: (BuildContext dialogContext) => BlocProvider<TransactionCubit>
          .value(
        value: tx,
        child: PaymentDialog(
          onConfirm: () async {
            Navigator.of(dialogContext).pop();
            await tx.confirmPayment(
              shiftId: widget.shiftId,
              cashierName: widget.session.name,
              lines: cart.lines,
              customerName: cart.customerName,
            );
            if (mounted) await _showReceipt();
          },
        ),
      ),
    );
  }

  /// P-08 — menahan keranjang berjalan.
  Future<void> _holdCart() async {
    final CartState cart = context.read<CartCubit>().state;
    if (cart.isEmpty) return;

    final String? label = await showDialog<String>(
      context: context,
      builder: (_) => const HoldLabelDialog(),
    );
    if (label == null || !mounted) return;

    await getIt<HeldCartRepository>().hold(lines: cart.lines, label: label);
    if (mounted) context.read<CartCubit>().clear();
  }

  /// Mengambil kembali pesanan tertahan ke keranjang aktif.
  Future<void> _resumeHeld(String id) async {
    final List<CartLine> lines = await getIt<HeldCartRepository>().resume(id);
    if (!mounted || lines.isEmpty) return;
    // UUID baris dipertahankan apa adanya — pesanan yang dibayar nanti memakai
    // id item yang SAMA ([03 §2.3]).
    context.read<CartCubit>().restore(lines, heldId: id);
  }

  Future<void> _openHeldList() async {
    final HeldCartCubit cubit = getIt<HeldCartCubit>();
    await cubit.observe();
    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => BlocProvider<HeldCartCubit>.value(
        value: cubit,
        child: HeldCartsSheet(onResume: _resumeHeld),
      ),
    );
  }

  void _push(Widget page) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => page),
    );
  }

  /// P-09 — riwayat transaksi shift berjalan.
  void _openHistory() {
    _push(
      BlocProvider<HistoryCubit>(
        create: (_) => HistoryCubit(getIt<HistoryRepository>()),
        child: HistoryPage(shiftId: widget.shiftId),
      ),
    );
  }

  /// P-11 — lapor waste produk.
  void _openWaste() {
    _push(
      BlocProvider<WasteCubit>.value(
        value: getIt<WasteCubit>(),
        child: WastePage(staffId: widget.session.staffId),
      ),
    );
  }

  /// P-12 — tutup shift. Memicu sinkronisasi begitu tersimpan.
  void _openCloseShift() {
    _push(
      BlocProvider<ShiftCubit>.value(
        value: getIt<ShiftCubit>(),
        child: const CloseShiftPage(),
      ),
    );
  }

  /// P-14 — pengaturan.
  void _openSettings() {
    _push(
      BlocProvider<PrinterCubit>.value(
        value: getIt<PrinterCubit>(),
        child: SettingsPage(cashierName: widget.session.name),
      ),
    );
  }

  Future<void> _showReceipt() async {
    final TransactionCubit tx = context.read<TransactionCubit>();

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => BlocProvider<TransactionCubit>.value(
        value: tx,
        child: const ReceiptDialog(),
      ),
    );

    if (!mounted) return;
    // Keranjang dikosongkan HANYA setelah transaksi benar-benar tersimpan.
    if (tx.state is TxCompleted) context.read<CartCubit>().clear();
    tx.finish();
  }

  /// Aksi M7 yang dapat dijangkau dari layar kasir.
  ///
  /// "Tutup Shift" sengaja diletakkan paling kanan dan berwarna netral: ia
  /// mengakhiri sesi kerja dan tidak boleh tertekan saat kasir bermaksud
  /// membuka riwayat ([06 §2.2]).
  List<Widget> _menuActions() => <Widget>[
        IconButton(
          onPressed: _openHeldList,
          icon: const Icon(Icons.pause_circle_outline),
          tooltip: 'Pesanan ditahan',
        ),
        IconButton(
          onPressed: _openHistory,
          icon: const Icon(Icons.receipt_long_outlined),
          tooltip: 'Riwayat transaksi',
        ),
        IconButton(
          onPressed: _openWaste,
          icon: const Icon(Icons.delete_outline),
          tooltip: 'Lapor waste',
        ),
        IconButton(
          onPressed: _openSettings,
          icon: const Icon(Icons.settings_outlined),
          tooltip: 'Pengaturan',
        ),
        const SizedBox(width: Gap.destructive),
        IconButton(
          onPressed: _openCloseShift,
          icon: const Icon(Icons.lock_outline),
          tooltip: 'Tutup shift',
        ),
      ];

  @override
  Widget build(BuildContext context) {
    final PosLayout layout = context.layout;

    if (context.isHandheld) {
      return _HandheldLayout(
        onPay: _openPayment,
        onHeldList: _openHeldList,
        menuActions: _menuActions(),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Kasir · ${widget.session.shortName}'),
        actions: _menuActions(),
      ),
      body: SafeArea(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (layout.cartFixedWidth != null) ...<Widget>[
              const Expanded(child: _ProductPanel()),
              SizedBox(
                width: layout.cartFixedWidth,
                child: _CartSide(onPay: _openPayment, onHold: _holdCart),
              ),
            ] else ...<Widget>[
              Expanded(flex: layout.productFlex, child: const _ProductPanel()),
              Expanded(
                flex: layout.cartFlex,
                child: _CartSide(onPay: _openPayment, onHold: _holdCart),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Panel kiri: pencarian, tab kategori, grid produk.
class _ProductPanel extends StatelessWidget {
  const _ProductPanel();

  @override
  Widget build(BuildContext context) {
    final PosLayout layout = context.layout;
    final GodinovTokens t = context.tokens;

    return Container(
      color: t.bg,
      padding: EdgeInsets.all(layout.panelPadding),
      child: BlocBuilder<CatalogCubit, CatalogState>(
        builder: (BuildContext context, CatalogState state) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              const _SyncStrip(),
              const SizedBox(height: Gap.sm),
              SizedBox(
                height: Touch.frequent,
                child: TextField(
                  onChanged: context.read<CatalogCubit>().search,
                  style: PosText.base,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'Cari produk',
                  ),
                ),
              ),
              const SizedBox(height: Gap.md),
              CategoryTabs(
                categories: state.categories,
                selectedId: state.selectedCategoryId,
                totalProductCount: state.totalProductCount,
                onSelected: context.read<CatalogCubit>().selectCategory,
              ),
              const SizedBox(height: Gap.md),
              Expanded(
                child: state.loading
                    ? const Center(child: CircularProgressIndicator())
                    : _ProductGrid(
                        products: state.visibleProducts,
                        layout: layout,
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ProductGrid extends StatelessWidget {
  const _ProductGrid({required this.products, required this.layout});

  final List<CatalogProduct> products;
  final PosLayout layout;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) {
      return Center(
        child: Text(
          'Tidak ada produk.',
          style: PosText.base.copyWith(color: context.tokens.fgMuted),
        ),
      );
    }

    return GridView.builder(
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: layout.gridColumns,
        mainAxisSpacing: layout.gutter,
        crossAxisSpacing: layout.gutter,
        mainAxisExtent: layout.tileHeight,
      ),
      itemCount: products.length,
      itemBuilder: (BuildContext context, int i) {
        final CatalogProduct p = products[i];
        return ProductTile(
          product: p,
          height: layout.tileHeight,
          onTap: () => context.read<CartCubit>().addProduct(
                productId: p.id,
                productName: p.name,
                priceMinor: p.priceMinor,
              ),
        );
      },
    );
  }
}

class _CartSide extends StatelessWidget {
  const _CartSide({required this.onPay, required this.onHold});

  final VoidCallback onPay;
  final VoidCallback onHold;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CartCubit, CartState>(
      builder: (BuildContext context, CartState state) {
        final CartCubit cart = context.read<CartCubit>();
        return CartPanel(
          state: state,
          onIncrement: cart.increment,
          onDecrement: cart.decrement,
          onRemove: cart.removeLine,
          onClear: cart.clear,
          onHold: onHold,
          onPay: onPay,
        );
      },
    );
  }
}

/// Tata letak handheld: grid penuh + bar ringkasan 72 dp yang menempel di bawah.
class _HandheldLayout extends StatelessWidget {
  const _HandheldLayout({
    required this.onPay,
    required this.onHeldList,
    required this.menuActions,
  });

  final VoidCallback onPay;
  final VoidCallback onHeldList;
  final List<Widget> menuActions;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kasir'),
        actions: <Widget>[
          IconButton(
            onPressed: onHeldList,
            icon: const Icon(Icons.pause_circle_outline),
            tooltip: 'Pesanan ditahan',
          ),
          ...menuActions,
        ],
      ),
      body: const SafeArea(child: _ProductPanel()),
      bottomNavigationBar: BlocBuilder<CartCubit, CartState>(
        builder: (BuildContext context, CartState state) {
          if (state.isEmpty) return const SizedBox.shrink();

          return SafeArea(
            child: Container(
              height: Sizes.cartSummaryBar,
              padding: const EdgeInsets.symmetric(horizontal: Gap.md),
              color: context.tokens.surface,
              child: Row(
                children: <Widget>[
                  Text('${state.itemCount} item', style: PosText.sm),
                  const SizedBox(width: Gap.md),
                  MoneyText(state.totalMinor, size: MoneySize.lg),
                  const Spacer(),
                  SizedBox(
                    width: 160,
                    child: TouchButton(
                      label: 'BAYAR',
                      variant: TouchVariant.success,
                      onPressed: onPay,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Baris status ringkas di atas panel produk.
///
/// Menggantikan StatusBar penuh ([06 §4.7]) sampai P-14 lahir di M7; slot
/// kasir, shift, dan jam menyusul di sana. Yang sudah ada sekarang adalah
/// bagian yang paling berkonsekuensi: keadaan sinkronisasi.
class _SyncStrip extends StatelessWidget {
  const _SyncStrip();

  @override
  Widget build(BuildContext context) {
    final SyncCubit cubit = getIt<SyncCubit>();

    return BlocProvider<SyncCubit>.value(
      value: cubit,
      child: BlocBuilder<SyncCubit, SyncState>(
        builder: (BuildContext context, SyncState state) {
          return Align(
            alignment: Alignment.centerLeft,
            child: SyncBadgeChip(
              state: state,
              // Mengetuk lencana membuka P-13 — jalur tercepat dari "ada yang
              // aneh" ke penjelasan lengkap ([06 §4.7]).
              onTap: () => Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => BlocProvider<SyncCubit>.value(
                    value: cubit,
                    child: const SyncStatusPage(),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
