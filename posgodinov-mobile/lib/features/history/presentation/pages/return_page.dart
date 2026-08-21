import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/pos/cancellation_policy.dart';
import 'package:posgodinov_mobile/core/sync/sync_triggers.dart';
import 'package:posgodinov_mobile/features/auth/presentation/cubit/cashier_auth_cubit.dart';
import 'package:posgodinov_mobile/features/history/data/repositories/return_repository_impl.dart';
import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// Label Bahasa Indonesia untuk kamus beku [ReasonCodes].
const Map<String, String> kReturnReasonLabels = <String, String>{
  'DEFECTIVE': 'Barang rusak',
  'WRONG_ITEM_DELIVERED': 'Salah barang diserahkan',
  'CUSTOMER_CHANGED_MIND': 'Pelanggan berubah pikiran',
  'EXPIRED': 'Kedaluwarsa',
  'SIZE_EXCHANGE': 'Tukar ukuran',
  'OTHER': 'Lainnya',
};

const Map<String, String> kWasteReasonLabels = <String, String>{
  'EXPIRED': 'Kedaluwarsa',
  'SPOILED': 'Basi / rusak',
  'BROKEN': 'Pecah / patah',
  'SPILLED': 'Tumpah',
  'STAFF_MEAL': 'Konsumsi staf',
  'SAMPLE_TASTING': 'Sampel / tester',
  'PRODUCTION_ERROR': 'Kesalahan produksi',
  'OTHER': 'Lainnya',
};

/// **P-15 — Retur.** Layar baru pada Fase M13.3.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// RETUR BUKAN "VOID YANG TERLAMBAT"
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Transaksi asal **tidak disentuh sama sekali** oleh layar ini. Yang lahir
/// adalah baris `returns` baru dengan waktunya sendiri dan shift-nya sendiri.
///
/// Dua hal yang membuatnya mustahil direduksi menjadi transaksi bernilai
/// negatif:
///
/// 1. **Arah uang dan arah barang dapat berbeda.** Barang rusak: uang kembali
///    ke pelanggan, stok TIDAK kembali. Itulah `restock`.
/// 2. **Batas per baris, bukan per transaksi.** Item yang sudah habis diretur
///    tetap ditampilkan dengan sisa 0, supaya kasir tidak bertanya-tanya
///    mengapa totalnya tidak cocok.
class ReturnPage extends StatefulWidget {
  const ReturnPage({super.key, required this.entry});

  final HistoryEntry entry;

  @override
  State<ReturnPage> createState() => _ReturnPageState();
}

class _ReturnPageState extends State<ReturnPage> {
  final TextEditingController _notes = TextEditingController();
  final ReturnRepositoryImpl _repo = ReturnRepositoryImpl(
    dao: getIt.get(),
    printQueue: getIt.get(),
  );

  CancellationDecision? _decision;
  bool _loading = true;
  bool _busy = false;

  /// `transactionItemId → qty yang dipilih`.
  final Map<String, int> _picked = <String, int>{};

  /// `transactionItemId → apakah barangnya kembali ke stok`.
  final Map<String, bool> _restock = <String, bool>{};

  /// `transactionItemId → alasan pembuangan` (wajib bila tidak restock).
  final Map<String, String> _wasteReason = <String, String>{};

  RefundMethod _refundMethod = RefundMethod.cash;
  String? _reasonCode;

  @override
  void initState() {
    super.initState();
    // `unawaited` eksplisit: `initState` tidak boleh `async`, dan Future yang
    // dibiarkan menggantung tanpa penanda akan ditandai analyzer.
    unawaited(_loadReturnable());
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  /// Membaca sisa yang boleh diretur, lalu menghitung keputusannya.
  Future<void> _loadReturnable() async {
    final Map<String, int> already =
        await _repo.returnedQuantities(widget.entry.id);

    if (!mounted) return;
    setState(() {
      _decision = decideCancellation(
        CancellableTransaction(
          id: widget.entry.id,
          status: widget.entry.status,
          receiptPrintedAt: widget.entry.receiptPrintedAt,
          items: <CancellableItem>[
            for (int i = 0; i < widget.entry.lines.length; i++)
              CancellableItem(
                id: i < widget.entry.itemIds.length
                    ? widget.entry.itemIds[i]
                    : '',
                productId: widget.entry.lines[i].productId,
                productName: widget.entry.lines[i].productName,
                quantity: widget.entry.lines[i].quantity,
                unitPriceMinor: widget.entry.lines[i].unitPriceMinor,
              ),
          ],
        ),
        alreadyReturned: already,
      );
      _loading = false;
    });
  }

  int get _selectedCount =>
      _picked.values.fold<int>(0, (int sum, int q) => sum + q);

  int get _selectedTotalMinor {
    final CancellationDecision? d = _decision;
    if (d == null) return 0;
    return d.returnableItems.fold<int>(
      0,
      (int sum, ReturnableItem i) =>
          sum + (_picked[i.transactionItemId] ?? 0) * i.unitPriceMinor,
    );
  }

  /// Setiap item yang tidak kembali ke stok WAJIB punya alasan pembuangan.
  ///
  /// Tanpa alasan itu, selisih stok muncul saat opname tanpa penjelasan — dan
  /// tertuduhnya adalah petugas gudang.
  bool get _missingWasteReason {
    final CancellationDecision? d = _decision;
    if (d == null) return false;
    return d.returnableItems.any((ReturnableItem i) {
      final int qty = _picked[i.transactionItemId] ?? 0;
      if (qty == 0) return false;
      if (_restock[i.transactionItemId] != false) return false;
      return _wasteReason[i.transactionItemId] == null;
    });
  }

  bool get _canSubmit {
    final String? code = _reasonCode;
    if (code == null || _selectedCount == 0 || _busy) return false;
    if (_missingWasteReason) return false;
    if (code == ReasonCodes.other &&
        _notes.text.trim().length < ReasonCodes.otherNotesMinLength) {
      return false;
    }
    return true;
  }

  Future<void> _submit() async {
    final CancellationDecision? d = _decision;
    if (!_canSubmit || d == null) return;

    final ShiftState shift = context.read<ShiftCubit>().state;
    final CashierAuthState auth = context.read<CashierAuthCubit>().state;

    if (shift is! ShiftActive || auth is! CashierLoggedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Retur harus terikat pada shift dan kasir yang aktif.'),
        ),
      );
      return;
    }

    setState(() => _busy = true);
    try {
      // Sisa dibaca ULANG tepat sebelum menulis: sebuah retur dari perangkat
      // lain bisa saja tersinkron sejak layar ini dibuka.
      final Map<String, int> fresh =
          await _repo.returnedQuantities(widget.entry.id);

      final List<ReturnLineDraft> lines = <ReturnLineDraft>[];
      for (final ReturnableItem item in d.returnableItems) {
        final int qty = _picked[item.transactionItemId] ?? 0;
        if (qty == 0) continue;

        final int limit = item.originalQuantity -
            (fresh[item.transactionItemId] ?? 0);
        if (qty > limit) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Sisa yang boleh diretur untuk ${item.productName} berubah '
                'menjadi ${limit < 0 ? 0 : limit}.',
              ),
            ),
          );
          return;
        }

        final bool keepsStock = _restock[item.transactionItemId] != false;
        lines.add(
          ReturnLineDraft(
            transactionItemId: item.transactionItemId,
            productId: item.productId,
            productName: item.productName,
            quantity: qty,
            unitPriceMinor: item.unitPriceMinor,
            restock: keepsStock,
            wasteReasonCode:
                keepsStock ? null : _wasteReason[item.transactionItemId],
          ),
        );
      }

      await _repo.saveReturn(
        originalTransactionId: widget.entry.id,
        shiftId: shift.shift.id,
        staffId: auth.session.staffId,
        refundMethod: _refundMethod,
        reasonCode: _reasonCode!,
        reasonNotes: _notes.text.trim(),
        cashierName: auth.session.name,
        originalCode: widget.entry.shortId,
        lines: lines,
        originalQuantities: <String, int>{
          for (final ReturnableItem i in d.returnableItems)
            i.transactionItemId: i.originalQuantity,
        },
      );

      // Retur memakai pemicunya sendiri agar `syncLog` mencatat alasan yang
      // paling layak ditelusuri auditor ([11 §M12.2]).
      getIt<SyncTriggers>().onReturnSaved();

      if (mounted) Navigator.of(context).pop();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final CancellationDecision d = _decision!;

    if (!d.isReturn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Retur Penjualan')),
        body: Padding(
          padding: const EdgeInsets.all(Gap.xl),
          child: Text(
            d.isVoid
                ? 'Struk transaksi ini belum pernah terbit, sehingga jalurnya '
                    'adalah Pembatalan (Void), bukan Retur.'
                : d.reason?.message ?? 'Retur tidak dapat diproses.',
            style: PosText.base,
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppBar(title: const Text('Retur Penjualan')),
      body: ListView(
        padding: const EdgeInsets.all(Gap.xl),
        children: <Widget>[
          Container(
            padding: const EdgeInsets.all(Gap.lg),
            decoration: BoxDecoration(
              color: t.warningSubtle,
              borderRadius: BorderRadius.circular(Radii.lg),
            ),
            child: Text(
              'Retur menerbitkan catatan BARU; transaksi aslinya tetap '
              'tercatat sebagaimana adanya. Itulah yang membuat struk di tangan '
              'pelanggan tetap cocok dengan pembukuan.',
              style: PosText.sm,
            ),
          ),

          const SizedBox(height: Gap.lg),
          Text('Item yang diretur', style: PosText.buttonLg),
          const SizedBox(height: Gap.sm),

          for (final ReturnableItem item in d.returnableItems)
            _ItemTile(
              item: item,
              picked: _picked[item.transactionItemId] ?? 0,
              restock: _restock[item.transactionItemId] ?? true,
              wasteReason: _wasteReason[item.transactionItemId],
              onQty: (int next) => setState(() {
                // Penjepitan pada `returnable`, BUKAN pada kuantitas asli.
                // Inilah batas yang mencegah barang yang sama diretur dua kali.
                _picked[item.transactionItemId] =
                    next < 0 ? 0 : (next > item.returnable ? item.returnable : next);
              }),
              onRestock: (bool value) =>
                  setState(() => _restock[item.transactionItemId] = value),
              onWasteReason: (String? value) => setState(() {
                if (value != null) {
                  _wasteReason[item.transactionItemId] = value;
                }
              }),
            ),

          const SizedBox(height: Gap.lg),
          Text('Metode pengembalian', style: PosText.sm.copyWith(color: t.fgMuted)),
          const SizedBox(height: Gap.xs),
          DropdownButtonFormField<RefundMethod>(
            initialValue: _refundMethod,
            isExpanded: true,
            items: <DropdownMenuItem<RefundMethod>>[
              for (final RefundMethod m in RefundMethod.values)
                DropdownMenuItem<RefundMethod>(value: m, child: Text(m.label)),
            ],
            onChanged: (RefundMethod? v) =>
                setState(() => _refundMethod = v ?? RefundMethod.cash),
          ),

          const SizedBox(height: Gap.lg),
          Text('Alasan retur (wajib)', style: PosText.sm.copyWith(color: t.fgMuted)),
          const SizedBox(height: Gap.xs),
          DropdownButtonFormField<String>(
            initialValue: _reasonCode,
            isExpanded: true,
            hint: const Text('— Pilih alasan —'),
            items: <DropdownMenuItem<String>>[
              for (final String code in ReasonCodes.returnReasons)
                DropdownMenuItem<String>(
                  value: code,
                  child: Text(kReturnReasonLabels[code] ?? code),
                ),
            ],
            onChanged: (String? v) => setState(() => _reasonCode = v),
          ),

          const SizedBox(height: Gap.md),
          TextField(
            controller: _notes,
            maxLines: 2,
            onChanged: (_) => setState(() {}),
            style: PosText.base,
            decoration: InputDecoration(
              labelText: _reasonCode == ReasonCodes.other
                  ? 'Catatan (wajib, min. ${ReasonCodes.otherNotesMinLength} karakter)'
                  : 'Catatan (opsional)',
              hintText: 'Contoh: kemasan bocor saat diterima pelanggan',
            ),
          ),

          const SizedBox(height: Gap.xl),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text('$_selectedCount item dikembalikan', style: PosText.sm),
              MoneyText(_selectedTotalMinor, size: MoneySize.xl),
            ],
          ),

          const SizedBox(height: Gap.lg),
          TouchButton(
            label: 'Proses Retur',
            icon: Icons.assignment_return_outlined,
            variant: TouchVariant.danger,
            isLoading: _busy,
            onPressed: _canSubmit ? _submit : null,
          ),
        ],
      ),
    );
  }
}

class _ItemTile extends StatelessWidget {
  const _ItemTile({
    required this.item,
    required this.picked,
    required this.restock,
    required this.wasteReason,
    required this.onQty,
    required this.onRestock,
    required this.onWasteReason,
  });

  final ReturnableItem item;
  final int picked;
  final bool restock;
  final String? wasteReason;
  final ValueChanged<int> onQty;
  final ValueChanged<bool> onRestock;
  final ValueChanged<String?> onWasteReason;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      margin: const EdgeInsets.only(bottom: Gap.sm),
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: item.isExhausted ? t.bg : t.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: t.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(child: Text(item.productName, style: PosText.base)),
              MoneyText(item.unitPriceMinor, size: MoneySize.sm),
            ],
          ),
          Text(
            'Dibeli ${item.originalQuantity}'
            '${item.alreadyReturned > 0 ? ' · sudah diretur ${item.alreadyReturned}' : ''}'
            ' · sisa ${item.returnable}',
            style: PosText.xs.copyWith(color: t.fgMuted),
          ),

          if (item.isExhausted)
            Padding(
              padding: const EdgeInsets.only(top: Gap.xs),
              child: Text(
                'Sudah diretur seluruhnya',
                style: PosText.xs.copyWith(color: t.fgSubtle),
              ),
            )
          else ...<Widget>[
            const SizedBox(height: Gap.sm),
            Row(
              children: <Widget>[
                IconButton.filledTonal(
                  onPressed: () => onQty(picked - 1),
                  icon: const Icon(Icons.remove),
                  tooltip: 'Kurangi',
                ),
                SizedBox(
                  width: 48,
                  child: Text(
                    '$picked',
                    textAlign: TextAlign.center,
                    style: PosText.buttonLg,
                  ),
                ),
                IconButton.filledTonal(
                  onPressed: () => onQty(picked + 1),
                  icon: const Icon(Icons.add),
                  tooltip: 'Tambah',
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => onQty(item.returnable),
                  child: Text('Semua (${item.returnable})'),
                ),
              ],
            ),

            if (picked > 0) ...<Widget>[
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: restock,
                onChanged: onRestock,
                title: Text('Barang kembali ke stok', style: PosText.sm),
              ),
              if (!restock)
                DropdownButtonFormField<String>(
                  initialValue: wasteReason,
                  isExpanded: true,
                  hint: const Text('— Alasan pembuangan (wajib) —'),
                  items: <DropdownMenuItem<String>>[
                    for (final String code in ReasonCodes.wasteReasons)
                      DropdownMenuItem<String>(
                        value: code,
                        child: Text(kWasteReasonLabels[code] ?? code),
                      ),
                  ],
                  onChanged: onWasteReason,
                ),
            ],
          ],
        ],
      ),
    );
  }
}
