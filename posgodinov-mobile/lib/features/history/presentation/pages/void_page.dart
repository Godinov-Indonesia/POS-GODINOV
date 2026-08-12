import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/sync/sync_triggers.dart';
import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';
import 'package:posgodinov_mobile/features/history/presentation/cubit/history_cubit.dart';
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
/// Dua lapis perlindungan: `cancel_notes` **wajib**, dan konfirmasi kedua
/// sebelum eksekusi.
class VoidPage extends StatefulWidget {
  const VoidPage({super.key, required this.entry});

  final HistoryEntry entry;

  @override
  State<VoidPage> createState() => _VoidPageState();
}

class _VoidPageState extends State<VoidPage> {
  final TextEditingController _notes = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  bool get _canSubmit => _notes.text.trim().length >= 4 && !_busy;

  Future<void> _submit() async {
    final bool? yakin = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: Text('Batalkan transaksi ini?', style: PosText.buttonLg),
        content: Text(
          'Bahan baku akan dikembalikan ke inventori saat data tersinkron. '
          'Pembatalan tidak dapat diurungkan.',
          style: PosText.base,
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Tidak jadi'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: ctx.tokens.danger,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Ya, batalkan'),
          ),
        ],
      ),
    );

    if (yakin != true || !mounted) return;

    setState(() => _busy = true);
    await context.read<HistoryCubit>().voidTransaction(
          id: widget.entry.id,
          cancelNotes: _notes.text,
          // Void masuk antrean; picu sinkronisasi agar stok segera dipulihkan.
          onVoided: () async => getIt<SyncTriggers>().onTransactionSaved(),
        );

    if (mounted) Navigator.of(context).pop();
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
                Text(
                  'Alasan pembatalan (wajib)',
                  style: PosText.sm.copyWith(color: t.fgMuted),
                ),
                const SizedBox(height: Gap.xs),
                TextField(
                  controller: _notes,
                  enabled: !_busy,
                  autofocus: true,
                  maxLines: 3,
                  onChanged: (_) => setState(() {}),
                  style: PosText.base,
                  decoration: const InputDecoration(
                    hintText: 'Contoh: pelanggan membatalkan pesanan',
                  ),
                ),
                const SizedBox(height: Gap.xs),
                Text(
                  // Pemilik yang melihat transaksi batal di dashboard berhak
                  // tahu alasannya.
                  'Alasan ini terlihat oleh pemilik pada laporan.',
                  style: PosText.xs.copyWith(color: t.fgSubtle),
                ),

                const SizedBox(height: Gap.xxl),
                TouchButton(
                  label: 'Batalkan Transaksi',
                  icon: Icons.block,
                  variant: TouchVariant.danger,
                  isLoading: _busy,
                  onPressed: _canSubmit ? _submit : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
