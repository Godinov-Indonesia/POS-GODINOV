import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show FlutterView;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:posgodinov_mobile/core/config/device_profile.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/storage/secure_storage_service.dart';
import 'package:posgodinov_mobile/core/sync/background_sync_worker.dart';
import 'package:posgodinov_mobile/core/sync/sync_triggers.dart';
import 'package:posgodinov_mobile/features/printer/presentation/cubit/printer_cubit.dart';
import 'package:posgodinov_mobile/features/printing/presentation/cubit/print_queue_cubit.dart';
import 'package:posgodinov_mobile/features/sync/presentation/cubit/sync_cubit.dart';

/// Menyiapkan aplikasi sebelum bingkai pertama digambar.
///
/// Urutannya bermakna: orientasi dikunci **sebelum** UI muncul agar kasir tidak
/// pernah melihat kedipan tata letak yang salah, dan dependensi dirakit sebelum
/// layar mana pun mencoba membaca basis data.
///
/// Melempar bila perakitan dependensi gagal — basis data yang tidak dapat
/// dibuka adalah kondisi fatal, bukan sesuatu yang layak dilanjutkan dengan
/// diam-diam. Penanganannya ada di [runGuardedApp].
Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  await _lockOrientation();
  _installErrorHandlers();
  await configureDependencies();

  // Pemicu dipasang SETELAH dependensi siap, dan langsung menjalankan putaran
  // `startup` yang menangkap antrean dari sesi sebelumnya ([09 §6.4]).
  getIt<SyncTriggers>().install();

  // Indikator antrean mulai menyimak sebelum layar pertama digambar, sehingga
  // StatusBar tidak pernah menampilkan "0 antre" yang keliru selama sekejap.
  await getIt<SyncCubit>().observe();

  // Printer dipulihkan sebelum layar pertama: kasir yang membuka aplikasi
  // langsung melihat apakah printernya siap, bukan mengetahuinya saat struk
  // pertama gagal keluar.
  await getIt<PrinterCubit>().observe();

  // Antrean cetak ikut menyimak sejak awal ([11 §M14.1]).
  //
  // Ia juga melakukan `flush()` pertama di sini: struk yang tertinggal dari
  // sesi sebelumnya — printer mati saat tutup toko, misalnya — harus terbit
  // begitu perangkat menyala kembali, tanpa menunggu kasir menyadarinya.
  await getIt<PrintQueueCubit>().observe();

  await _scheduleBackgroundSync();
}

/// Menyiapkan sinkronisasi latar.
///
/// Dijadwalkan **hanya bila perangkat sudah ter-binding**: tugas periodik pada
/// perangkat yang belum dipasang akan membangunkan isolate setiap 15 menit
/// hanya untuk mendapati tidak ada token, dan itu membakar baterai tanpa hasil.
Future<void> _scheduleBackgroundSync() async {
  const BackgroundSync background = BackgroundSync();
  await background.initialize(debug: kDebugMode);

  if (await getIt<SecureStorageService>().hasDeviceToken()) {
    await background.ensureScheduled();
  }
}

/// Mengunci orientasi sesuai kelas perangkat ([09 §3.2]).
///
/// Tablet dirancang **landscape-only**: tata letak split 62/38 tidak pernah
/// diuji vertikal, dan memaksakannya menghasilkan panel keranjang setinggi
/// 300 dp yang tidak dapat dipakai. Handheld POS sebaliknya — dipegang satu
/// tangan, selalu portrait.
///
/// Penentuan memakai **sisi terpendek**, bukan lebar saat ini: saat fungsi ini
/// berjalan, perangkat bisa saja masih berorientasi portrait sehingga lebar
/// layarnya menyesatkan. Tablet 1280 × 800 memiliki sisi terpendek 800 dp,
/// handheld 720 × 1280 memiliki 360 dp — keduanya terpisah jelas oleh ambang
/// [Breakpoints.handheldMax].
Future<void> _lockOrientation() async {
  final FlutterView view =
      WidgetsBinding.instance.platformDispatcher.views.first;
  final double ratio = view.devicePixelRatio;
  final double shortestSideDp =
      math.min(view.physicalSize.width, view.physicalSize.height) / ratio;

  final bool isTablet = shortestSideDp >= Breakpoints.handheldMax;

  await SystemChrome.setPreferredOrientations(
    isTablet
        ? const <DeviceOrientation>[
            DeviceOrientation.landscapeLeft,
            DeviceOrientation.landscapeRight,
          ]
        : const <DeviceOrientation>[
            DeviceOrientation.portraitUp,
            DeviceOrientation.portraitDown,
            DeviceOrientation.landscapeLeft,
            DeviceOrientation.landscapeRight,
          ],
  );
}

/// Memasang penangkap error global.
///
/// Perangkat kasir berjalan tanpa pengawasan sepanjang shift. Error yang tidak
/// tertangkap dan hanya muncul di konsol berarti hilang selamanya — tidak ada
/// yang menyambungkan tablet outlet ke `flutter logs`.
///
/// Untuk sekarang keduanya hanya mencatat ke konsol debug. Titik ini adalah
/// tempat pelaporan kerusakan dipasang bila kelak disepakati.
void _installErrorHandlers() {
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    if (kDebugMode) {
      debugPrint('[FlutterError] ${details.exceptionAsString()}');
    }
  };

  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    if (kDebugMode) {
      debugPrint('[PlatformDispatcher] $error');
      debugPrintStack(stackTrace: stack);
    }
    // `true` = error dianggap tertangani; isolate tidak dimatikan.
    return true;
  };
}

/// Menjalankan [app] di dalam zona yang menangkap error asinkron.
///
/// [bootstrap] dijalankan **di dalam** zona yang sama supaya kegagalan membuka
/// basis data pun tertangkap dan dapat ditampilkan, alih-alih membuat aplikasi
/// mati dengan layar hitam.
void runGuardedApp(Widget Function() app) {
  runZonedGuarded<Future<void>>(
    () async {
      await bootstrap();
      runApp(app());
    },
    (Object error, StackTrace stack) {
      if (kDebugMode) {
        debugPrint('[Zona] $error');
        debugPrintStack(stackTrace: stack);
      }
    },
  );
}
