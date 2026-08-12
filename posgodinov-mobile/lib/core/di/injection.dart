import 'package:get_it/get_it.dart';
import 'package:posgodinov_mobile/core/config/app_config.dart';
import 'package:posgodinov_mobile/core/crypto/pin_verifier.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/held_cart_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/master_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/shift_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/waste_dao.dart';
import 'package:posgodinov_mobile/core/network/api_client.dart';
import 'package:posgodinov_mobile/core/network/clock_skew_monitor.dart';
import 'package:posgodinov_mobile/core/network/connectivity_monitor.dart';
import 'package:posgodinov_mobile/core/printer/printer_manager.dart';
import 'package:posgodinov_mobile/core/printer/printer_preferences.dart';
import 'package:posgodinov_mobile/core/printer/printer_registry.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';
import 'package:posgodinov_mobile/core/kiosk/kiosk_guard.dart';
import 'package:posgodinov_mobile/core/kiosk/kiosk_service.dart';
import 'package:posgodinov_mobile/core/storage/secure_storage_service.dart';
import 'package:posgodinov_mobile/core/sync/reconciler.dart';
import 'package:posgodinov_mobile/core/sync/sync_engine.dart';
import 'package:posgodinov_mobile/core/sync/sync_remote_ds.dart';
import 'package:posgodinov_mobile/core/sync/sync_triggers.dart';
import 'package:posgodinov_mobile/features/register/data/repositories/catalog_repository_impl.dart';
import 'package:posgodinov_mobile/features/register/data/repositories/held_cart_repository_impl.dart';
import 'package:posgodinov_mobile/features/register/data/repositories/register_repository_impl.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/catalog_repository.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:posgodinov_mobile/features/history/data/datasources/history_remote_ds.dart';
import 'package:posgodinov_mobile/features/history/data/repositories/history_repository_impl.dart';
import 'package:posgodinov_mobile/features/history/domain/repositories/history_repository.dart';
import 'package:posgodinov_mobile/features/history/presentation/cubit/history_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/held_cart_cubit.dart';
import 'package:posgodinov_mobile/features/waste/data/repositories/waste_repository_impl.dart';
import 'package:posgodinov_mobile/features/waste/domain/repositories/waste_repository.dart';
import 'package:posgodinov_mobile/features/waste/presentation/cubit/waste_cubit.dart';
import 'package:posgodinov_mobile/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:posgodinov_mobile/features/auth/domain/repositories/auth_repository.dart';
import 'package:posgodinov_mobile/features/auth/presentation/cubit/cashier_auth_cubit.dart';
import 'package:posgodinov_mobile/features/device/data/datasources/device_remote_ds.dart';
import 'package:posgodinov_mobile/features/device/data/datasources/master_local_ds.dart';
import 'package:posgodinov_mobile/features/device/data/repositories/device_repository_impl.dart';
import 'package:posgodinov_mobile/features/device/domain/repositories/device_repository.dart';
import 'package:posgodinov_mobile/features/device/presentation/cubit/master_sync_cubit.dart';
import 'package:posgodinov_mobile/features/shift/data/repositories/shift_repository_impl.dart';
import 'package:posgodinov_mobile/features/shift/domain/repositories/shift_repository.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';
import 'package:posgodinov_mobile/features/kiosk/presentation/cubit/kiosk_cubit.dart';
import 'package:posgodinov_mobile/features/printer/presentation/cubit/printer_cubit.dart';
import 'package:posgodinov_mobile/features/sync/presentation/cubit/sync_cubit.dart';

/// Kontainer dependensi aplikasi.
final GetIt getIt = GetIt.instance;

/// Merakit seluruh dependensi — **composition root**.
///
/// ## Mengapa manual, bukan `injectable`
///
/// [09 §1.2] mendaftarkan `injectable` + `injectable_generator`. Registrasi di
/// bawah sengaja ditulis tangan:
///
/// - **Satu berkas hasil generasi lebih sedikit.** Proyek ini sudah bergantung
///   pada `build_runner` untuk Drift; menambah `injection.config.dart` berarti
///   satu lagi berkas yang harus dibangkitkan sebelum kode dapat dianalisis.
/// - **Cerminan backend.** [01 §1] mencatat bahwa Go-nya melakukan DI *"manual
///   dan eksplisit"* tanpa framework, dan menyebutnya sebagai kekuatan. Urutan
///   perakitan POS pun bermakna — basis data harus terbuka sebelum DAO ada, dan
///   `ApiClient` butuh `SecureStorageService`.
/// - **Urutan terbaca.** Anotasi menyembunyikan ketergantungan; berkas ini
///   menampilkannya sebagai daftar yang dapat dibaca dari atas ke bawah.
///
/// Bila tim lebih memilih `injectable`, `injectable` dan `injectable_generator`
/// dapat dihapus dari `pubspec.yaml` — keduanya kini tidak terpakai.
///
/// ## Dipanggil dua kali, di dua isolate
///
/// Selain saat aplikasi start, fungsi ini dipanggil ulang oleh
/// `callbackDispatcher` WorkManager ([09 §6.4]). Isolate latar **tidak**
/// mewarisi apa pun dari isolate UI, sehingga seluruh dependensi harus dirakit
/// ulang di sana — termasuk membuka koneksi basis datanya sendiri.
Future<void> configureDependencies() async {
  // Idempoten: pemanggilan kedua di isolate yang sama tidak merusak apa pun.
  if (getIt.isRegistered<AppDatabase>()) return;

  // ── Konfigurasi & penyimpanan rahasia ──────────────────────────────────────
  final AppConfig config = AppConfig.fromEnvironment();
  getIt.registerSingleton<AppConfig>(config);

  final SecureStorageService storage = SecureStorageService();
  getIt.registerSingleton<SecureStorageService>(storage);

  // ── Basis data — harus terbuka sebelum DAO mana pun dapat didaftarkan ──────
  final AppDatabase database = await openAppDatabase(storage);
  getIt.registerSingleton<AppDatabase>(database);

  getIt
    ..registerSingleton<MasterDao>(database.masterDao)
    ..registerSingleton<ShiftDao>(database.shiftDao)
    ..registerSingleton<TransactionDao>(database.transactionDao)
    ..registerSingleton<WasteDao>(database.wasteDao)
    ..registerSingleton<HeldCartDao>(database.heldCartDao)
    ..registerSingleton<SyncDao>(database.syncDao);

  // ── Jaringan ───────────────────────────────────────────────────────────────
  final ClockSkewMonitor clockSkew = ClockSkewMonitor();
  getIt.registerSingleton<ClockSkewMonitor>(clockSkew);

  getIt.registerSingleton<ConnectivityMonitor>(ConnectivityMonitor());

  final ApiClient apiClient = ApiClient(
    config: config,
    storage: storage,
    clockSkewMonitor: clockSkew,
  );
  getIt.registerSingleton<ApiClient>(apiClient);

  // ── Kriptografi ────────────────────────────────────────────────────────────
  getIt.registerSingleton<PinVerifier>(const PinVerifier());

  // ── Repository — kontrak milik domain, implementasi milik data ─────────────
  getIt.registerSingleton<DeviceRepository>(
    DeviceRepositoryImpl(
      remote: DeviceRemoteDataSource(apiClient),
      local: MasterLocalDataSource(getIt<MasterDao>(), getIt<SyncDao>()),
      storage: storage,
    ),
  );

  getIt.registerSingleton<AuthRepository>(
    AuthRepositoryImpl(
      masterDao: getIt<MasterDao>(),
      verifier: getIt<PinVerifier>(),
    ),
  );

  getIt.registerSingleton<ShiftRepository>(
    ShiftRepositoryImpl(
      dao: getIt<ShiftDao>(),
      transactionDao: getIt<TransactionDao>(),
    ),
  );

  getIt
    ..registerSingleton<HistoryRepository>(
      HistoryRepositoryImpl(
        dao: getIt<TransactionDao>(),
        remote: HistoryRemoteDataSource(apiClient),
      ),
    )
    ..registerSingleton<WasteRepository>(
      WasteRepositoryImpl(dao: getIt<WasteDao>()),
    );

  getIt
    ..registerSingleton<CatalogRepository>(
      CatalogRepositoryImpl(getIt<MasterDao>()),
    )
    ..registerSingleton<RegisterRepository>(
      RegisterRepositoryImpl(dao: getIt<TransactionDao>()),
    )
    ..registerSingleton<HeldCartRepository>(
      HeldCartRepositoryImpl(dao: getIt<HeldCartDao>()),
    );

  // ── Printer ────────────────────────────────────────────────────────────────
  //
  // `PrinterManager` mengimplementasikan `ReceiptPrinter`, sehingga
  // `TransactionCubit` tidak berubah sama sekali saat printer sungguhan
  // menggantikan `NoopReceiptPrinter` dari M4 — itulah gunanya kontrak.
  final PrinterManager printerManager = PrinterManager(
    registry: PrinterRegistry(),
    preferences: PrinterPreferences(getIt<SyncDao>()),
  );
  getIt
    ..registerSingleton<PrinterManager>(printerManager)
    ..registerSingleton<ReceiptPrinter>(printerManager);

  // ── Mesin sinkronisasi ─────────────────────────────────────────────────────
  final SyncEngine syncEngine = SyncEngine(
    remote: SyncRemoteDataSource(apiClient),
    reconciler: Reconciler(
      database: database,
      shiftDao: getIt<ShiftDao>(),
      transactionDao: getIt<TransactionDao>(),
      wasteDao: getIt<WasteDao>(),
    ),
    shiftDao: getIt<ShiftDao>(),
    transactionDao: getIt<TransactionDao>(),
    wasteDao: getIt<WasteDao>(),
    syncDao: getIt<SyncDao>(),
    connectivity: getIt<ConnectivityMonitor>(),
    storage: storage,
  );
  getIt
    ..registerSingleton<SyncEngine>(syncEngine)
    ..registerSingleton<SyncTriggers>(
      SyncTriggers(
        engine: syncEngine,
        connectivity: getIt<ConnectivityMonitor>(),
      ),
    );

  // ── Cubit berumur panjang ──────────────────────────────────────────────────
  //
  // Ketiganya hidup selama aplikasi berjalan karena lintas layar:
  // `CashierAuthCubit` dibaca StatusBar dan gerbang keluar Kiosk, `ShiftCubit`
  // menyimak stream Drift, dan `MasterSyncCubit` dapat dipicu dari P-14 maupun
  // dari gerbang navigasi. Cubit berumur pendek (mis. `DeviceBindingCubit`)
  // sengaja TIDAK didaftarkan — layarnya membuat dan membuangnya sendiri.
  getIt
    ..registerSingleton<MasterSyncCubit>(
      MasterSyncCubit(getIt<DeviceRepository>()),
    )
    ..registerSingleton<CashierAuthCubit>(
      CashierAuthCubit(getIt<AuthRepository>()),
    )
    ..registerSingleton<ShiftCubit>(ShiftCubit(getIt<ShiftRepository>()))
    ..registerSingleton<HeldCartCubit>(
      HeldCartCubit(getIt<HeldCartRepository>()),
    )
    ..registerSingleton<PrinterCubit>(PrinterCubit(getIt<PrinterManager>()))
    ..registerSingleton<WasteCubit>(WasteCubit(getIt<WasteRepository>()))
    ..registerSingleton<KioskCubit>(
      KioskCubit(
        service: KioskService(),
        guard: KioskGuard(masterDao: getIt<MasterDao>()),
        heldCarts: getIt<HeldCartRepository>(),
      ),
    )
    ..registerSingleton<SyncCubit>(
      SyncCubit(
        engine: getIt<SyncEngine>(),
        transactionDao: getIt<TransactionDao>(),
        connectivity: getIt<ConnectivityMonitor>(),
        clockSkew: getIt<ClockSkewMonitor>(),
      ),
    );
}

/// Membongkar seluruh dependensi.
///
/// Dipakai pengujian integrasi dan saat isolate latar selesai bekerja. Menutup
/// sumber daya secara eksplisit — `StreamController` yang tidak ditutup akan
/// menahan isolate WorkManager tetap hidup lebih lama daripada seharusnya.
Future<void> resetDependencies() async {
  if (getIt.isRegistered<SyncTriggers>()) {
    await getIt<SyncTriggers>().dispose();
  }
  if (getIt.isRegistered<SyncCubit>()) await getIt<SyncCubit>().close();
  if (getIt.isRegistered<HeldCartCubit>()) {
    await getIt<HeldCartCubit>().close();
  }
  if (getIt.isRegistered<KioskCubit>()) await getIt<KioskCubit>().close();
  if (getIt.isRegistered<WasteCubit>()) await getIt<WasteCubit>().close();
  if (getIt.isRegistered<PrinterCubit>()) await getIt<PrinterCubit>().close();
  if (getIt.isRegistered<PrinterManager>()) {
    await getIt<PrinterManager>().dispose();
  }
  if (getIt.isRegistered<ShiftCubit>()) await getIt<ShiftCubit>().close();
  if (getIt.isRegistered<CashierAuthCubit>()) {
    await getIt<CashierAuthCubit>().close();
  }
  if (getIt.isRegistered<MasterSyncCubit>()) {
    await getIt<MasterSyncCubit>().close();
  }
  if (getIt.isRegistered<ApiClient>()) {
    final ApiClient client = getIt<ApiClient>();
    await client.deviceTokenInterceptor.dispose();
    client.dispose();
  }
  if (getIt.isRegistered<ConnectivityMonitor>()) {
    await getIt<ConnectivityMonitor>().dispose();
  }
  if (getIt.isRegistered<ClockSkewMonitor>()) {
    await getIt<ClockSkewMonitor>().dispose();
  }
  if (getIt.isRegistered<AppDatabase>()) {
    await getIt<AppDatabase>().close();
  }
  await getIt.reset();
}
