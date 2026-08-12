import 'package:posgodinov_mobile/features/device/domain/entities/device_session.dart';
import 'package:posgodinov_mobile/features/device/domain/entities/master_snapshot.dart';

/// Kontrak pemasangan perangkat dan penarikan master data.
///
/// Dideklarasikan di lapisan **domain** dan diimplementasikan di **data** —
/// pembalikan dependensi yang sama seperti `domain.XxxRepository` di backend Go
/// ([01 §1]).
abstract interface class DeviceRepository {
  /// Mengikat perangkat ke satu outlet dan menyimpan device token.
  ///
  /// Melempar `Failure` bila gagal. Perhatikan: endpoint menjawab **`200`**,
  /// bukan `201` ([03 §2.1]).
  Future<DeviceSession> bind({
    required String serialBusiness,
    required String serialOutlet,
    required String password,
  });

  /// `true` bila perangkat sudah pernah di-*binding*.
  Future<bool> isBound();

  /// Menarik seluruh master data dan menyimpannya ke basis data lokal.
  ///
  /// Tidak ada sinkronisasi inkremental — setiap panggilan menarik **seluruh**
  /// data ([03 §2.2]), jadi jangan menjadwalkannya berkala.
  Future<MasterSnapshot> syncMasterData();

  /// Kapan master data terakhir ditarik. `null` bila belum pernah.
  Future<DateTime?> lastMasterSyncAt();

  /// `true` bila snapshot lokal lebih tua dari ambang [04 §A.2] (12 jam).
  Future<bool> isMasterDataStale();

  /// `true` bila belum ada master data sama sekali di perangkat.
  Future<bool> isMasterDataEmpty();
}
