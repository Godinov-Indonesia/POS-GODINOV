import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/features/device/domain/entities/master_snapshot.dart';
import 'package:posgodinov_mobile/features/device/presentation/cubit/master_sync_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-02 — Sinkronisasi Master Data.**
///
/// Menarik staff, kategori, dan produk untuk operasi offline ([03 §2.2]).
/// Setelah layar ini selesai, perangkat dapat beroperasi penuh dalam mode
/// pesawat — itulah definisi selesai fase M3.
class MasterSyncPage extends StatefulWidget {
  const MasterSyncPage({super.key, this.onCompleted, this.autoStart = true});

  /// Dipanggil saat data siap dipakai, termasuk saat pengguna memilih
  /// melanjutkan dengan data lama.
  final VoidCallback? onCompleted;

  /// `false` bila layar dibuka manual dari Pengaturan (P-14).
  final bool autoStart;

  @override
  State<MasterSyncPage> createState() => _MasterSyncPageState();
}

class _MasterSyncPageState extends State<MasterSyncPage> {
  @override
  void initState() {
    super.initState();
    if (widget.autoStart) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.read<MasterSyncCubit>().sync();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      appBar: AppBar(title: const Text('Sinkronisasi Data')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Padding(
            padding: const EdgeInsets.all(Gap.xl),
            child: BlocConsumer<MasterSyncCubit, MasterSyncState>(
              listener: (BuildContext context, MasterSyncState state) {
                if (state is MasterSyncDone) widget.onCompleted?.call();
              },
              builder: (BuildContext context, MasterSyncState state) {
                return switch (state) {
                  MasterSyncIdle() => _Idle(
                      onStart: () => context.read<MasterSyncCubit>().sync(),
                    ),
                  MasterSyncDownloading() => const _Downloading(),
                  MasterSyncDone(snapshot: final MasterSnapshot s) =>
                    _Done(snapshot: s, onContinue: widget.onCompleted),
                  MasterSyncFailure(
                    message: final String m,
                    hasLocalData: final bool hasLocal,
                  ) =>
                    _FailureView(
                      message: m,
                      hasLocalData: hasLocal,
                      onRetry: () => context.read<MasterSyncCubit>().sync(),
                      onContinueOffline:
                          hasLocal ? widget.onCompleted : null,
                    ),
                };
              },
            ),
          ),
        ),
      ),
      backgroundColor: t.bg,
    );
  }
}

class _Idle extends StatelessWidget {
  const _Idle({required this.onStart});

  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          'Data outlet sudah tersedia di perangkat.',
          style: PosText.base.copyWith(color: context.tokens.fgMuted),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: Gap.xl),
        TouchButton(
          label: 'Tarik Ulang Data',
          icon: Icons.cloud_download_outlined,
          variant: TouchVariant.secondary,
          onPressed: onStart,
        ),
      ],
    );
  }
}

class _Downloading extends StatelessWidget {
  const _Downloading();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        const CircularProgressIndicator(),
        const SizedBox(height: Gap.xl),
        const Text('Mengunduh data outlet…', style: PosText.base),
        const SizedBox(height: Gap.sm),
        Text(
          // Endpoint tidak berpaginasi dan tidak inkremental ([03 §2.2]).
          'Seluruh katalog ditarik sekaligus. Pada outlet besar ini dapat '
          'memakan waktu.',
          textAlign: TextAlign.center,
          style: PosText.sm.copyWith(color: context.tokens.fgMuted),
        ),
      ],
    );
  }
}

class _Done extends StatelessWidget {
  const _Done({required this.snapshot, required this.onContinue});

  final MasterSnapshot snapshot;
  final VoidCallback? onContinue;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Icon(Icons.check_circle_outline, size: 56, color: t.success),
        const SizedBox(height: Gap.lg),
        const Text(
          'Data berhasil disinkronkan',
          textAlign: TextAlign.center,
          style: PosText.buttonLg,
        ),
        const SizedBox(height: Gap.xl),
        _CountRow(label: 'Kasir', value: snapshot.staffCount),
        _CountRow(label: 'Kategori', value: snapshot.categoryCount),
        _CountRow(label: 'Produk', value: snapshot.productCount),

        // Outlet tanpa staff tidak dapat dipakai berjualan: tidak ada pin_hash
        // untuk dibandingkan, sehingga kasir tidak akan bisa login sama sekali.
        if (snapshot.hasNoStaff) ...<Widget>[
          const SizedBox(height: Gap.lg),
          const _Notice(
            tone: _NoticeTone.danger,
            icon: Icons.person_off_outlined,
            message: 'Outlet ini belum memiliki kasir. Minta pemilik menambah '
                'staff lewat Dashboard, lalu tarik ulang data.',
          ),
        ] else if (snapshot.hasNoProducts) ...<Widget>[
          const SizedBox(height: Gap.lg),
          const _Notice(
            tone: _NoticeTone.warning,
            icon: Icons.inventory_2_outlined,
            message: 'Belum ada produk di outlet ini. Layar kasir akan tampil '
                'kosong sampai pemilik menambahkan produk.',
          ),
        ],

        const SizedBox(height: Gap.xl),
        TouchButton(
          label: 'Lanjutkan',
          onPressed: snapshot.hasNoStaff ? null : onContinue,
        ),
      ],
    );
  }
}

class _CountRow extends StatelessWidget {
  const _CountRow({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: Gap.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(label, style: PosText.base),
          Text(
            '$value',
            // Angka non-uang tetap monospace agar kolomnya sejajar ([06 §2.6]).
            style: PosText.moneyMd.copyWith(color: context.tokens.fg),
          ),
        ],
      ),
    );
  }
}

class _FailureView extends StatelessWidget {
  const _FailureView({
    required this.message,
    required this.hasLocalData,
    required this.onRetry,
    required this.onContinueOffline,
  });

  final String message;
  final bool hasLocalData;
  final VoidCallback onRetry;
  final VoidCallback? onContinueOffline;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _Notice(
          tone: _NoticeTone.danger,
          icon: Icons.cloud_off_outlined,
          message: message,
        ),
        const SizedBox(height: Gap.xl),
        TouchButton(
          label: 'Coba Lagi',
          icon: Icons.refresh,
          onPressed: onRetry,
        ),
        if (hasLocalData) ...<Widget>[
          const SizedBox(height: Gap.md),
          // Aplikasi offline-first: gagal menarik data bukan alasan
          // menghentikan penjualan selama katalog lama masih ada.
          TouchButton(
            label: 'Lanjut dengan Data Tersimpan',
            variant: TouchVariant.secondary,
            onPressed: onContinueOffline,
          ),
        ],
      ],
    );
  }
}

enum _NoticeTone { warning, danger }

class _Notice extends StatelessWidget {
  const _Notice({
    required this.tone,
    required this.icon,
    required this.message,
  });

  final _NoticeTone tone;
  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final (Color bg, Color line, Color fg) = switch (tone) {
      _NoticeTone.warning => (t.warningSubtle, t.warning, t.warningText),
      _NoticeTone.danger => (t.dangerSubtle, t.danger, t.danger),
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
          Expanded(child: Text(message, style: PosText.sm.copyWith(color: t.fg))),
        ],
      ),
    );
  }
}
