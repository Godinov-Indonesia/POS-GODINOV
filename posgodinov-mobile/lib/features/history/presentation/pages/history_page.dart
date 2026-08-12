import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';
import 'package:posgodinov_mobile/features/history/presentation/cubit/history_cubit.dart';
import 'package:posgodinov_mobile/features/history/presentation/pages/void_page.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';

/// **P-09 — Riwayat Transaksi.**
///
/// Dua tab dengan sifat yang sangat berbeda: "Hari Ini" dibaca dari SQLite dan
/// **selalu tersedia**, sedangkan "Sebelumnya" bergantung pada jaringan dan
/// dibatasi keras 50 baris oleh backend ([03 §2.4]).
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
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<HistoryCubit>().observe(widget.shiftId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: context.tokens.bg,
        appBar: AppBar(
          title: const Text('Riwayat Transaksi'),
          bottom: TabBar(
            onTap: (int i) {
              if (i == 1) context.read<HistoryCubit>().loadRemote();
            },
            tabs: const <Widget>[
              Tab(text: 'Hari Ini'),
              Tab(text: 'Sebelumnya'),
            ],
          ),
        ),
        body: BlocBuilder<HistoryCubit, HistoryState>(
          builder: (BuildContext context, HistoryState state) {
            return TabBarView(
              children: <Widget>[
                _LocalTab(state: state, onReprint: widget.onReprint),
                _RemoteTab(state: state),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _LocalTab extends StatelessWidget {
  const _LocalTab({required this.state, required this.onReprint});

  final HistoryState state;
  final void Function(HistoryEntry)? onReprint;

  @override
  Widget build(BuildContext context) {
    if (state.local.isEmpty) {
      return const _Empty(message: 'Belum ada transaksi pada shift ini.');
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

class _RemoteTab extends StatelessWidget {
  const _RemoteTab({required this.state});

  final HistoryState state;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Column(
      children: <Widget>[
        // Batas server dinyatakan APA ADANYA, bukan disembunyikan ([09 §9.5]).
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(Gap.md),
          color: t.warningSubtle,
          child: Row(
            children: <Widget>[
              Icon(Icons.info_outline, size: 18, color: t.warningText),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: Text(
                  'Menampilkan 50 transaksi terakhir dari server. Tidak ada '
                  'filter tanggal maupun kasir.',
                  style: PosText.sm.copyWith(color: t.fg),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: switch (state) {
            HistoryState(loadingRemote: true) =>
              const Center(child: CircularProgressIndicator()),
            HistoryState(remoteError: final String e) when e.isNotEmpty =>
              _Empty(message: e, icon: Icons.cloud_off_outlined),
            HistoryState(remote: final List<HistoryEntry> items)
                when items.isEmpty =>
              const _Empty(message: 'Tidak ada transaksi di server.'),
            _ => ListView.separated(
                padding: const EdgeInsets.all(Gap.lg),
                itemCount: state.remote.length,
                separatorBuilder: (_, __) => const SizedBox(height: Gap.sm),
                itemBuilder: (BuildContext context, int i) =>
                    _EntryTile(entry: state.remote[i], onReprint: null),
              ),
          },
        ),
      ],
    );
  }
}

class _EntryTile extends StatelessWidget {
  const _EntryTile({required this.entry, required this.onReprint});

  final HistoryEntry entry;
  final void Function(HistoryEntry)? onReprint;

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
                  label: Text('Cetak Ulang', style: PosText.sm),
                  style: TextButton.styleFrom(
                    minimumSize: const Size(Touch.standard, Touch.standard),
                  ),
                ),
              // Void adalah aksi destruktif: layar terpisah, bukan aksi inline
              // ([06 §2.2]).
              if (entry.canVoid) ...<Widget>[
                const SizedBox(width: Gap.destructive),
                TextButton.icon(
                  onPressed: () => Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (_) => BlocProvider<HistoryCubit>.value(
                        value: context.read<HistoryCubit>(),
                        child: VoidPage(entry: entry),
                      ),
                    ),
                  ),
                  icon: Icon(Icons.block, size: 18, color: t.danger),
                  label: Text(
                    'Batalkan',
                    style: PosText.sm.copyWith(color: t.danger),
                  ),
                  style: TextButton.styleFrom(
                    minimumSize: const Size(Touch.standard, Touch.standard),
                  ),
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
  const _Empty({required this.message, this.icon = Icons.receipt_long_outlined});

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
