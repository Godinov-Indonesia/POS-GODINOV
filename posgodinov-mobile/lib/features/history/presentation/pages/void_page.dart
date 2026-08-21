import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/pos/cancellation_policy.dart';
import 'package:posgodinov_mobile/core/sync/sync_triggers.dart';
import 'package:posgodinov_mobile/features/auth/presentation/cubit/cashier_auth_cubit.dart';
import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';
import 'package:posgodinov_mobile/features/history/presentation/cubit/history_cubit.dart';
import 'package:posgodinov_mobile/features/history/presentation/widgets/void_reason_sheet.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-10 — Void / Batalkan Transaksi.**
///
/// **Layar terpisah, bukan aksi inline** ([06 §2.2]). Membatalkan transaksi
/// mengembalikan bahan baku ke inventori di server dan mengubah laporan
/// pemilik; ia tidak layak berada satu ketukan dari daftar riwayat.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// LAYAR INI TIDAK LAGI MEMUTUSKAN APA PUN
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Seluruh keputusan datang dari [decideCancellation] ([11 §M13.1]). Bila
/// transaksinya ternyata sudah tercetak, layar ini **menolak memprosesnya** dan
/// mengarahkan ke alur Retur — itulah butir 15 dalam bentuk yang dilihat kasir.
class VoidPage extends StatefulWidget {
  const VoidPage({super.key, required this.entry});

  final HistoryEntry entry;

  @override
  State<VoidPage> createState() => _VoidPageState();
}

class _VoidPageState extends State<VoidPage> {
  bool _busy = false;

  CancellationDecision get _decision => decideCancellation(
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
      );

  Future<void> _submit() async {
    // Keputusan diambil ULANG tepat sebelum menulis: antara render dan ketukan,
    // struknya bisa saja baru selesai tercetak.
    final CancellationDecision decision = _decision;
    if (!decision.isVoid) {
      _showBlocked(decision);
      return;
    }

    final ShiftState shift = context.read<ShiftCubit>().state;
    final CashierAuthState auth = context.read<CashierAuthCubit>().state;

    if (shift is! ShiftActive || auth is! CashierLoggedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Pembatalan harus terikat pada shift dan kasir yang aktif.',
          ),
        ),
      );
      return;
    }

    final VoidReasonResult? result = await showVoidReasonSheet(
      context,
      title: 'Batalkan transaksi',
      description:
          'Bahan baku akan dikembalikan ke inventori saat data tersinkron. '
          'Pastikan uang sudah dikembalikan kepada pelanggan.',
      valueMinor: widget.entry.totalMinor,
      requiresAuth: decision.requiresAuth,
      submitLabel: 'Ya, batalkan transaksi',
    );

    if (result == null || !mounted) return;

    setState(() => _busy = true);
    await context.read<HistoryCubit>().voidTransaction(
          id: widget.entry.id,
          shiftId: shift.shift.id,
          staffId: auth.session.staffId,
          reasonCode: result.reasonCode,
          reasonNotes: result.reasonNotes,
          cashierName: auth.session.name,
          // Void masuk antrean; picu sinkronisasi agar stok segera dipulihkan.
          // Pembatalan memakai pemicunya sendiri agar `syncLog` mencatat
          // alasan yang paling layak ditelusuri auditor ([11 §M12.2]).
          onVoided: () async => getIt<SyncTriggers>().onVoidSaved(),
        );

    if (mounted) Navigator.of(context).pop();
  }

  void _showBlocked(CancellationDecision decision) {
    final String message = switch (decision.kind) {
      CancellationKind.returnTransaction =>
        'Struk transaksi ini sudah tercetak — gunakan alur Retur.',
      CancellationKind.forbidden =>
        decision.reason?.message ?? 'Pembatalan tidak dapat diproses.',
      CancellationKind.voidTransaction => '',
    };

    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppBar(title: const Text('Batalkan Transaksi')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(Gap.xl),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Container(
                  padding: const EdgeInsets.all(Gap.lg),
                  decoration: BoxDecoration(
                    color: t.surface,
                    borderRadius: BorderRadius.circular(Radii.lg),
                    border: Border.all(color: t.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'No. ${widget.entry.shortId}',
                        style: PosText.xsMono.copyWith(color: t.fgMuted),
                      ),
                      const SizedBox(height: Gap.sm),
                      for (final HistoryLine l in widget.entry.lines)
                        Padding(
                          padding: const EdgeInsets.only(bottom: Gap.xs),
                          child: Row(
                            children: <Widget>[
                              Expanded(
                                child: Text(
                                  '${l.quantity}× ${l.productName}',
                                  style: PosText.sm,
                                ),
                              ),
                              MoneyText(l.lineTotalMinor, size: MoneySize.sm),
                            ],
                          ),
                        ),
                      const Divider(height: Gap.lg),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: <Widget>[
                          Text('TOTAL', style: PosText.sm),
                          MoneyText(
                            widget.entry.totalMinor,
                            size: MoneySize.lg,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: Gap.xl),
                if (_decision.isReturn)
                  // Butir 15 dinyatakan APA ADANYA, bukan dengan menyembunyikan
                  // tombolnya diam-diam. Kasir yang tidak tahu mengapa
                  // tombolnya hilang akan mencari jalan lain.
                  Container(
                    padding: const EdgeInsets.all(Gap.lg),
                    decoration: BoxDecoration(
                      color: t.warningSubtle,
                      borderRadius: BorderRadius.circular(Radii.lg),
                    ),
                    child: Text(
                      'Struk transaksi ini SUDAH tercetak dan sudah berpindah '
                      'ke pelanggan. Mengubah transaksi aslinya berarti '
                      'menerbitkan versi kedua yang bertentangan dengan kertas '
                      'di tangan mereka. Gunakan alur Retur.',
                      style: PosText.sm,
                    ),
                  )
                else if (_decision.isForbidden)
                  Container(
                    padding: const EdgeInsets.all(Gap.lg),
                    decoration: BoxDecoration(
                      color: t.dangerSubtle,
                      borderRadius: BorderRadius.circular(Radii.lg),
                    ),
                    child: Text(
                      _decision.reason?.message ??
                          'Pembatalan tidak dapat diproses.',
                      style: PosText.sm,
                    ),
                  )
                else
                  Text(
                    'Alasan pembatalan dipilih pada langkah berikutnya, dan '
                    'terlihat oleh pemilik pada laporan.',
                    style: PosText.sm.copyWith(color: t.fgMuted),
                  ),

                const SizedBox(height: Gap.xxl),
                TouchButton(
                  label: 'Batalkan Transaksi',
                  icon: Icons.block,
                  variant: TouchVariant.danger,
                  isLoading: _busy,
                  onPressed: _decision.isVoid && !_busy ? _submit : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
