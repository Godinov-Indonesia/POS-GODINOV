import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';
import 'package:posgodinov_mobile/features/history/presentation/cubit/history_cubit.dart';
import 'package:posgodinov_mobile/features/history/presentation/pages/return_page.dart';
import 'package:posgodinov_mobile/features/history/presentation/pages/void_page.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-09 — Riwayat Transaksi**, butir 16 ([11 §M17.3]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// HANYA SHIFT BERJALAN. TAB "SEBELUMNYA" DIHAPUS.
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Tab "Sebelumnya" yang menarik 50 transaksi terakhir dari server **dihapus
/// dari kode**, bukan disembunyikan. Ia menampilkan transaksi kasir lain kepada
/// kasir yang sedang bertugas — dan layar ini adalah pintu masuk ke Void dan
/// Retur. Kasir sore yang dapat melihat transaksi shift pagi dapat
/// membatalkannya, dengan selisih kas jatuh ke orang yang sudah pulang.
///
/// Satu-satunya jalan menuju transaksi lampau adalah **kode struk**: kasir
/// harus MENGETAHUI kode yang dicarinya, bukan menelusuri daftar. Hasilnya satu
/// transaksi — tidak pernah daftar.
class HistoryPage extends StatefulWidget {
  const HistoryPage({
    super.key,
    required this.shiftId,
    this.onReprint,
  });

  final String shiftId;

  /// Mencetak ulang struk transaksi lokal.
  final void Function(HistoryEntry)? onReprint;

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  final TextEditingController _code = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<HistoryCubit>().observe(widget.shiftId);
    });
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.tokens.bg,
      // Tidak ada `TabBar` lagi — lihat catatan pada kepala kelas.
      appBar: AppBar(
        title: Text(
          // Judul mengikuti flag: menyebut "Shift Ini" pada outlet yang
          // isolasinya dimatikan akan berbohong tentang apa yang ditampilkan.
          context.select<HistoryCubit, bool>((HistoryCubit c) => c.state.scopeIsolated)
              ? 'Riwayat Shift Ini'
              : 'Riwayat Transaksi',
        ),
      ),
      body: BlocBuilder<HistoryCubit, HistoryState>(
        builder: (BuildContext context, HistoryState state) {
          return Column(
            children: <Widget>[
              if (!state.scopeIsolated) const _ScopeDisabledBanner(),
              _CodeSearch(controller: _code, state: state),
              Expanded(
                child: _ShiftList(state: state, onReprint: widget.onReprint),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Spanduk saat `history_scope: 'ALL'` — **feature flag** ([11 §M18.2]).
///
/// Menyatakan keadaan apa adanya. Kasir berhak tahu bahwa ia sedang melihat
/// transaksi rekannya, dan pemilik berhak melihat bahwa outletnya berjalan
/// dengan pengendalian yang dimatikan.
class _ScopeDisabledBanner extends StatelessWidget {
  const _ScopeDisabledBanner();

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(Gap.md),
      color: t.warningSubtle,
      child: Row(
        children: <Widget>[
          Icon(Icons.visibility_outlined, size: 18, color: t.warningText),
          const SizedBox(width: Gap.sm),
          Expanded(
            child: Text(
              'Isolasi riwayat sedang dimatikan pemilik (history_scope: ALL). '
              'Daftar ini memuat transaksi dari seluruh shift.',
              style: PosText.sm.copyWith(color: t.fg),
            ),
          ),
        ],
      ),
    );
  }
}

/// Kolom pencarian kode struk — satu-satunya jalan ke transaksi lampau.
class _CodeSearch extends StatelessWidget {
  const _CodeSearch({required this.controller, required this.state});

  final TextEditingController controller;
  final HistoryState state;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final HistoryCubit cubit = context.read<HistoryCubit>();

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      color: t.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: TextField(
                  controller: controller,
                  textCapitalization: TextCapitalization.characters,
                  onChanged: (_) {
                    if (state.searchAttempted) cubit.clearSearch();
                  },
                  onSubmitted: cubit.searchByCode,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'Kode struk atau UUID transaksi',
                  ),
                ),
              ),
              const SizedBox(width: Gap.sm),
              SizedBox(
                width: 96,
                child: TouchButton(
                  label: state.searching ? '…' : 'Cari',
                  variant: TouchVariant.secondary,
                  onPressed: state.searching
                      ? null
                      : () => cubit.searchByCode(controller.text),
                ),
              ),
            ],
          ),

          if (state.searchError != null) ...<Widget>[
            const SizedBox(height: Gap.sm),
            Text(
              '⚠ ${state.searchError}',
              style: PosText.sm.copyWith(color: t.danger),
            ),
          ],

          if (state.searchResult != null) ...<Widget>[
            const SizedBox(height: Gap.md),
            Text(
              'HASIL PENCARIAN',
              style: PosText.xs.copyWith(color: t.fgMuted, letterSpacing: 0.6),
            ),
            const SizedBox(height: Gap.xs),
            // `fromLookup` menandai baris ini sebagai transaksi LUAR shift:
            // tombol Batalkan disembunyikan, Retur tetap ada (butir 15).
            _EntryTile(
              entry: state.searchResult!,
              onReprint: null,
              fromLookup: true,
            ),
          ],
        ],
      ),
    );
  }
}

/// Daftar transaksi shift berjalan.
class _ShiftList extends StatelessWidget {
  const _ShiftList({required this.state, required this.onReprint});

  final HistoryState state;
  final void Function(HistoryEntry)? onReprint;

  @override
  Widget build(BuildContext context) {
    if (state.local.isEmpty) {
      return _Empty(
        message: state.scopeIsolated
            ? 'Belum ada transaksi pada shift ini.\n'
                'Transaksi shift sebelumnya tidak ditampilkan — gunakan '
                'pencarian kode struk bila pelanggan membawa struk lama.'
            : 'Belum ada transaksi di perangkat ini.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(Gap.lg),
      itemCount: state.local.length,
      separatorBuilder: (_, __) => const SizedBox(height: Gap.sm),
      itemBuilder: (BuildContext context, int i) => _EntryTile(
        entry: state.local[i],
        onReprint: onReprint,
      ),
    );
  }
}

class _EntryTile extends StatelessWidget {
  const _EntryTile({
    required this.entry,
    required this.onReprint,
    this.fromLookup = false,
  });

  final HistoryEntry entry;
  final void Function(HistoryEntry)? onReprint;

  /// `true` bila baris ini adalah HASIL PENCARIAN, bukan bagian shift berjalan
  /// ([11 §M17.3]).
  ///
  /// Transaksi hasil pencarian berasal dari shift lain: struknya sudah tercetak
  /// dan berpindah tangan ke pelanggan. Void disembunyikan; Retur tetap ada —
  /// lihat catatan pada tombolnya.
  final bool fromLookup;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(
          color: entry.isCancelled ? t.danger : t.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Text(entry.shortId, style: PosText.xsMono.copyWith(color: t.fgMuted)),
              const SizedBox(width: Gap.sm),
              Text(
                _time(entry.clientCreatedAt),
                style: PosText.xsMono.copyWith(color: t.fgMuted),
              ),
              const Spacer(),
              if (entry.isCancelled)
                _Badge(label: 'BATAL', color: t.danger, icon: Icons.block)
              else if (!entry.synced)
                _Badge(
                  label: 'Antre',
                  color: t.warningText,
                  icon: Icons.schedule,
                )
              else
                _Badge(
                  label: 'Tersinkron',
                  color: t.successText,
                  icon: Icons.cloud_done_outlined,
                ),
            ],
          ),
          const SizedBox(height: Gap.sm),
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  entry.lines
                      .map((HistoryLine l) => '${l.quantity}× ${l.productName}')
                      .join(', '),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: PosText.sm,
                ),
              ),
              MoneyText(
                entry.totalMinor,
                size: MoneySize.md,
                tone: entry.isCancelled ? MoneyTone.muted : MoneyTone.normal,
              ),
            ],
          ),
          if (entry.cancelNotes.isNotEmpty) ...<Widget>[
            const SizedBox(height: Gap.xs),
            Text(
              'Alasan batal: ${entry.cancelNotes}',
              style: PosText.xs.copyWith(color: t.danger),
            ),
          ],
          const SizedBox(height: Gap.sm),
          Row(
            children: <Widget>[
              Text(
                entry.paymentMethod.label,
                style: PosText.xs.copyWith(color: t.fgMuted),
              ),
              const Spacer(),
              if (entry.isLocal && onReprint != null)
                TextButton.icon(
                  onPressed: () => onReprint!(entry),
                  icon: const Icon(Icons.print_outlined, size: 18),
                  label: const Text('Cetak Ulang', style: PosText.sm),
                  style: TextButton.styleFrom(
                    minimumSize: const Size(Touch.standard, Touch.standard),
                  ),
                ),
              // Pembatalan adalah aksi destruktif: layar terpisah, bukan aksi
              // inline ([06 §2.2]).
              //
              // LABEL DAN TUJUANNYA mengikuti keputusan ([11 §M13.1]), bukan
              // tebakan layar ini. Transaksi yang struknya sudah tercetak
              // mengarah ke Retur, dan tidak ada jalan dari sini menuju Void
              // untuknya — itulah butir 15 dalam bentuk yang dilihat kasir.
              //
              // ⛔ Hasil PENCARIAN tidak pernah menawarkan Void, hanya Retur —
              // butir 15 ([11 §2.1]). Transaksi dari shift lain sudah
              // menerbitkan kertas yang berpindah tangan ke pelanggan;
              // membatalkannya berarti menerbitkan realitas kedua yang
              // bertentangan dengan struk di tangan pelanggan.
              if (entry.canCancel) ...<Widget>[
                const SizedBox(width: Gap.destructive),
                Builder(
                  builder: (BuildContext ctx) {
                    // `fromLookup` memaksa jalur Retur tanpa memandang
                    // `receiptPrintedAt`: transaksi shift lain yang struknya
                    // entah bagaimana belum tertandai tetap tidak boleh
                    // di-void dari sini.
                    final bool isReturn =
                        fromLookup || entry.receiptPrintedAt != null;
                    return TextButton.icon(
                      onPressed: () => Navigator.of(ctx).push<void>(
                        MaterialPageRoute<void>(
                          builder: (_) => BlocProvider<HistoryCubit>.value(
                            value: ctx.read<HistoryCubit>(),
                            child: isReturn
                                ? ReturnPage(entry: entry)
                                : VoidPage(entry: entry),
                          ),
                        ),
                      ),
                      icon: Icon(
                        isReturn
                            ? Icons.assignment_return_outlined
                            : Icons.block,
                        size: 18,
                        color: t.danger,
                      ),
                      label: Text(
                        isReturn ? 'Retur' : 'Batalkan',
                        style: PosText.sm.copyWith(color: t.danger),
                      ),
                      style: TextButton.styleFrom(
                        minimumSize: const Size(Touch.standard, Touch.standard),
                      ),
                    );
                  },
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  String _time(DateTime utc) {
    final DateTime t = utc.toLocal();
    return '${t.hour.toString().padLeft(2, '0')}:'
        '${t.minute.toString().padLeft(2, '0')}';
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color, required this.icon});

  final String label;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    // Penanda kedua selain warna ([06 §1.5]).
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(icon, size: 14, color: color),
        const SizedBox(width: Gap.xs),
        Text(label, style: PosText.xs.copyWith(color: color)),
      ],
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.message}) : icon = Icons.receipt_long_outlined;

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Gap.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 48, color: context.tokens.fgSubtle),
            const SizedBox(height: Gap.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: PosText.base.copyWith(color: context.tokens.fgMuted),
            ),
          ],
        ),
      ),
    );
  }
}
