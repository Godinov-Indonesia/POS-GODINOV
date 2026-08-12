import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/features/sync/presentation/cubit/sync_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';

/// Indikator status koneksi & sinkronisasi pada StatusBar ([06 §4.7.1]).
///
/// **Setiap keadaan punya penanda kedua selain warna** — ikon dan teks — karena
/// warna saja tidak dapat dibedakan oleh sebagian kasir, dan layar POS sering
/// dilihat sekilas dari sudut ([06 §1.5]).
///
/// Prioritas bila beberapa kondisi bersamaan ditentukan `SyncState.badge`:
/// `gagal › jam melenceng › offline › antrean › normal`.
class SyncBadgeChip extends StatelessWidget {
  const SyncBadgeChip({super.key, required this.state, this.onTap});

  final SyncState state;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    final (IconData icon, String label, Color color) = switch (state.badge) {
      SyncBadge.failed => (
          Icons.warning_amber_rounded,
          state.pendingCount > 0
              ? '${state.pendingLabel} gagal sinkron'
              : 'Gagal sinkron',
          t.danger,
        ),
      SyncBadge.clockSkew => (
          Icons.schedule_outlined,
          'Jam perangkat melenceng',
          t.warning,
        ),
      SyncBadge.offlineQueued => (
          Icons.cloud_off_outlined,
          'Offline · ${state.pendingLabel} antre',
          t.warning,
        ),
      SyncBadge.offline => (
          Icons.cloud_off_outlined,
          'Offline',
          t.fgSubtle,
        ),
      SyncBadge.syncing => (
          Icons.sync,
          'Menyinkron…',
          t.info,
        ),
      SyncBadge.queued => (
          Icons.schedule,
          'Online · ${state.pendingLabel} antre',
          t.warning,
        ),
      SyncBadge.synced => (
          Icons.check_circle_outline,
          'Online',
          t.success,
        ),
    };

    return Semantics(
      button: onTap != null,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.sm),
        child: Container(
          height: Touch.standard,
          padding: const EdgeInsets.symmetric(horizontal: Gap.sm),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(icon, size: 18, color: color),
              const SizedBox(width: Gap.xs),
              Text(label, style: PosText.sm.copyWith(color: color)),
            ],
          ),
        ),
      ),
    );
  }
}
