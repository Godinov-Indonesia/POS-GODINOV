import 'dart:async';
import 'dart:convert';

import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/security_event_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/features/auth/domain/entities/cashier_session.dart';
import 'package:posgodinov_mobile/features/device/domain/repositories/device_repository.dart';
import 'package:posgodinov_mobile/features/shift/domain/master_gate.dart';
import 'package:uuid/uuid.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-04 — Buka Shift**, digerbangi pada Fase M15.1 (**butir 10**).
///
/// Kasir memasukkan modal awal laci. Nilai itu menjadi suku pertama
/// `expected_cash` — yang sejak Blind Closing dihitung **server** dan tidak
/// pernah terlihat kasir ([11 §M15.3]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// GERBANG MENDAHULUI FORMULIR
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Formulir modal awal **tidak dibangun sama sekali** sebelum gerbang lolos.
/// Bukan dinonaktifkan, bukan ditutupi overlay: kasir yang melihat formulir
/// yang ditolak akan mencoba jalan lain, dan salah satunya cepat atau lambat
/// berhasil.
///
/// **Tidak ada tombol "Lewati".** Lihat catatan pada [MasterGate].
class OpenShiftPage extends StatefulWidget {
  const OpenShiftPage({super.key, required this.session, this.onOpened});

  final CashierSession session;
  final VoidCallback? onOpened;

  @override
  State<OpenShiftPage> createState() => _OpenShiftPageState();
}

class _OpenShiftPageState extends State<OpenShiftPage> {
  MasterGateVerdict? _gate;
  bool _pulling = false;
  String? _pullError;

  @override
  void initState() {
    super.initState();
    unawaited(_evaluateGate());
  }

  /// Menilai gerbang, lalu mencatat penolakannya.
  ///
  /// Pencatatan terjadi setiap kali gerbang menolak, bukan hanya saat kasir
  /// menekan "Coba Lagi": perangkat yang menabrak gerbang ini sepuluh kali
  /// sehari adalah outlet yang jaringannya bermasalah, dan pemilik tidak akan
  /// pernah mengetahuinya dari layar kasir.
  Future<void> _evaluateGate() async {
    final MasterGateVerdict verdict = await getIt<MasterGate>().evaluate();
    if (!mounted) return;
    setState(() => _gate = verdict);

    if (!verdict.ok) await _recordBlocked(verdict);
  }

  Future<void> _recordBlocked(MasterGateVerdict v) async {
    try {
      await getIt<SecurityEventDao>().record(
        SecurityEventsCompanion.insert(
          id: const Uuid().v4(),
          staffId: Value<String?>(widget.session.staffId),
          deviceId: Value<String>(
            await getIt<SyncDao>().readMeta(SyncMetaKeys.deviceId) ?? 'legacy',
          ),
          eventType: SecurityEventType.openShiftBlockedStaleMaster,
          severity: SecuritySeverity.warn,
          detailsJson: Value<String>(
            jsonEncode(<String, dynamic>{
              'reason': v.reason.name,
              'age_minutes': v.ageMinutes,
              'max_age_minutes': v.maxAgeMinutes,
              'held_version': v.version,
              'server_version': v.serverVersion,
            }),
          ),
          clientCreatedAt: DateTime.now().toUtc(),
        ),
      );
    } on Object {
      // Gerbang tetap menutup walau jejaknya gagal ditulis.
    }
  }

  /// Menarik master data, lalu menilai ulang gerbangnya.
  Future<void> _pullMaster() async {
    setState(() {
      _pulling = true;
      _pullError = null;
    });
    try {
      await getIt<DeviceRepository>().syncMasterData();
      await _evaluateGate();
    } on Object catch (e) {
      if (mounted) {
        setState(() => _pullError =
            'Tidak dapat menghubungi server. Periksa jaringan outlet lalu coba lagi. ($e)');
      }
    } finally {
      if (mounted) setState(() => _pulling = false);
    }
  }

  /// Modal awal dalam **Rupiah bulat** seperti yang diketik kasir; dikonversi ke
  /// sen tepat sebelum disimpan.
  int _rupiah = 0;

  /// Pecahan yang benar-benar dipakai sebagai modal laci di Indonesia.
  static const List<int> _presets = <int>[100000, 200000, 500000, 1000000];

  int get _minor => _rupiah * 100;

  void _setFromText(String raw) {
    final String digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    setState(() => _rupiah = digits.isEmpty ? 0 : int.parse(digits));
  }

  Future<void> _submit() async {
    final MasterGateVerdict? gate = _gate;
    if (gate == null || !gate.ok) return;

    final ShiftCubit cubit = context.read<ShiftCubit>();
    final String deviceId =
        await getIt<SyncDao>().readMeta(SyncMetaKeys.deviceId) ?? 'legacy';

    await cubit.openShift(
      staffId: widget.session.staffId,
      openingBalanceMinor: _minor,
      // Diambil dari PUTUSAN gerbang, bukan dibaca ulang: pembacaan kedua akan
      // mengambil versi berbeda bila master ditarik ulang di antara keduanya,
      // dan shift akan mengklaim versi yang tidak pernah dipakai memutuskan
      // apa pun.
      masterDataVersion: gate.version,
      deviceId: deviceId,
      blindClose: gate.blindCloseEnabled,
    );
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    final MasterGateVerdict? gate = _gate;
    if (gate == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!gate.ok) {
      return _MasterDataBlocker(
        verdict: gate,
        pulling: _pulling,
        error: _pullError,
        onRetry: _pullMaster,
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Buka Shift')),
      body: BlocConsumer<ShiftCubit, ShiftState>(
        listener: (BuildContext context, ShiftState state) {
          if (state is ShiftActive) widget.onOpened?.call();
        },
        builder: (BuildContext context, ShiftState state) {
          final bool busy = state is ShiftOpening;

          return Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(Gap.xl),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Text(
                      'Kasir bertugas',
                      style: PosText.sm.copyWith(color: t.fgMuted),
                    ),
                    const SizedBox(height: Gap.xs),
                    Text(widget.session.name, style: PosText.buttonLg),

                    const SizedBox(height: Gap.xxl),
                    Text(
                      'Modal Awal Laci',
                      style: PosText.sm.copyWith(color: t.fgMuted),
                    ),
                    const SizedBox(height: Gap.xs),
                    TextField(
                      enabled: !busy,
                      autofocus: true,
                      keyboardType: TextInputType.number,
                      inputFormatters: <TextInputFormatter>[
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(9),
                      ],
                      onChanged: _setFromText,
                      style: PosText.moneyXl,
                      decoration: const InputDecoration(
                        prefixText: 'Rp ',
                        hintText: '0',
                      ),
                    ),

                    const SizedBox(height: Gap.md),
                    // Pratinjau memakai MoneyText supaya kasir melihat nominal
                    // dalam format yang sama persis dengan struk nanti.
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: <Widget>[
                        Text(
                          'Tersimpan sebagai ',
                          style: PosText.sm.copyWith(color: t.fgMuted),
                        ),
                        MoneyText(_minor, size: MoneySize.md),
                      ],
                    ),

                    const SizedBox(height: Gap.xl),
                    Text(
                      'Pilih cepat',
                      style: PosText.sm.copyWith(color: t.fgMuted),
                    ),
                    const SizedBox(height: Gap.sm),
                    Wrap(
                      spacing: Gap.sm,
                      runSpacing: Gap.sm,
                      children: <Widget>[
                        for (final int preset in _presets)
                          SizedBox(
                            width: 140,
                            child: TouchButton(
                              label: 'Rp ${preset ~/ 1000}rb',
                              height: Touch.frequent,
                              variant: TouchVariant.secondary,
                              onPressed: busy
                                  ? null
                                  : () => setState(() => _rupiah = preset),
                            ),
                          ),
                      ],
                    ),

                    if (state is ShiftFailure) ...<Widget>[
                      const SizedBox(height: Gap.lg),
                      Row(
                        children: <Widget>[
                          Icon(Icons.error_outline, color: t.danger),
                          const SizedBox(width: Gap.sm),
                          Expanded(
                            child: Text(
                              state.message,
                              style: PosText.base.copyWith(color: t.danger),
                            ),
                          ),
                        ],
                      ),
                    ],

                    const SizedBox(height: Gap.xxl),
                    TouchButton(
                      label: 'Buka Shift',
                      icon: Icons.play_arrow,
                      variant: TouchVariant.success,
                      isLoading: busy,
                      onPressed: busy ? null : _submit,
                    ),

                    const SizedBox(height: Gap.md),
                    Text(
                      // Modal Rp 0 sah — sebagian outlet memulai tanpa kembalian
                      // di laci. Yang tidak boleh adalah nilai negatif.
                      'Modal Rp 0 diperbolehkan bila laci dimulai kosong.',
                      textAlign: TextAlign.center,
                      style: PosText.sm.copyWith(color: t.fgMuted),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Layar pemblokir gerbang Master Data — **bukan spinner di sudut**
/// ([11 §M15.1]).
///
/// Menempati seluruh layar dengan sengaja. Indikator kecil di pojok akan
/// diabaikan oleh kasir yang sedang membuka toko, dan pesan yang diabaikan sama
/// saja dengan pesan yang tidak pernah ada.
class _MasterDataBlocker extends StatelessWidget {
  const _MasterDataBlocker({
    required this.verdict,
    required this.pulling,
    required this.error,
    required this.onRetry,
  });

  final MasterGateVerdict verdict;
  final bool pulling;
  final String? error;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppBar(title: const Text('Buka Shift')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(Gap.xl),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Icon(Icons.lock_outline, size: 56, color: t.danger),
                const SizedBox(height: Gap.lg),
                Text(
                  'SHIFT BELUM DAPAT DIBUKA',
                  textAlign: TextAlign.center,
                  style: PosText.buttonLg,
                ),
                const SizedBox(height: Gap.sm),
                Text(
                  verdict.message,
                  textAlign: TextAlign.center,
                  style: PosText.base.copyWith(color: t.fgMuted),
                ),

                const SizedBox(height: Gap.lg),
                Container(
                  padding: const EdgeInsets.all(Gap.lg),
                  decoration: BoxDecoration(
                    color: t.surface,
                    borderRadius: BorderRadius.circular(Radii.md),
                    border: Border.all(color: t.border),
                  ),
                  child: Text(
                    'Berjualan dengan harga yang sudah tidak berlaku tidak dapat '
                    'dikoreksi setelah pelanggan pulang. Karena itu unduhan ini '
                    'wajib, dan tidak dapat dilewati.',
                    style: PosText.sm.copyWith(color: t.fgMuted),
                  ),
                ),

                if (error != null) ...<Widget>[
                  const SizedBox(height: Gap.lg),
                  Text(
                    error!,
                    style: PosText.sm.copyWith(color: t.danger),
                  ),
                ],

                const SizedBox(height: Gap.xl),
                TouchButton(
                  label: 'Unduh Data & Coba Lagi',
                  icon: Icons.download_outlined,
                  isLoading: pulling,
                  onPressed: pulling ? null : () => unawaited(onRetry()),
                ),

                // ⛔ TIDAK ADA TOMBOL "LEWATI". Satu-satunya jalan keluar dari
                // layar ini adalah berhasil mengunduh — atau menutup aplikasi.
                // Lihat catatan pada [MasterGate].
              ],
            ),
          ),
        ),
      ),
    );
  }
}
