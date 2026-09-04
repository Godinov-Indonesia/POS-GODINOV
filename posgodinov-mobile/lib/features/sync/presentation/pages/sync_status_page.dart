import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/features/sync/presentation/cubit/sync_cubit.dart';
import 'package:posgodinov_mobile/features/sync/presentation/widgets/sync_badge_chip.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-13 — Status Sinkronisasi.**
///
/// Satu-satunya layar tempat kasir dapat melihat apa yang **belum** sampai ke
/// server, dan satu-satunya tempat batasan sistem dinyatakan apa adanya.
class SyncStatusPage extends StatelessWidget {
  const SyncStatusPage({super.key});

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      appBar: AppBar(title: const Text('Status Sinkronisasi')),
      body: BlocBuilder<SyncCubit, SyncState>(
        builder: (BuildContext context, SyncState state) {
          return ListView(
            padding: const EdgeInsets.all(Gap.xl),
            children: <Widget>[
              Align(
                alignment: Alignment.centerLeft,
                child: SyncBadgeChip(state: state),
              ),
              const SizedBox(height: Gap.lg),

              _QueueCard(state: state),

              // ── TIGA KELOMPOK ANTREAN ([11 §M12.3]) ────────────────────
              //
              // Pembagiannya bukan kosmetik: hanya kelompok ketiga yang
              // menuntut manusia. Menyatukan ketiganya membuat satu baris
              // cacat permanen tersembunyi di antara seratus baris yang akan
              // beres sendiri.
              const SizedBox(height: Gap.lg),
              _QueueGroups(state: state),

              // Kelompok "Butuh tindakan" dijelaskan LEBIH DULU daripada
              // kegagalan biasa: hanya inilah yang tidak akan beres sendiri.
              if (state.needsAttention) ...<Widget>[
                const SizedBox(height: Gap.lg),
                const _Notice(
                  tone: _Tone.danger,
                  icon: Icons.report_problem_outlined,
                  title: 'Baris ini tidak akan terkirim sendiri',
                  body: 'Server menolaknya dengan alasan yang TIDAK BERUBAH '
                      'berapa kali pun dikirim ulang — misalnya pembayaran '
                      'kartu tanpa nomor trace, atau retur yang melebihi '
                      'jumlah aslinya. Baris ini sudah dikeluarkan dari '
                      'antrean supaya tidak menahan baris di belakangnya. '
                      'Datanya TETAP TERSIMPAN di perangkat; laporkan ke '
                      'supervisor.',
                ),
              ],

              if (state.hasError) ...<Widget>[
                const SizedBox(height: Gap.lg),
                _Notice(
                  tone: _Tone.danger,
                  icon: Icons.error_outline,
                  title: 'Sebagian data belum tersimpan di server',
                  body: state.lastError!,
                ),
              ],

              if (state.hasShiftMismatch) ...<Widget>[
                const SizedBox(height: Gap.lg),
                const _Notice(
                  tone: _Tone.danger,
                  icon: Icons.link_off,
                  title: 'Shift induk diragukan',
                  // Backend tidak melaporkan shift mana yang gagal ([03 §2.3]),
                  // jadi peringatannya bersifat agregat.
                  body: 'Server tidak mengonfirmasi seluruh shift yang '
                      'dikirim. Selama itu belum pasti, transaksi pada shift '
                      'tersebut sengaja TIDAK ditandai tersinkron dan akan '
                      'dikirim ulang. Tidak ada data yang hilang.',
                ),
              ],

              if (state.hasClockSkew) ...<Widget>[
                const SizedBox(height: Gap.lg),
                _Notice(
                  tone: _Tone.warning,
                  icon: Icons.schedule_outlined,
                  title: 'Jam perangkat melenceng',
                  body: state.skew?.warningLabel ??
                      'Selisih jam perangkat terhadap server melebihi batas.',
                ),
              ],

              const SizedBox(height: Gap.xl),
              TouchButton(
                label: 'Sinkronkan Sekarang',
                icon: Icons.sync,
                isLoading: state.isSyncing,
                // Tombol ini SELALU tersedia dan mengabaikan backoff.
                onPressed: state.isSyncing
                    ? null
                    : () => context.read<SyncCubit>().syncNow(),
              ),

              const SizedBox(height: Gap.xxl),
              const _Limitations(),
            ],
          );
        },
      ),
      backgroundColor: t.bg,
    );
  }
}

/// Tiga kelompok antrean, berdampingan ([11 §M12.3]).
class _QueueGroups extends StatelessWidget {
  const _QueueGroups({required this.state});

  final SyncState state;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Expanded(
          child: _GroupTile(
            label: 'Antre',
            value: state.waitingCount,
            hint: 'Menunggu giliran kirim.',
            accent: t.fgMuted,
            active: state.waitingCount > 0,
          ),
        ),
        const SizedBox(width: Gap.sm),
        Expanded(
          child: _GroupTile(
            label: 'Gagal',
            value: state.failedCount,
            hint: 'Akan diulang otomatis.',
            accent: t.warningText,
            active: state.failedCount > 0,
          ),
        ),
        const SizedBox(width: Gap.sm),
        Expanded(
          child: _GroupTile(
            label: 'Butuh tindakan',
            value: state.quarantinedCount,
            hint: 'Ditolak permanen.',
            // Token `dangerText` TIDAK ADA di GodinovTokens — hanya `danger`,
            // `dangerHover`, dan `dangerSubtle`. Memakai nama yang tidak ada
            // baru ketahuan saat kompilasi di mesin yang punya Flutter SDK.
            accent: t.danger,
            active: state.quarantinedCount > 0,
          ),
        ),
      ],
    );
  }
}

class _GroupTile extends StatelessWidget {
  const _GroupTile({
    required this.label,
    required this.value,
    required this.hint,
    required this.accent,
    required this.active,
  });

  final String label;
  final int value;
  final String hint;
  final Color accent;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        // Warna SAJA tidak pernah menjadi satu-satunya penanda ([06 §1.5]) —
        // label dan `hint` membawa arti yang sama tanpa bergantung warna.
        border: Border.all(color: active ? accent : t.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            label.toUpperCase(),
            style: PosText.sm.copyWith(color: t.fgMuted, letterSpacing: 0.4),
          ),
          const SizedBox(height: Gap.xs),
          Text(
            '$value',
            style: PosText.moneyXl.copyWith(
              color: active ? accent : t.fgSubtle,
            ),
          ),
          const SizedBox(height: Gap.xs),
          Text(hint, style: PosText.sm.copyWith(color: t.fgSubtle)),
        ],
      ),
    );
  }
}

class _QueueCard extends StatelessWidget {
  const _QueueCard({required this.state});

  final SyncState state;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
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
            'ANTREAN',
            style: PosText.sm.copyWith(color: t.fgMuted, letterSpacing: 0.6),
          ),
          const SizedBox(height: Gap.sm),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: <Widget>[
              Text(
                '${state.pendingCount}',
                style: PosText.moneyXl.copyWith(
                  color: state.pendingCount > 0 ? t.warningText : t.successText,
                ),
              ),
              const SizedBox(width: Gap.sm),
              Text(
                'transaksi menunggu dikirim',
                style: PosText.base.copyWith(color: t.fgMuted),
              ),
            ],
          ),
          const SizedBox(height: Gap.sm),
          Text(
            // Menegaskan sifat offline-first: antrean bukan kondisi darurat.
            state.pendingCount == 0
                ? 'Semua penjualan sudah tersimpan di server.'
                : 'Data tersimpan aman di perangkat. Tidak ada yang hilang '
                    'selama antrean belum kosong.',
            style: PosText.sm.copyWith(color: t.fgSubtle),
          ),
          if (state.lastSuccessAt != null) ...<Widget>[
            const SizedBox(height: Gap.sm),
            Text(
              'Sinkronisasi terakhir berhasil '
              '${_formatTime(state.lastSuccessAt!)}',
              style: PosText.xsMono.copyWith(color: t.fgSubtle),
            ),
          ],
        ],
      ),
    );
  }

  String _formatTime(DateTime t) {
    final DateTime local = t.toLocal();
    final String hh = local.hour.toString().padLeft(2, '0');
    final String mm = local.minute.toString().padLeft(2, '0');
    return '$hh:$mm';
  }
}

/// Batasan sistem yang **wajib** dinyatakan, bukan disembunyikan ([09 §9.5]).
class _Limitations extends StatelessWidget {
  const _Limitations();

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          'YANG PERLU DIKETAHUI',
          style: PosText.sm.copyWith(color: t.fgMuted, letterSpacing: 0.6),
        ),
        const SizedBox(height: Gap.sm),
        const _Bullet(
          // Batasan [05 §1.6.6] hilang sejak M8 — tetapi hanya bila sistem
          // mengizinkan proses latar berjalan.
          text: 'Sinkronisasi juga berjalan saat aplikasi tertutup, sekitar '
              'tiap 15 menit. Bila penghemat baterai aktif, sistem dapat '
              'menghentikannya — periksa Pengaturan → Sinkronisasi Latar.',
        ),
        const _Bullet(
          text: 'Percobaan ulang tidak pernah menyerah. Data keuangan tidak '
              'pernah dibuang, sebanyak apa pun kegagalannya.',
        ),
        const _Bullet(
          text: 'Laporan pemilik dikelompokkan berdasarkan waktu data tiba di '
              'server, bukan waktu transaksi di kasir. Penjualan offline yang '
              'baru tersinkron muncul pada tanggal sinkronisasi.',
        ),
      ],
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text('•  ', style: PosText.sm.copyWith(color: context.tokens.fgMuted)),
          Expanded(
            child: Text(
              text,
              style: PosText.sm.copyWith(color: context.tokens.fgMuted),
            ),
          ),
        ],
      ),
    );
  }
}

enum _Tone { warning, danger }

class _Notice extends StatelessWidget {
  const _Notice({
    required this.tone,
    required this.icon,
    required this.title,
    required this.body,
  });

  final _Tone tone;
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final (Color bg, Color line, Color fg) = switch (tone) {
      _Tone.warning => (t.warningSubtle, t.warning, t.warningText),
      _Tone.danger => (t.dangerSubtle, t.danger, t.danger),
    };

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, color: fg),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(title, style: PosText.base.copyWith(color: t.fg)),
                const SizedBox(height: Gap.xs),
                Text(body, style: PosText.sm.copyWith(color: t.fgMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
