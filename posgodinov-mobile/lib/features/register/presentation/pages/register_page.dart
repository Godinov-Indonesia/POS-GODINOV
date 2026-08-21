import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/features/auth/domain/entities/cashier_session.dart';
import 'package:posgodinov_mobile/features/auth/presentation/cubit/cashier_auth_cubit.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/catalog.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/held_cart_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/held_carts_page.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/cart_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/catalog_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/transaction_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/receipt_page.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/cart_panel.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/category_tabs.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/product_tile.dart';
import 'package:posgodinov_mobile/features/device/presentation/pages/settings_page.dart';
import 'package:posgodinov_mobile/features/history/domain/repositories/history_repository.dart';
import 'package:posgodinov_mobile/features/history/presentation/cubit/history_cubit.dart';
import 'package:posgodinov_mobile/features/history/presentation/pages/history_page.dart';
import 'package:posgodinov_mobile/features/printer/presentation/cubit/printer_cubit.dart';
import 'package:posgodinov_mobile/features/printing/presentation/cubit/print_queue_cubit.dart';
import 'package:posgodinov_mobile/features/printing/presentation/widgets/print_queue_banner.dart';
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
import 'package:posgodinov_mobile/shared/widgets/pos_bottom_bar.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/payment/payment_flow.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/tender_draft.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/features/register/presentation/cart_void_guard.dart';

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
  /// Gerbang butir 5 — Strict Qty Audit ([11 §M13.4]).
  ///
  /// `late final` dan bukan dibuat di `build()`: identitas kasir serta shift
  /// tidak berubah selama layar ini hidup, dan merakitnya ulang setiap render
  /// hanya membuang objek pada layar yang digambar ulang setiap ketukan produk.
  late final CartVoidGuard _voidGuard = CartVoidGuard(
    shiftId: widget.shiftId,
    staffId: widget.session.staffId,
    cashierName: widget.session.name,
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<CatalogCubit>().load();
    });
  }

  /// Membuka alur pembayaran — **layar penuh**, butir 11 ([11 §M17.2]).
  ///
  /// ⛔ `showDialog` yang lama DIHAPUS. Pembayaran bukan lagi modal di atas
  /// keranjang: setiap sub-langkah adalah rute Navigator tersendiri, sehingga
  /// tombol back perangkat mundur SATU langkah alih-alih membatalkan seluruh
  /// pembayaran.
  ///
  /// Keranjang dikosongkan HANYA setelah transaksi benar-benar tersimpan —
  /// lihat `_showReceipt`.
  Future<void> _openPayment() async {
    final CartState cart = context.read<CartCubit>().state;
    if (cart.isEmpty) return;

    final TransactionCubit tx = context.read<TransactionCubit>();

    final bool saved = await PaymentFlow.open(
      context,
      cubit: tx,
      totalMinor: cart.totalMinor,
      onConfirm: (List<TenderDraft> tenders, int cashReceivedMinor) async {
        await tx.confirmPayment(
          shiftId: widget.shiftId,
          cashierName: widget.session.name,
          lines: cart.lines,
          customerName: cart.customerName,
          tenders: tenders,
          cashReceivedMinor: cashReceivedMinor,
        );
      },
    );

    if (saved && mounted) await _showReceipt();
  }

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
  ///
  /// `syncDao` disuntikkan supaya cubit dapat membaca `config.history_scope`
  /// ([11 §M18.2]). Tanpanya, flag tidak pernah terbaca dan isolasi riwayat
  /// selalu penuh — aman, tetapi flagnya menjadi mati.
  void _openHistory() {
    _push(
      BlocProvider<HistoryCubit>(
        create: (_) => HistoryCubit(
          getIt<HistoryRepository>(),
          syncDao: getIt<SyncDao>(),
        ),
        child: HistoryPage(shiftId: widget.shiftId),
      ),
    );
  }

  /// P-11 — lapor waste produk.
  void _openWaste() {
    _push(
      BlocProvider<WasteCubit>.value(
        value: getIt<WasteCubit>(),
        child: WastePage(
          staffId: widget.session.staffId,
          staffName: widget.session.name,
          shiftId: widget.shiftId,
        ),
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
        child: SettingsPage(
          cashierName: widget.session.name,
          // ── BUTIR 12 ([11 §M15.2]) ────────────────────────────────────
          //
          // `requestLogout`, bukan `logout` yang lama. P-14 sudah
          // menyembunyikan tombolnya selama sesi terkunci, tetapi pemeriksaan
          // tetap dilakukan di sini: yang menyembunyikan tombol adalah state
          // sesaat, sedangkan yang memutuskan adalah basis data — dan shift
          // dapat lahir di antara render dan ketukan.
          onChangeCashier: () => unawaited(
            getIt<CashierAuthCubit>()
                .requestLogout(source: 'settings:ganti-kasir'),
          ),
        ),
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

  /// ═══════════════════════════════════════════════════════════════════════
  /// `_menuActions()` DIHAPUS PADA M17.1 — JANGAN DIKEMBALIKAN
  /// ═══════════════════════════════════════════════════════════════════════
  ///
  /// Metode itu mengembalikan lima `IconButton` untuk `AppBar.actions`. Kelima
  /// -limanya kini hidup di [PosBottomBar], dan `AppBar` menjadi konteks murni
  /// ([11 §M17.1], butir 18).
  ///
  /// Alasannya bukan estetika: `AppBar` berada di luar zona jempol pada
  /// handheld 6" yang dipegang satu tangan, dan setiap ikon di sana memaksa
  /// penyesuaian genggaman puluhan kali per jam.
  ///
  /// DoD M17 mengaudit hal ini lewat `grep`: tidak boleh ada `IconButton` di
  /// dalam `AppBar` layar kasir.

  /// Slot bottom bar — empat aksi utama + "Lainnya" ([11 §M17.1]).
  ///
  /// Urutan mengikuti frekuensi pakai dari kiri. Slot paling kanan berada di
  /// jangkauan jempol paling nyaman untuk tangan kanan, dan itu diberikan
  /// kepada "Lainnya" — aksi yang sering ditemukan otomatis, sedangkan yang
  /// jarang perlu dicari.
  List<PosBottomBarSlot> _bottomSlots(int heldCount) => <PosBottomBarSlot>[
        PosBottomBarSlot(
          icon: Icons.point_of_sale_outlined,
          label: 'Kasir',
          active: true,
          onTap: () {},
        ),
        PosBottomBarSlot(
          icon: Icons.pause_circle_outline,
          label: 'Tahan',
          badge: heldCount,
          onTap: _openHeldList,
        ),
        PosBottomBarSlot(
          icon: Icons.receipt_long_outlined,
          label: 'Riwayat',
          onTap: _openHistory,
        ),
        PosBottomBarSlot(
          icon: Icons.delete_outline,
          label: 'Waste',
          onTap: _openWaste,
        ),
        PosBottomBarSlot(
          icon: Icons.more_horiz,
          label: 'Lainnya',
          onTap: _openMore,
        ),
      ];

  /// *Bottom sheet* "Lainnya" — BUKAN menu yang terbuka ke atas.
  ///
  /// Menu atas mengembalikan persis masalah yang bottom bar selesaikan: isinya
  /// mendarat di luar zona jempol.
  Future<void> _openMore() async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (BuildContext sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            ListTile(
              leading: const Icon(Icons.lock_outline),
              title: const Text('Tutup Shift'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _openCloseShift();
              },
            ),
            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('Pengaturan'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _openSettings();
              },
            ),
            const SizedBox(height: Gap.md),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final PosLayout layout = context.layout;

    if (context.isHandheld) {
      return _HandheldLayout(
        session: widget.session,
        onPay: _openPayment,
        bottomSlots: _bottomSlots,
      );
    }

    return Scaffold(
      appBar: AppBar(
        // KONTEKS saja — nol `IconButton` ([11 §M17.1]).
        title: Text('Kasir · ${widget.session.shortName}'),
      ),
      body: SafeArea(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (layout.cartFixedWidth != null) ...<Widget>[
              const Expanded(child: _ProductPanel()),
              SizedBox(
                width: layout.cartFixedWidth,
                child: _CartSide(
                  guard: _voidGuard,
                  onPay: _openPayment,
                  onHold: _holdCart,
                ),
              ),
            ] else ...<Widget>[
              Expanded(flex: layout.productFlex, child: const _ProductPanel()),
              Expanded(
                flex: layout.cartFlex,
                child: _CartSide(
                  guard: _voidGuard,
                  onPay: _openPayment,
                  onHold: _holdCart,
                ),
              ),
            ],
          ],
        ),
      ),
      // Tablet landscape: bar tetap ada, TETAPI dibatasi lebarnya dan
      // diratakan ke KANAN — sisi genggaman dominan ([11 §M17.1]). Bar selebar
      // 1280 px memaksa jangkauan lengan penuh untuk mencapai slot kiri.
      bottomNavigationBar: Align(
        alignment: Alignment.centerRight,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 576),
          child: _HeldCountBuilder(builder: _bottomSlots),
        ),
      ),
    );
  }
}

/// Membangun bottom bar dengan lencana jumlah pesanan tertahan.
///
/// Dipisah supaya hitungan yang berubah tidak menggambar ulang seluruh layar
/// kasir — grid produk dan panel keranjang tidak peduli berapa pesanan yang
/// sedang ditahan.
class _HeldCountBuilder extends StatelessWidget {
  const _HeldCountBuilder({required this.builder});

  final List<PosBottomBarSlot> Function(int heldCount) builder;

  @override
  Widget build(BuildContext context) {
    // State `HeldCartCubit` ADALAH daftarnya — bukan objek pembungkus.
    return BlocBuilder<HeldCartCubit, List<HeldCartSummary>>(
      bloc: getIt<HeldCartCubit>(),
      builder: (BuildContext context, List<HeldCartSummary> carts) {
        return PosBottomBar(slots: builder(carts.length));
      },
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
              // Tepat di bawah baris status, BUKAN di Bottom Bar — Bottom Bar
              // adalah pekerjaan M17.1 dan belum ada. Menaruhnya di sini
              // membuatnya terlihat sepanjang layar kasir terbuka.
              const _PrintQueueStrip(),
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
  const _CartSide({
    required this.guard,
    required this.onPay,
    required this.onHold,
  });

  /// Gerbang butir 5 ([11 §M13.4]).
  final CartVoidGuard guard;

  final VoidCallback onPay;
  final VoidCallback onHold;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CartCubit, CartState>(
      builder: (BuildContext context, CartState state) {
        final CartCubit cart = context.read<CartCubit>();
        return CartPanel(
          state: state,
          // Menaikkan kuantitas tidak pernah diaudit — tidak ada yang hilang.
          onIncrement: cart.increment,

          // ⛔ `cart.decrement`, `cart.removeLine`, dan `cart.clear` TIDAK
          // dipanggil langsung lagi. Ketiganya melewati [CartVoidGuard], yang
          // memutuskan apakah penurunan ini menuntut pembatalan tercatat
          // (butir 5). `CartCubit` sudah melarangnya lewat dokumentasi sejak
          // M13.4, tetapi larangan yang tidak ditegakkan tidak menahan apa pun.
          onDecrement: (String id) => unawaited(
            _guarded(context, state, id, guard.decrementOne),
          ),
          onRemove: (String id) => unawaited(
            _guarded(context, state, id, guard.removeLine),
          ),
          onClear: () => unawaited(guard.clearCart(context)),

          onHold: onHold,
          onPay: onPay,
        );
      },
    );
  }

  /// Menerjemahkan `lineId` dari widget menjadi [CartLine] untuk gerbang.
  ///
  /// Baris dicari dari state yang sedang dirender — bila ia sudah lenyap
  /// (ketukan ganda pada baris terakhir), tidak ada yang perlu dikerjakan.
  Future<void> _guarded(
    BuildContext context,
    CartState state,
    String lineId,
    Future<void> Function(BuildContext, CartLine) action,
  ) async {
    for (final CartLine l in state.lines) {
      if (l.id == lineId) return action(context, l);
    }
  }
}

/// Tata letak handheld: grid penuh + bar ringkasan 72 dp yang menempel di bawah.
class _HandheldLayout extends StatelessWidget {
  const _HandheldLayout({
    required this.session,
    required this.onPay,
    required this.bottomSlots,
  });

  final CashierSession session;
  final VoidCallback onPay;
  final List<PosBottomBarSlot> Function(int heldCount) bottomSlots;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        // ⛔ NOL `IconButton` ([11 §M17.1], butir 18).
        //
        // Kelima aksi yang dulu di sini pindah ke `PosBottomBar` di bawah —
        // di dalam zona jempol. Judulnya kini memuat KONTEKS: siapa yang
        // bertugas.
        title: Text('Kasir · ${session.shortName}'),
      ),
      body: const SafeArea(child: _ProductPanel()),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          // Ringkasan keranjang DI ATAS bar navigasi, bukan menggantikannya.
          //
          // Menyembunyikan navigasi saat keranjang berisi — perilaku lama —
          // membuat kasir yang ingin membuka Riwayat harus mengosongkan
          // keranjangnya lebih dulu.
          BlocBuilder<CartCubit, CartState>(
            builder: (BuildContext context, CartState state) {
              if (state.isEmpty) return const SizedBox.shrink();

              return Container(
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
              );
            },
          ),
          _HeldCountBuilder(builder: bottomSlots),
        ],
      ),
    );
  }
}

/// Banner "N struk belum tercetak" ([11 §M14.1]).
///
/// Menyusut menjadi nol tinggi saat antrean kosong, sehingga tidak memakan
/// ruang pada hari-hari normal — dan justru karena itu, kemunculannya berarti
/// sesuatu.
class _PrintQueueStrip extends StatelessWidget {
  const _PrintQueueStrip();

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PrintQueueCubit>.value(
      value: getIt<PrintQueueCubit>(),
      child: const PrintQueueBanner(),
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
