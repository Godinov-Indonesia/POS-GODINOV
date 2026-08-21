import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/kiosk/kiosk_service.dart';
import 'package:posgodinov_mobile/core/sync/battery_optimization.dart';
import 'package:posgodinov_mobile/features/kiosk/presentation/cubit/kiosk_cubit.dart';
import 'package:posgodinov_mobile/features/device/presentation/cubit/master_sync_cubit.dart';
import 'package:posgodinov_mobile/features/printer/presentation/cubit/printer_cubit.dart';
import 'package:posgodinov_mobile/features/printer/presentation/pages/printer_setup_page.dart';
import 'package:posgodinov_mobile/features/shift/domain/session_lock_guard.dart';
import 'package:posgodinov_mobile/features/shift/presentation/widgets/force_close_sheet.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-14 — Pengaturan.**
///
/// Menyatukan hal-hal yang jarang disentuh tetapi harus dapat ditemukan:
/// printer, nama outlet, penarikan ulang master data, ganti kasir, dan
/// batasan sistem yang wajib diketahui pemilik.
class SettingsPage extends StatefulWidget {
  const SettingsPage({
    super.key,
    required this.cashierName,
    this.onChangeCashier,
  });

  final String cashierName;
  final VoidCallback? onChangeCashier;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final TextEditingController _outlet = TextEditingController();
  final BatteryOptimization _battery = BatteryOptimization();
  bool _savingOutlet = false;

  /// ── BUTIR 12 — Identity Lock ([11 §M15.2]) ────────────────────────────
  ///
  /// `true` selama ada shift `OPEN` di perangkat ini. Bawaannya TERKUNCI:
  /// menampilkan tombol keluar selama keadaan shift belum diketahui berarti
  /// menampilkannya, walau sekejap, pada perangkat yang seharusnya terkunci —
  /// dan sekejap sudah cukup untuk diketuk.
  bool _shiftLocked = true;
  final KioskService _kiosk = KioskService();
  bool _batteryExempt = false;
  bool _isDeviceOwner = false;
  bool _aggressiveVendor = false;
  String _vendor = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final String? name =
          await getIt<SyncDao>().readMeta(SyncMetaKeys.outletName);
      if (mounted && name != null) _outlet.text = name;
      await _refreshBattery();

      final bool owner = await _kiosk.isDeviceOwner;
      if (mounted) setState(() => _isDeviceOwner = owner);

      await _refreshLock();
    });
  }

  /// Membaca keadaan kunci **tanpa mencatat apa pun**.
  ///
  /// `isLockedSilently`, bukan `isLocked`: yang terakhir menulis satu baris
  /// audit setiap kali dipanggil, dan menggambar ulang layar bukan percobaan
  /// keluar sesi.
  Future<void> _refreshLock() async {
    final bool locked = await getIt<SessionLockGuard>().isLockedSilently();
    if (mounted) setState(() => _shiftLocked = locked);
  }

  /// Membuka jalur darurat Force Close (butir 12).
  Future<void> _openForceClose() async {
    final bool? closed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const ForceCloseSheet(),
    );

    if (closed == true && mounted) {
      // Perangkat baru saja dilepas dari shift orang lain. Layar pengaturan
      // ditutup supaya kasir kembali ke gerbang navigasi, yang akan
      // mengarahkannya ke Login — sesi lama sudah dibersihkan saga.
      Navigator.of(context).pop();
    }
  }

  @override
  void dispose() {
    _outlet.dispose();
    super.dispose();
  }

  Future<void> _refreshBattery() async {
    final bool exempt = await _battery.isIgnoring;
    final bool aggressive = await _battery.needsExtraSteps;
    final String vendor = await _battery.vendorName;

    if (mounted) {
      setState(() {
        _batteryExempt = exempt;
        _aggressiveVendor = aggressive;
        _vendor = vendor;
      });
    }
  }

  Future<void> _requestBattery() async {
    await _battery.request();
    await _refreshBattery();
  }

  Future<void> _saveOutletName() async {
    setState(() => _savingOutlet = true);
    await getIt<SyncDao>().writeMeta(
      SyncMetaKeys.outletName,
      _outlet.text.trim(),
      DateTime.now().toUtc(),
    );
    if (mounted) setState(() => _savingOutlet = false);
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppBar(title: const Text('Pengaturan')),
      body: ListView(
        padding: const EdgeInsets.all(Gap.xl),
        children: <Widget>[
          _Section(
            title: 'NAMA OUTLET',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  // Temuan M7: nama outlet TIDAK tersedia dari endpoint POS
                  // mana pun — master data hanya mengirim staff, kategori, dan
                  // produk ([03 §2.2]), dan device bind hanya mengembalikan
                  // token. Satu-satunya sumbernya adalah teknisi.
                  'Dicetak pada kepala struk. Tidak tersedia dari server, jadi '
                  'harus diisi saat pemasangan.',
                  style: PosText.sm.copyWith(color: t.fgMuted),
                ),
                const SizedBox(height: Gap.sm),
                TextField(
                  controller: _outlet,
                  style: PosText.base,
                  decoration: const InputDecoration(
                    hintText: 'Contoh: Outlet Sudirman',
                  ),
                ),
                const SizedBox(height: Gap.sm),
                TouchButton(
                  label: 'Simpan',
                  height: Touch.standard,
                  variant: TouchVariant.secondary,
                  isLoading: _savingOutlet,
                  onPressed: _saveOutletName,
                ),
              ],
            ),
          ),

          _Section(
            title: 'PRINTER',
            child: BlocBuilder<PrinterCubit, PrinterUiState>(
              builder: (BuildContext context, PrinterUiState state) {
                return _ActionTile(
                  icon: Icons.print_outlined,
                  label: state.label,
                  hint: 'Pasang, ganti, atau hubungkan ulang printer',
                  onTap: () => Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (_) => BlocProvider<PrinterCubit>.value(
                        value: getIt<PrinterCubit>(),
                        child: const PrinterSetupPage(),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          _Section(
            title: 'DATA',
            child: BlocConsumer<MasterSyncCubit, MasterSyncState>(
              bloc: getIt<MasterSyncCubit>(),
              listener: (BuildContext context, MasterSyncState state) {
                if (state is MasterSyncDone) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Data outlet berhasil ditarik ulang.'),
                      backgroundColor: Colors.green,
                    ),
                  );
                } else if (state is MasterSyncFailure) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Gagal menarik data: ${state.message}'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              },
              builder: (BuildContext context, MasterSyncState state) {
                final bool isSyncing = state is MasterSyncDownloading;
                return Column(
                  children: <Widget>[
                    _ActionTile(
                      icon: Icons.cloud_download_outlined,
                      label: isSyncing ? 'Menarik data...' : 'Tarik ulang data outlet',
                      hint: isSyncing
                          ? 'Sedang mengunduh seluruh katalog data outlet...'
                          : 'Produk, kategori, dan kasir. Menarik SELURUH katalog.',
                      onTap: isSyncing ? null : () => getIt<MasterSyncCubit>().sync(),
                    ),
                    const SizedBox(height: Gap.sm),

                    // ═══════════════════════════════════════════════════════
                    // BUTIR 12 — TIDAK DIRENDER, BUKAN DINONAKTIFKAN
                    // ═══════════════════════════════════════════════════════
                    //
                    // Selama ada shift `OPEN`, "Ganti kasir" tidak dibangun
                    // sama sekali. Tombol yang tampak tetapi ditolak mengajari
                    // kasir bahwa aplikasinya rusak, lalu mengajari orang
                    // berikutnya mencari jalan lain — dan salah satu jalan itu
                    // cepat atau lambat berhasil.
                    //
                    // Hint lama di sini berbunyi "Shift yang sedang berjalan
                    // tidak ikut ditutup." Kalimat itu menjelaskan persis
                    // lubang yang butir 12 dibangun untuk menutupnya.
                    if (_shiftLocked)
                      _LockedSessionCard(onForceClose: _openForceClose)
                    else
                      _ActionTile(
                        icon: Icons.person_outline,
                        label: 'Ganti kasir — ${widget.cashierName}',
                        hint: 'Tidak ada shift berjalan di perangkat ini.',
                        onTap: isSyncing ? null : widget.onChangeCashier,
                      ),
                  ],
                );
              },
            ),
          ),

          _Section(
            title: 'MODE KIOSK',
            child: _KioskCard(
              isDeviceOwner: _isDeviceOwner,
              onEnable: () async {
                await getIt<KioskCubit>().enable();
                if (context.mounted) Navigator.of(context).pop();
              },
            ),
          ),

          _Section(
            title: 'SINKRONISASI LATAR',
            child: _BatteryCard(
              exempt: _batteryExempt,
              aggressiveVendor: _aggressiveVendor,
              vendor: _vendor,
              onRequest: _requestBattery,
            ),
          ),

          _Section(
            title: 'PERANGKAT',
            child: const _DeviceWarning(),
          ),
        ],
      ),
    );
  }
}

/// Menyatakan **tingkat penguncian yang sesungguhnya**, bukan yang diinginkan.
///
/// Aplikasi memanggil API yang sama untuk Lock Task penuh dan *screen pinning*;
/// yang menentukan kekuatannya adalah status Device Owner perangkat. Pemilik
/// yang mengira perangkatnya terkunci penuh padahal hanya ter-*pin* akan
/// menemukan pelanggan keluar ke Home dalam tiga detik ([09 §4.4]).
class _KioskCard extends StatelessWidget {
  const _KioskCard({required this.isDeviceOwner, required this.onEnable});

  final bool isDeviceOwner;
  final Future<void> Function() onEnable;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (!isDeviceOwner)
          Container(
            padding: const EdgeInsets.all(Gap.lg),
            margin: const EdgeInsets.only(bottom: Gap.md),
            decoration: BoxDecoration(
              color: t.warningSubtle,
              borderRadius: BorderRadius.circular(Radii.md),
              border: Border.all(color: t.warning),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(Icons.lock_open_outlined, color: t.warningText),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'Perangkat ini BUKAN Device Owner',
                        style: PosText.base,
                      ),
                      const SizedBox(height: Gap.xs),
                      Text(
                        'Mode Kiosk hanya akan menyematkan layar. Pelanggan '
                        'masih dapat keluar dengan menahan tombol Kembali + '
                        'Recents.\n\nUntuk penguncian penuh, perangkat harus '
                        'direset pabrik dan dipasang ulang oleh teknisi '
                        'sebelum akun apa pun ditambahkan.',
                        style: PosText.sm.copyWith(color: t.fg),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else
          Container(
            padding: const EdgeInsets.all(Gap.lg),
            margin: const EdgeInsets.only(bottom: Gap.md),
            decoration: BoxDecoration(
              color: t.successSubtle,
              borderRadius: BorderRadius.circular(Radii.md),
              border: Border.all(color: t.success),
            ),
            child: Row(
              children: <Widget>[
                Icon(Icons.lock_outline, color: t.successText),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: Text(
                    'Penguncian penuh tersedia. Tombol Home dan Recents akan '
                    'dimatikan saat Kiosk aktif.',
                    style: PosText.sm.copyWith(color: t.fg),
                  ),
                ),
              ],
            ),
          ),
        TouchButton(
          label: 'Aktifkan Mode Kiosk',
          icon: Icons.storefront,
          height: Touch.standard,
          variant: TouchVariant.secondary,
          onPressed: onEnable,
        ),
        const SizedBox(height: Gap.sm),
        Text(
          // Gerbang keluar sengaja tidak diiklankan di layar Kiosk itu sendiri.
          'Keluar dari Kiosk: ketuk logo 5× lalu masukkan PIN staff.',
          style: PosText.xs.copyWith(color: t.fgSubtle),
        ),
      ],
    );
  }
}

/// Pengecualian optimasi baterai — penentu apakah sinkronisasi latar benar-benar
/// bekerja di outlet ([09 §6.4]).
class _BatteryCard extends StatelessWidget {
  const _BatteryCard({
    required this.exempt,
    required this.aggressiveVendor,
    required this.vendor,
    required this.onRequest,
  });

  final bool exempt;
  final bool aggressiveVendor;
  final String vendor;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    if (exempt) {
      return Container(
        padding: const EdgeInsets.all(Gap.lg),
        decoration: BoxDecoration(
          color: t.successSubtle,
          borderRadius: BorderRadius.circular(Radii.md),
          border: Border.all(color: t.success),
        ),
        child: Row(
          children: <Widget>[
            Icon(Icons.check_circle_outline, color: t.successText),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Text(
                'Aplikasi dikecualikan dari penghemat baterai. Penjualan tetap '
                'terkirim walau aplikasi ditutup.',
                style: PosText.sm.copyWith(color: t.fg),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.warningSubtle,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: t.warning),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(Icons.battery_alert_outlined, color: t.warningText),
              const SizedBox(width: Gap.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Sinkronisasi latar dapat dihentikan sistem',
                      style: PosText.base,
                    ),
                    const SizedBox(height: Gap.xs),
                    Text(
                      'Tanpa pengecualian penghemat baterai, penjualan yang '
                      'belum terkirim bisa tertahan sampai aplikasi dibuka '
                      'kembali.',
                      style: PosText.sm.copyWith(color: t.fg),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: Gap.md),
          TouchButton(
            label: 'Optimalkan Sinkronisasi Latar',
            icon: Icons.battery_saver_outlined,
            height: Touch.standard,
            variant: TouchVariant.secondary,
            onPressed: onRequest,
          ),
          if (aggressiveVendor) ...<Widget>[
            const SizedBox(height: Gap.md),
            Text(
              // Pada MIUI/ColorOS/FunTouch, pengecualian sistem saja belum
              // cukup — ada lapisan pengelola baterai milik vendor sendiri.
              'Perangkat $vendor memerlukan satu langkah tambahan: buka '
              'Pengaturan sistem → Aplikasi → POS Godinov → Hemat baterai, '
              'lalu pilih "Tanpa batasan". Tanpa itu, sistem tetap menghentikan '
              'sinkronisasi saat layar mati.',
              style: PosText.xs.copyWith(color: t.fg),
            ),
          ],
        ],
      ),
    );
  }
}

/// Menyatakan batasan keamanan apa adanya.
///
/// Pemilik berhak tahu ini, dan menyembunyikannya hanya menunda kejutan sampai
/// perangkat benar-benar hilang.
class _DeviceWarning extends StatelessWidget {
  const _DeviceWarning();

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.warningSubtle,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: t.warning),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.warning_amber_outlined, color: t.warningText),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('Perangkat tidak dapat dilepas', style: PosText.base),
                const SizedBox(height: Gap.xs),
                Text(
                  // [03 §2.1] — tidak ada endpoint unbind, tidak ada daftar
                  // perangkat, tidak ada pencabutan.
                  'Setelah dipasang, perangkat ini memiliki akses sinkronisasi '
                  'ke outlet secara permanen. Bila hilang atau dicuri, akses '
                  'itu tidak dapat dicabut dari jarak jauh. Simpan perangkat '
                  'dengan aman.',
                  style: PosText.sm.copyWith(color: t.fg),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            title,
            style: PosText.sm.copyWith(
              color: context.tokens.fgMuted,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: Gap.sm),
          child,
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.hint,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String hint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Radii.md),
      child: Container(
        constraints: const BoxConstraints(minHeight: Touch.primary),
        padding: const EdgeInsets.all(Gap.md),
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(Radii.md),
          border: Border.all(color: t.border),
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, color: t.fgMuted),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(label, style: PosText.base),
                  Text(hint, style: PosText.xs.copyWith(color: t.fgMuted)),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: t.fgSubtle),
          ],
        ),
      ),
    );
  }
}

/// Menggantikan tombol "Ganti kasir" selama sesi terkunci — **butir 12**
/// ([11 §M15.2]).
///
/// Menjelaskan MENGAPA jalan normalnya tertutup, lalu menawarkan satu-satunya
/// jalan keluar yang sah. Kartu penjelasan dipilih ketimbang tombol yang
/// dinonaktifkan karena keduanya menyampaikan hal yang berbeda: tombol mati
/// berarti "sedang tidak bisa", kartu ini berarti "memang tidak boleh".
class _LockedSessionCard extends StatelessWidget {
  const _LockedSessionCard({required this.onForceClose});

  final Future<void> Function() onForceClose;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.bg,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: t.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(Icons.lock_outline, size: 20, color: t.fgMuted),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: Text(
                  'Sesi terkunci oleh shift yang berjalan',
                  style: PosText.base.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: Gap.xs),
          Text(
            'Kasir tidak dapat diganti sebelum shift ditutup. Gunakan '
            '"Tutup Shift" untuk mengakhiri sesi secara normal.',
            style: PosText.sm.copyWith(color: t.fgMuted),
          ),

          const SizedBox(height: Gap.md),
          // Jalur darurat. Diletakkan DI BAWAH keterangan yang menjelaskan
          // mengapa jalan normalnya tertutup — bukan sebagai tombol setara di
          // daftar menu.
          TextButton.icon(
            onPressed: () => unawaited(onForceClose()),
            icon: Icon(Icons.gpp_maybe_outlined, color: t.danger),
            label: Text(
              'Tutup Paksa Shift (Supervisor)',
              style: PosText.sm.copyWith(color: t.danger),
            ),
          ),
        ],
      ),
    );
  }
}
