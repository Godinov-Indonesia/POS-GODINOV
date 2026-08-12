import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/sync/sync_engine.dart';
import 'package:posgodinov_mobile/core/sync/sync_models.dart';
import 'package:workmanager/workmanager.dart';

/// Nama unik tugas periodik. Dipakai juga untuk membatalkannya.
const String kBackgroundSyncTask = 'pos-sync';

/// Titik masuk isolate latar.
///
/// > **`@pragma('vm:entry-point')` wajib.** Tanpa anotasi ini, *tree shaking*
/// > pada build release membuang fungsi ini — dan sinkronisasi latar berhenti
/// > bekerja **hanya di release**, tidak pernah terlihat saat debug.
///
/// # Isolate latar tidak mewarisi apa pun
///
/// Isolate ini dibuat WorkManager dari nol: tidak ada `getIt` yang sudah terisi,
/// tidak ada basis data yang sudah terbuka, tidak ada plugin yang sudah
/// terdaftar. Seluruh dependensi **dirakit ulang** di sini, lalu dibongkar lagi
/// setelah selesai ([09 §6.4]).
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((String task, Map<String, dynamic>? _) async {
    WidgetsFlutterBinding.ensureInitialized();

    try {
      await configureDependencies();

      final SyncOutcome outcome =
          await getIt<SyncEngine>().syncUp(SyncTrigger.background);

      if (kDebugMode) {
        debugPrint(
          '[bg-sync] ok=${outcome.ok} '
          'tx=${outcome.transactionsSynced} '
          'skip=${outcome.skipped?.name ?? '-'}',
        );
      }

      // `false` menyuruh WorkManager menjadwalkan ulang dengan backoff-nya
      // sendiri. Putaran yang DILEWATI — offline, backoff internal, antrean
      // kosong — bukan kegagalan; melaporkannya sebagai gagal membuat
      // WorkManager mundur padahal tidak ada yang salah.
      return !outcome.shouldRetry;
    } on Object catch (e, stack) {
      if (kDebugMode) {
        debugPrint('[bg-sync] gagal: $e');
        debugPrintStack(stackTrace: stack);
      }
      return false;
    } finally {
      // Basis data WAJIB ditutup. Koneksi SQLite yang menggantung di isolate
      // latar bertabrakan dengan isolate UI saat kasir membuka aplikasi, dan
      // gejalanya adalah "database is locked" yang muncul acak.
      await resetDependencies();
    }
  });
}

/// Penjadwal sinkronisasi latar.
///
/// # Yang diperbaiki fase ini
///
/// Batasan [05 §1.6.6] — *"sinkronisasi hanya berjalan saat aplikasi terbuka"* —
/// hilang. Tablet yang tertinggal menyala di outlet akan menyinkronkan penjualan
/// kemarin tanpa ada yang menyentuhnya.
///
/// Pembungkus tipis di atas kanal platform; **tidak ada uji unitnya**, dan itu
/// disengaja — yang layak diuji di sini hanya perilaku sistem operasi, dan
/// itulah yang dijadwalkan sebagai uji lapangan.
class BackgroundSync {
  const BackgroundSync();

  /// Interval minimum yang diizinkan Android. Meminta lebih rapat tidak
  /// menghasilkan apa pun — sistem tetap membulatkannya ke 15 menit.
  static const Duration frequency = Duration(minutes: 15);

  Future<void> initialize({bool debug = false}) =>
      Workmanager().initialize(callbackDispatcher, isInDebugMode: debug);

  /// Menjadwalkan tugas periodik.
  ///
  /// `ExistingWorkPolicy.keep` membuat pemanggilan berulang **tidak** memulai
  /// ulang jadwal: memanggilnya di setiap start aplikasi akan menggeser jadwal
  /// terus-menerus sehingga tugasnya tidak pernah benar-benar berjalan.
  ///
  /// `NetworkType.connected` menghemat baterai — tidak ada gunanya membangunkan
  /// isolate dan membuka basis data saat perangkat jelas offline.
  Future<void> ensureScheduled() => Workmanager().registerPeriodicTask(
        kBackgroundSyncTask,
        kBackgroundSyncTask,
        frequency: frequency,
        constraints: Constraints(networkType: NetworkType.connected),
        existingWorkPolicy: ExistingWorkPolicy.keep,
        backoffPolicy: BackoffPolicy.exponential,
        backoffPolicyDelay: const Duration(minutes: 1),
      );

  /// Dipakai saat perangkat ditolak server atau dilepas teknisi.
  Future<void> cancel() => Workmanager().cancelByUniqueName(kBackgroundSyncTask);
}
