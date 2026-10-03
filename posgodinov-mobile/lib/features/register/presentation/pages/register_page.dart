import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/config/pos_config.dart';
import 'package:posgodinov_mobile/core/database/daos/print_job_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/printer/audit_receipt_data.dart';
import 'package:posgodinov_mobile/core/printer/print_queue_service.dart';
import 'package:posgodinov_mobile/core/sync/sync_triggers.dart';
import 'package:posgodinov_mobile/features/auth/domain/entities/cashier_session.dart';
import 'package:posgodinov_mobile/features/auth/presentation/cubit/cashier_auth_cubit.dart';
import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';
import 'package:posgodinov_mobile/features/history/presentation/widgets/void_reason_sheet.dart';
import 'package:posgodinov_mobile/features/printing/presentation/widgets/receipt_preview_dialog.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/catalog.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/held_cart_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/held_carts_page.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/cart_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/catalog_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/transaction_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/receipt_page.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/catalog_modal.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/register_action_bar.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/register_summary_panel.dart';
import 'package:posgodinov_mobile/features/register/presentation/widgets/selected_items_table.dart';
import 'package:posgodinov_mobile/features/waste/presentation/widgets/waste_entry_dialog.dart';
import 'package:posgodinov_mobile/features/waste/domain/repositories/waste_repository.dart';
import 'package:posgodinov_mobile/features/device/presentation/pages/settings_page.dart';
import 'package:posgodinov_mobile/features/history/domain/repositories/history_repository.dart';
import 'package:posgodinov_mobile/features/history/presentation/cubit/history_cubit.dart';
import 'package:posgodinov_mobile/features/history/presentation/pages/history_page.dart';
import 'package:uuid/uuid.dart';
import 'package:posgodinov_mobile/features/printer/presentation/cubit/printer_cubit.dart';
import 'package:posgodinov_mobile/features/printing/presentation/cubit/print_queue_cubit.dart';
import 'package:posgodinov_mobile/features/printing/presentation/widgets/print_queue_banner.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';
import 'package:posgodinov_mobile/features/shift/presentation/pages/close_shift_page.dart';
import 'package:posgodinov_mobile/features/sync/presentation/cubit/sync_cubit.dart';
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

    final PrintQueueService printQueue = getIt<PrintQueueService>();
    final String outletName = await printQueue.resolveOutletName();
    if (!mounted) return;

    final bool saved = await PaymentFlow.open(
      context,
      cubit: tx,
      totalMinor: cart.totalMinor,
      lines: cart.lines,
      customerName: cart.customerName,
      outletName: outletName,
      onConfirm: (List<TenderDraft> tenders, int cashReceivedMinor) async {
        // Bila transaksi memuat item Waste, catat ke log audit waste
        for (final CartLine l in cart.lines) {
          if (l.note.toLowerCase().contains('waste')) {
            try {
              await getIt<WasteRepository>().report(
                staffId: widget.session.staffId,
                productId: l.productId,
                productName: l.productName,
                quantity: l.quantity,
                reason: l.note.replaceFirst(RegExp(r'^\[Waste\]\s*'), ''),
                staffName: widget.session.name,
                shiftId: widget.shiftId,
              );
            } on Object {
              // Ditoleransi bila sudah tercatat
            }
          }
        }

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
        child: HistoryPage(
          shiftId: widget.shiftId,
          onReprint: (HistoryEntry entry) async {
            final PrintQueueService printQueue = getIt<PrintQueueService>();
            final String outletName = await printQueue.resolveOutletName();
            if (!mounted) return;
            await ReceiptPreviewDialog.open(
              context,
              title: 'STRUK TRANSAKSI (CETAK ULANG)',
              subtitle: 'No. ${entry.shortId}',
              outletName: outletName,
              dateTime: entry.clientCreatedAt,
              cashierName: widget.session.name,
              items: entry.lines
                  .map(
                    (HistoryLine l) => ReceiptPreviewItem(
                      name: l.productName,
                      quantity: l.quantity,
                      priceMinor:
                          l.lineTotalMinor ~/ (l.quantity > 0 ? l.quantity : 1),
                      totalMinor: l.lineTotalMinor,
                    ),
                  )
                  .toList(),
              totalAmountMinor: entry.totalMinor,
              summaryRows: <String, String>{
                'Metode Pembayaran': entry.paymentMethod.label,
                'Status': entry.status.wireValue,
              },
              onPrint: () async {
                final PrintJobDao dao = getIt<PrintJobDao>();
                final dynamic jobs =
                    await dao.byRef('transaction', entry.id);
                if (jobs is List && jobs.isNotEmpty) {
                  await getIt<PrintQueueService>().flush();
                }
              },
            );
          },
        ),
      ),
    );
  }

  /// P-11 — lapor waste produk.
  void _openWaste() {
    WasteEntryDialog.open(
      context,
      staffId: widget.session.staffId,
      staffName: widget.session.name,
      shiftId: widget.shiftId,
    );
  }

  /// P-12 — tutup shift dengan proteksi transaksi aktif dan pending (Poin 8).
  void _openCloseShift() {
    final CartState cartState = context.read<CartCubit>().state;
    if (cartState.lines.isNotEmpty) {
      showDialog<void>(
        context: context,
        builder: (BuildContext ctx) => AlertDialog(
          icon: const Icon(
            Icons.warning_amber_rounded,
            color: Colors.orange,
            size: 44,
          ),
          title: const Text('Tidak Dapat Menutup Shift'),
          content: const Text(
            'Masih ada transaksi yang sedang berjalan di kasir.\n\n'
            'Silakan selesaikan pembayaran (Cashout) atau lakukan pembatalan (Void) '
            'terlebih dahulu sebelum menutup shift.',
          ),
          actions: <Widget>[
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Mengerti'),
            ),
          ],
        ),
      );
      return;
    }

    final List<HeldCartSummary> heldList = getIt<HeldCartCubit>().state;
    if (heldList.isNotEmpty) {
      showDialog<void>(
        context: context,
        builder: (BuildContext ctx) => AlertDialog(
          icon: const Icon(
            Icons.warning_amber_rounded,
            color: Colors.orange,
            size: 44,
          ),
          title: const Text('Tidak Dapat Menutup Shift'),
          content: Text(
            'Terdapat ${heldList.length} pesanan yang masih tertahan (Pending).\n\n'
            'Harap selesaikan atau batalkan pesanan tertahan tersebut sebelum menutup shift.',
          ),
          actions: <Widget>[
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Mengerti'),
            ),
          ],
        ),
      );
      return;
    }

    _push(
      BlocProvider<ShiftCubit>.value(
        value: getIt<ShiftCubit>(),
        child: const CloseShiftPage(),
      ),
    );
  }

  /// Poin 7 — Void seluruh transaksi aktif + cetak struk fisik pembatalan.
  Future<void> _voidEntireCart(
    BuildContext context,
    CartState cartState,
  ) async {
    if (cartState.lines.isEmpty) return;

    final PosConfig config = await PosConfig.read(getIt<SyncDao>());
    if (!context.mounted) return;

    final VoidReasonResult? result = await showVoidReasonSheet(
      context,
      title: 'Batalkan Seluruh Transaksi',
      description:
          'Seluruh ${cartState.itemCount} unit produk di kasir akan dibatalkan. '
          'Struk pembatalan fisik akan dicetak dan dicatat pada log audit.',
      valueMinor: cartState.totalMinor,
      requiresAuth: config.requireSupervisorForVoid,
      submitLabel: 'Ya, Batalkan Transaksi',
    );
    if (result == null || !context.mounted) return;

    final List<CartLine> linesToVoid = List<CartLine>.of(cartState.lines);
    final int totalCancelledMinor = cartState.totalMinor;
    final String voidLogId = const Uuid().v4();

    final RegisterRepository repo = getIt<RegisterRepository>();
    for (final CartLine l in linesToVoid) {
      await repo.recordCartLineVoid(
        shiftId: widget.shiftId,
        staffId: widget.session.staffId,
        line: l,
        quantityBefore: l.quantity,
        quantityAfter: 0,
        reasonCode: result.reasonCode,
        reasonNotes: result.reasonNotes,
        cashierName: widget.session.name,
        skipPrint: true,
      );
    }

    if (!context.mounted) return;
    context.read<CartCubit>().clear();
    getIt<SyncTriggers>().onVoidSaved();

    final PrintQueueService printQueue = getIt<PrintQueueService>();
    final String outletName = await printQueue.resolveOutletName();
    final CancelReceiptData cancelData = CancelReceiptData(
      outletName: outletName,
      issuedAt: DateTime.now(),
      scope: VoidScope.transaction,
      cashierName: widget.session.name,
      reasonCode: result.reasonCode,
      reasonNotes: result.reasonNotes,
      lines: linesToVoid
          .map(
            (CartLine l) => AuditReceiptLine(
              productName: l.productName,
              quantity: l.quantity,
              unitPriceMinor: l.unitPriceMinor,
            ),
          )
          .toList(),
      totalCancelledMinor: totalCancelledMinor,
    );

    await printQueue.enqueueCancelReceipt(voidLogId, cancelData);

    if (!context.mounted) return;
    await ReceiptPreviewDialog.open(
      context,
      title: 'TRANSAKSI DIBATALKAN (VOID)',
      subtitle: 'Batal Sebelum Pembayaran Selesai',
      outletName: outletName,
      dateTime: DateTime.now(),
      cashierName: widget.session.name,
      supervisorName: null,
      items: linesToVoid
          .map(
            (CartLine l) => ReceiptPreviewItem(
              name: l.productName,
              quantity: l.quantity,
              priceMinor: l.unitPriceMinor,
              totalMinor: l.lineTotalMinor,
              note: l.note.isNotEmpty ? l.note : null,
            ),
          )
          .toList(),
      totalAmountMinor: totalCancelledMinor,
      summaryRows: <String, String>{
        'Status': 'DIBATALKAN / VOID',
        'Alasan': kVoidReasonLabels[result.reasonCode] ??
            result.reasonCode,
        if (result.reasonNotes.isNotEmpty) 'Catatan': result.reasonNotes,
      },
      onPrint: () async {
        await printQueue.enqueueCancelReceipt(
          const Uuid().v4(),
          cancelData,
        );
      },
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
          icon: Icons.lock_outline,
          label: 'Tutup Shift',
          onTap: _openCloseShift,
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
              leading: const Icon(Icons.delete_outline),
              title: const Text('Waste / Pembuangan'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _openWaste();
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
        guard: _voidGuard,
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Kasir · ${widget.session.shortName}'),
        actions: const <Widget>[
          _SyncStrip(),
        ],
      ),
      body: SafeArea(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Expanded(
              flex: layout.productFlex,
              child: Column(
                children: <Widget>[
                  Expanded(
                    child: _ProductPanel(guard: _voidGuard),
                  ),
                  BlocBuilder<CartCubit, CartState>(
                    builder: (BuildContext context, CartState cartState) {
                      return BlocBuilder<HeldCartCubit, List<HeldCartSummary>>(
                        bloc: getIt<HeldCartCubit>(),
                        builder: (
                          BuildContext context,
                          List<HeldCartSummary> heldList,
                        ) {
                          return RegisterActionBar(
                            onHold: _holdCart,
                            onHistory: _openHistory,
                            onWaste: _openWaste,
                            onVoidTransaction: () =>
                                _voidEntireCart(context, cartState),
                            onCloseShift: _openCloseShift,
                            heldCount: heldList.length,
                            hasItems: cartState.lines.isNotEmpty,
                            isAuditLocked: cartState.isAuditLocked,
                          );
                        },
                      );
                    },
                  ),
                ],
              ),
            ),
            SizedBox(
              width: layout.cartFixedWidth ?? 360,
              child: BlocBuilder<CartCubit, CartState>(
                builder: (BuildContext context, CartState cartState) {
                  return RegisterSummaryPanel(
                    state: cartState,
                    onCashout: _openPayment,
                  );
                },
              ),
            ),
          ],
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

/// Panel utama: Search bar di paling atas (dengan tombol katalog modal),
/// hasil pencarian instan bila ada query, dan tabel baris item terpilih (scrollable) bila tidak ada query.
class _ProductPanel extends StatefulWidget {
  const _ProductPanel({required this.guard});

  final CartVoidGuard guard;

  @override
  State<_ProductPanel> createState() => _ProductPanelState();
}

class _ProductPanelState extends State<_ProductPanel> {
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final PosLayout layout = context.layout;
    final GodinovTokens t = context.tokens;
    final bool isAuditLocked = context
        .select<CartCubit, bool>((CartCubit c) => c.state.isAuditLocked);

    return Container(
      color: t.bg,
      child: BlocBuilder<CatalogCubit, CatalogState>(
        builder: (BuildContext context, CatalogState catalogState) {
          final Map<String, String> catMap = <String, String>{};
          final Map<String, String> catIdToName = <String, String>{
            for (final CatalogCategory c in catalogState.categories)
              c.id: c.name,
          };
          for (final CatalogProduct p in catalogState.products) {
            if (p.categoryId != null && catIdToName.containsKey(p.categoryId)) {
              catMap[p.id] = catIdToName[p.categoryId]!;
            }
          }

          final bool hasQuery = catalogState.query.trim().isNotEmpty;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              // Kolom Search di Paling Atas Display Utama
              Container(
                padding: EdgeInsets.fromLTRB(
                  layout.panelPadding,
                  layout.panelPadding,
                  layout.panelPadding,
                  Gap.xs,
                ),
                decoration: BoxDecoration(
                  color: t.surface,
                  border: Border(bottom: BorderSide(color: t.border)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    const _PrintQueueStrip(),
                    const SizedBox(height: Gap.xs),
                    Row(
                      children: <Widget>[
                        // Tombol List / Katalog Produk (Kiri Search)
                        SizedBox(
                          height: Touch.frequent,
                          child: FilledButton.tonalIcon(
                            style: FilledButton.styleFrom(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(Radii.md),
                              ),
                            ),
                            onPressed: isAuditLocked
                                ? null
                                : () => CatalogModal.open(context),
                            icon: const Icon(Icons.format_list_bulleted),
                            label: const Text('Katalog'),
                          ),
                        ),
                        const SizedBox(width: Gap.sm),
                        Expanded(
                          child: SizedBox(
                            height: Touch.frequent,
                            child: TextField(
                              controller: _searchCtrl,
                              enabled: !isAuditLocked,
                              onChanged: context.read<CatalogCubit>().search,
                              style: PosText.base,
                              decoration: InputDecoration(
                                prefixIcon: const Icon(Icons.search),
                                suffixIcon: _searchCtrl.text.isNotEmpty
                                    ? IconButton(
                                        icon: const Icon(Icons.clear, size: 18),
                                        onPressed: () {
                                          _searchCtrl.clear();
                                          context
                                              .read<CatalogCubit>()
                                              .search('');
                                        },
                                      )
                                    : null,
                                hintText: isAuditLocked
                                    ? 'Mode audit aktif (selesaikan via CASHOUT)'
                                    : 'Cari produk...',
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: Gap.md,
                                  vertical: Gap.sm,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Jika sedang mengetik pencarian: Tampilkan produk yang match
              if (hasQuery)
                Expanded(
                  child: catalogState.visibleProducts.isEmpty
                      ? Center(
                          child: Text(
                            'Tidak ada produk yang cocok.',
                            style: PosText.base.copyWith(color: t.fgMuted),
                          ),
                        )
                      : ListView.separated(
                          padding: EdgeInsets.all(layout.panelPadding),
                          itemCount: catalogState.visibleProducts.length,
                          separatorBuilder: (_, __) =>
                              Divider(height: 1, color: t.border),
                          itemBuilder: (BuildContext ctx, int i) {
                            final CatalogProduct p =
                                catalogState.visibleProducts[i];
                            return ListTile(
                              tileColor: t.surface,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(Radii.md),
                              ),
                              title: Text(
                                p.name,
                                style: PosText.base
                                    .copyWith(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Text(
                                catMap[p.id] ?? 'Umum',
                                style: PosText.xs.copyWith(color: t.fgMuted),
                              ),
                              trailing:
                                  MoneyText(p.priceMinor, size: MoneySize.md),
                              onTap: () {
                                context.read<CartCubit>().addProduct(
                                      productId: p.id,
                                      productName: p.name,
                                      priceMinor: p.priceMinor,
                                    );
                                _searchCtrl.clear();
                                context.read<CatalogCubit>().search('');
                              },
                            );
                          },
                        ),
                )
              else
                // Default: Display Baris Item Terpilih (Scrollable & Void-Guarded)
                Expanded(
                  child: BlocBuilder<CartCubit, CartState>(
                    builder: (BuildContext context, CartState cartState) {
                      return SelectedItemsTable(
                        lines: cartState.lines,
                        productCategoryMap: catMap,
                        isLocked: cartState.isAuditLocked,
                        onIncrement: (String id) =>
                            context.read<CartCubit>().increment(id),
                        onDecrement: (String id) =>
                            context.read<CartCubit>().decrement(id),
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

/// Tata letak handheld: grid penuh + bar ringkasan 72 dp yang menempel di bawah.
class _HandheldLayout extends StatelessWidget {
  const _HandheldLayout({
    required this.session,
    required this.onPay,
    required this.bottomSlots,
    required this.guard,
  });

  final CashierSession session;
  final VoidCallback onPay;
  final List<PosBottomBarSlot> Function(int heldCount) bottomSlots;
  final CartVoidGuard guard;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Kasir · ${session.shortName}'),
        actions: const <Widget>[
          _SyncStrip(),
        ],
      ),
      body: SafeArea(child: _ProductPanel(guard: guard)),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
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
                        label: 'CASHOUT',
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
          return Padding(
            padding: const EdgeInsets.only(right: Gap.md),
            child: Center(
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
            ),
          );
        },
      ),
    );
  }
}
