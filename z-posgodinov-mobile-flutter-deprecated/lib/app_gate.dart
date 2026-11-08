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
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/network/api_client.dart';
import 'package:posgodinov_mobile/core/network/interceptors/device_token_interceptor.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';
import 'package:posgodinov_mobile/core/sync/background_sync_worker.dart';
import 'package:posgodinov_mobile/core/sync/sync_triggers.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/catalog_repository.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/cart_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/catalog_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/transaction_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/register_page.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';
import 'package:posgodinov_mobile/features/shift/presentation/pages/open_shift_page.dart';

/// Tahapan gerbang, sesuai urutan [09 §8].
enum GateStep {
  checking,
  binding,
  masterSync,
  cashierLogin,
  openShift,
  ready,
  suspended,
}

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
  StreamSubscription<DeviceStatus>? _deviceStatusSub;

  @override
  void initState() {
    super.initState();
    if (getIt.isRegistered<ApiClient>()) {
      _deviceStatusSub = getIt<ApiClient>()
          .deviceTokenInterceptor
          .status
          .listen((DeviceStatus status) {
        if (status == DeviceStatus.rejected) {
          _goTo(GateStep.binding);
        } else if (status == DeviceStatus.suspended) {
          _goTo(GateStep.suspended);
        }
      });
    }
    unawaited(_evaluate());
  }

  @override
  void dispose() {
    unawaited(_deviceStatusSub?.cancel());
    super.dispose();
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
    return BlocListener<CashierAuthCubit, CashierAuthState>(
      bloc: getIt<CashierAuthCubit>(),
      listener: (BuildContext context, CashierAuthState state) {
        if (state is CashierLoggedOut) {
          if (Navigator.of(context).canPop()) {
            Navigator.of(context)
                .popUntil((Route<dynamic> route) => route.isFirst);
          }
          _goTo(GateStep.cashierLogin);
        }
      },
      child: switch (_step) {
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
        GateStep.openShift =>
          _OpenShiftStep(onOpened: () => _goTo(GateStep.ready)),
        GateStep.ready => const _RegisterStep(),
        GateStep.suspended => _SuspendedScreen(onRetry: _evaluate),
      },
    );
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
            onPersisted: () async => getIt<SyncTriggers>().onTransactionSaved(),
            onReceiptPrinted: (String id) => getIt<TransactionDao>()
                .markReceiptPrinted(id, DateTime.now().toUtc()),
          ),
        ),
      ],
      child: RegisterPage(
        session: session,
        shiftId: shiftState.shift.id,
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

class _SuspendedScreen extends StatelessWidget {
  const _SuspendedScreen({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                const Icon(
                  Icons.block_rounded,
                  size: 64,
                  color: Colors.redAccent,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Akun Bisnis Ditangguhkan',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Layanan bisnis Anda sedang berstatus SUSPENDED. '
                  'Data transaksi lokal tetap tersimpan aman di perangkat. '
                  'Silakan hubungi administrator atau dukungan pelanggan.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: () => unawaited(onRetry()),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Coba Lagi'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
