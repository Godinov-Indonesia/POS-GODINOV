import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/tender_draft.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-06c — Bayar Terpisah**, butir 8 ([11 §M17.2]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// SPLIT ADALAH DAFTAR TENDER, BUKAN METODE PEMBAYARAN
/// ═══════════════════════════════════════════════════════════════════════════
///
/// `SPLIT` tidak pernah muncul sebagai pilihan metode di layar mana pun — ia
/// adalah RINGKASAN atas dua tender atau lebih. Menaruhnya di daftar metode
/// berarti kasir dapat memilihnya lalu tidak ada satu pun baris tender yang
/// lahir untuk menjelaskannya, dan rekonsiliasi EDC kehilangan seluruh jejaknya.
///
/// ⚠️ Transaksi hanya dapat diselesaikan ketika `Σ tenders == total`. Kelebihan
/// maupun kekurangan sama-sama ditolak: kelebihan berarti kembalian yang tidak
/// tercatat, kekurangan berarti tagihan yang tidak tertutup.
class PaymentSplitPage extends StatelessWidget {
  const PaymentSplitPage({
    super.key,
    required this.totalMinor,
    required this.tenders,
    required this.onRemove,
    required this.onAdd,
    required this.onSubmit,
  });

  final int totalMinor;
  final List<TenderDraft> tenders;
  final void Function(int index) onRemove;
  final VoidCallback onAdd;
  final Future<void> Function() onSubmit;

  int get _tendered =>
      tenders.fold(0, (int sum, TenderDraft t) => sum + t.amountMinor);

  int get _remaining => totalMinor - _tendered;

  bool get _balanced => _remaining == 0 && tenders.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppBar(title: const Text('Bayar Terpisah')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(Gap.xl),
          children: <Widget>[
            Container(
              padding: const EdgeInsets.all(Gap.lg),
              decoration: BoxDecoration(
                color: t.surface,
                borderRadius: BorderRadius.circular(Radii.lg),
                border: Border.all(color: t.border),
              ),
              child: Column(
                children: <Widget>[
                  _SummaryRow(label: 'Total transaksi', minor: totalMinor),
                  const SizedBox(height: Gap.xs),
                  _SummaryRow(
                    label: 'Sudah dibayar',
                    minor: _tendered,
                    tone: MoneyTone.muted,
                  ),
                  const Divider(height: Gap.xl),
                  _SummaryRow(
                    label: 'Sisa',
                    minor: _remaining,
                    size: MoneySize.xxl,
                    tone: _remaining == 0
                        ? MoneyTone.success
                        : _remaining < 0
                            ? MoneyTone.danger
                            : MoneyTone.normal,
                  ),
                ],
              ),
            ),

            if (_remaining < 0) ...<Widget>[
              const SizedBox(height: Gap.sm),
              Text(
                '⚠ Pembayaran melebihi total. Hapus salah satu tender lalu '
                'masukkan nominal yang benar.',
                style: PosText.sm.copyWith(color: t.danger),
              ),
            ],

            const SizedBox(height: Gap.xl),
            if (tenders.isEmpty)
              Text(
                'Belum ada pembayaran dicatat. Tambahkan tender satu per satu — '
                'transaksi selesai ketika seluruh sisa tertutup.',
                style: PosText.sm.copyWith(color: t.fgMuted),
              )
            else
              for (int i = 0; i < tenders.length; i++) ...<Widget>[
                _TenderTile(
                  index: i,
                  tender: tenders[i],
                  onRemove: () => onRemove(i),
                ),
                const SizedBox(height: Gap.sm),
              ],

            if (_remaining > 0) ...<Widget>[
              const SizedBox(height: Gap.md),
              TouchButton(
                label: 'Tambah Pembayaran',
                icon: Icons.add,
                variant: TouchVariant.secondary,
                onPressed: onAdd,
              ),
            ],

            if (tenders.length == 1) ...<Widget>[
              const SizedBox(height: Gap.md),
              Text(
                'Satu tender saja tidak dicatat sebagai split — transaksi akan '
                'tersimpan dengan metode ${tenders.first.method.label}.',
                style: PosText.sm.copyWith(color: t.fgMuted),
              ),
            ],

            const SizedBox(height: Gap.xl),
            TouchButton(
              label: 'SELESAIKAN TRANSAKSI',
              variant: TouchVariant.success,
              height: Touch.critical,
              onPressed: _balanced ? onSubmit : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.minor,
    this.size = MoneySize.lg,
    this.tone = MoneyTone.normal,
  });

  final String label;
  final int minor;
  final MoneySize size;
  final MoneyTone tone;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(label, style: PosText.base.copyWith(color: context.tokens.fgMuted)),
        MoneyText(minor, size: size, tone: tone),
      ],
    );
  }
}

class _TenderTile extends StatelessWidget {
  const _TenderTile({
    required this.index,
    required this.tender,
    required this.onRemove,
  });

  final int index;
  final TenderDraft tender;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: t.border),
      ),
      child: Row(
        children: <Widget>[
          Text('${index + 1}', style: PosText.sm.copyWith(color: t.fgMuted)),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(tender.method.label, style: PosText.base),
                if (tender.traceNumber != null)
                  // Trace number ditampilkan supaya kasir dapat mencocokkannya
                  // dengan struk EDC di tangannya SEBELUM menyelesaikan
                  // transaksi — bukan berjam-jam kemudian saat tutup shift.
                  Text(
                    'Trace ${tender.traceNumber} · ····${tender.cardLast4}',
                    style: PosText.xs.copyWith(color: t.fgMuted),
                  ),
              ],
            ),
          ),
          MoneyText(tender.amountMinor, size: MoneySize.md),
          IconButton(
            onPressed: onRemove,
            icon: Icon(Icons.delete_outline, color: t.danger),
            tooltip: 'Hapus tender ${index + 1}',
          ),
        ],
      ),
    );
  }
}
