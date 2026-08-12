import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/features/auth/domain/entities/cashier_session.dart';
import 'package:posgodinov_mobile/features/auth/presentation/cubit/cashier_auth_cubit.dart';
import 'package:posgodinov_mobile/features/auth/presentation/pages/pin_login_page.dart';
import 'package:posgodinov_mobile/features/device/domain/repositories/device_repository.dart';
import 'package:posgodinov_mobile/features/device/presentation/cubit/device_binding_cubit.dart';
import 'package:posgodinov_mobile/features/device/presentation/cubit/master_sync_cubit.dart';
import 'package:posgodinov_mobile/features/device/presentation/pages/binding_page.dart';
import 'package:posgodinov_mobile/features/device/presentation/pages/master_sync_page.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';
import 'package:posgodinov_mobile/core/sync/background_sync_worker.dart';
import 'package:posgodinov_mobile/core/sync/sync_triggers.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/catalog_repository.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/cart_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/catalog_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/transaction_cubit.dart';
import 'package:posgodinov_mobile/features/kiosk/presentation/cubit/kiosk_cubit.dart';
import 'package:posgodinov_mobile/features/kiosk/presentation/pages/kiosk_page.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/register_page.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';
import 'package:posgodinov_mobile/features/shift/presentation/pages/open_shift_page.dart';

/// Tahapan gerbang, sesuai urutan [09 §8].
enum GateStep { checking, binding, masterSync, cashierLogin, openShift, ready }

/// **Gerbang navigasi awal.**
///
/// ```text
/// device_token ada?   ─ tidak ─▶ P-01 Binding
///    │ ya
/// master data ada?    ─ tidak ─▶ P-02 Sync Master
///    │ ya · umur > 12 jam ─────▶ P-02 (otomatis, dapat dilewati bila offline)
/// sesi kasir aktif?   ─ tidak ─▶ P-03 Login Kasir
///    │ ya
/// shift terbuka?      ─ tidak ─▶ P-04 Buka Shift
///    └ ya ────────────────────▶ P-05 Kasir Utama (M4)
/// ```
///
/// Ditempatkan di akar `lib/` bersama `app.dart` dan `bootstrap.dart` karena
/// perannya adalah **komposisi lintas fitur** — ia menjahit `device`, `auth`,
/// dan `shift`, sehingga tidak layak tinggal di dalam salah satunya.
class AppGate extends StatefulWidget {
  const AppGate({super.key});

  @override
  State<AppGate> createState() => _AppGateState();
}

class _AppGateState extends State<AppGate> {
  GateStep _step = GateStep.checking;

  @override
  void initState() {
    super.initState();
    unawaited(_evaluate());
  }

  /// Menentukan langkah berikutnya berdasarkan keadaan perangkat.
  Future<void> _evaluate() async {
    final DeviceRepository repo = getIt<DeviceRepository>();

    if (!await repo.isBound()) {
      _goTo(GateStep.binding);
      return;
    }

    if (await repo.isMasterDataEmpty()) {
      _goTo(GateStep.masterSync);
      return;
    }

    // Master data basi ditarik ulang, tetapi TIDAK memblokir: perangkat offline
    // tetap melanjutkan dengan snapshot lama ([04 §A.2]).
    if (await repo.isMasterDataStale()) {
      unawaited(getIt<MasterSyncCubit>().sync());
    }

    _goTo(GateStep.cashierLogin);
  }

  void _goTo(GateStep step) {
    if (mounted) setState(() => _step = step);
  }

  @override
  Widget build(BuildContext context) {
    return switch (_step) {
      GateStep.checking => const _Splash(),

      GateStep.binding => BlocProvider<DeviceBindingCubit>(
          create: (_) => DeviceBindingCubit(getIt<DeviceRepository>()),
          child: BindingPage(
            onBound: () {
              // Perangkat baru saja punya token — jadwalkan sinkronisasi latar
              // sekarang, bukan menunggu start berikutnya.
              unawaited(const BackgroundSync().ensureScheduled());
              _goTo(GateStep.masterSync);
            },
          ),
        ),

      GateStep.masterSync => BlocProvider<MasterSyncCubit>.value(
          value: getIt<MasterSyncCubit>(),
          child: MasterSyncPage(
            onCompleted: () => _goTo(GateStep.cashierLogin),
          ),
        ),

      GateStep.cashierLogin => BlocProvider<CashierAuthCubit>.value(
          value: getIt<CashierAuthCubit>(),
          child: PinLoginPage(onLoggedIn: () => _goTo(GateStep.openShift)),
        ),

      GateStep.openShift => _OpenShiftStep(onOpened: () => _goTo(GateStep.ready)),

      GateStep.ready => const _RegisterStep(),
    };
  }
}

/// Merakit P-05 beserta ketiga Cubit yang hanya hidup selama layar kasir
/// terbuka.
///
/// `CartCubit` dan `TransactionCubit` sengaja **tidak** didaftarkan sebagai
/// singleton: keduanya berumur satu transaksi, dan menyimpannya di `getIt`
/// membuat keranjang bertahan melewati pergantian kasir ([09 §7.1]).
class _RegisterStep extends StatefulWidget {
  const _RegisterStep();

  @override
  State<_RegisterStep> createState() => _RegisterStepState();
}

class _RegisterStepState extends State<_RegisterStep> {
  /// Nama outlet untuk kepala struk.
  ///
  /// **Tidak tersedia dari endpoint POS mana pun** — master data hanya
  /// mengirim staff, kategori, dan produk ([03 §2.2]), dan device bind hanya
  /// mengembalikan token. Satu-satunya sumbernya adalah isian teknisi di P-14.
  String _outletName = 'POS Godinov';

  @override
  void initState() {
    super.initState();
    unawaited(_loadOutletName());
  }

  Future<void> _loadOutletName() async {
    final String? name =
        await getIt<SyncDao>().readMeta(SyncMetaKeys.outletName);
    if (mounted && name != null && name.isNotEmpty) {
      setState(() => _outletName = name);
    }
  }

  @override
  Widget build(BuildContext context) {
    final CashierSession? session = getIt<CashierAuthCubit>().session;
    final ShiftState shiftState = getIt<ShiftCubit>().state;

    if (session == null || shiftState is! ShiftActive) return const _Splash();

    return MultiBlocProvider(
      providers: <BlocProvider<dynamic>>[
        BlocProvider<CartCubit>(create: (_) => CartCubit()),
        BlocProvider<CatalogCubit>(
          create: (_) => CatalogCubit(getIt<CatalogRepository>()),
        ),
        BlocProvider<TransactionCubit>(
          create: (_) => TransactionCubit(
            repository: getIt<RegisterRepository>(),
            printer: getIt<ReceiptPrinter>(),
            outletName: _outletName,
            // Memicu sinkronisasi tepat setelah transaksi tersimpan —
            // fire-and-forget; antrean tetap aman bila gagal ([09 §7.3]).
            onPersisted: () async =>
                getIt<SyncTriggers>().onTransactionSaved(),
          ),
        ),
      ],
      // Mode Kiosk menggantikan seluruh layar kasir — bukan menumpuknya —
      // sehingga tidak ada jalur navigasi tersisa menuju layar admin
      // ([09 §3.6]).
      child: BlocBuilder<KioskCubit, KioskState>(
        bloc: getIt<KioskCubit>(),
        builder: (BuildContext context, KioskState kiosk) {
          if (kiosk.enabled) {
            return BlocProvider<KioskCubit>.value(
              value: getIt<KioskCubit>(),
              child: const KioskPage(),
            );
          }
          return RegisterPage(
            session: session,
            shiftId: shiftState.shift.id,
          );
        },
      ),
    );
  }
}

/// Menyediakan [ShiftCubit] dan menentukan apakah P-04 masih perlu ditampilkan.
///
/// Kasir yang login ulang di tengah shift — mis. setelah aplikasi ditutup —
/// tidak boleh diminta membuka shift kedua.
class _OpenShiftStep extends StatefulWidget {
  const _OpenShiftStep({required this.onOpened});

  final VoidCallback onOpened;

  @override
  State<_OpenShiftStep> createState() => _OpenShiftStepState();
}

class _OpenShiftStepState extends State<_OpenShiftStep> {
  late final ShiftCubit _cubit = getIt<ShiftCubit>();

  @override
  void initState() {
    super.initState();
    unawaited(_cubit.observe());
  }

  @override
  Widget build(BuildContext context) {
    final CashierSession? session = getIt<CashierAuthCubit>().session;
    if (session == null) return const _Splash();

    return BlocProvider<ShiftCubit>.value(
      value: _cubit,
      child: BlocBuilder<ShiftCubit, ShiftState>(
        builder: (BuildContext context, ShiftState state) {
          if (state is ShiftActive) {
            WidgetsBinding.instance.addPostFrameCallback(
              (_) => widget.onOpened(),
            );
            return const _Splash();
          }
          return OpenShiftPage(session: session, onOpened: widget.onOpened);
        },
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
