import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/master_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/features/device/data/models/master_data_dto.dart';

/// Menyimpan master data ke Drift.
class MasterLocalDataSource {
  const MasterLocalDataSource(this._masterDao, this._syncDao);

  final MasterDao _masterDao;
  final SyncDao _syncDao;

  /// Menulis snapshot dan mencatat waktunya.
  ///
  /// Memakai `MasterDao.replaceSnapshot` yang melakukan **upsert lalu membuang
  /// baris yatim** — bukan `delete()` diikuti `insert()`. Mengosongkan tabel
  /// lebih dulu meninggalkan jendela waktu ketika perangkat tidak punya daftar
  /// staff sama sekali; proses yang mati tepat di jendela itu membuat kasir
  /// tidak dapat login sampai ada koneksi ([09 §5.1]).
  Future<void> saveSnapshot(MasterDataDto data, DateTime syncedAt) async {
    await _masterDao.replaceSnapshot(
      syncedAt: syncedAt,
      staffs: data.staffs
          .map(
            (StaffDto s) => StaffsCompanion.insert(
              id: s.id,
              staffIdentifier: s.staffIdentifier,
              name: s.name,
              pinHash: s.pinHash,
              role: Value<String>(s.role),
              permissionsJson: Value<String>(jsonEncode(s.permissions)),
              syncedAt: syncedAt,
            ),
          )
          .toList(growable: false),
      categories: data.categories
          .map(
            (CategoryDto c) => CategoriesCompanion.insert(
              id: c.id,
              name: c.name,
              description: Value<String>(c.description),
              syncedAt: syncedAt,
            ),
          )
          .toList(growable: false),
      products: data.products
          .map(
            (ProductDto p) => ProductsCompanion.insert(
              id: p.id,
              name: p.name,
              // Sudah dalam INTEGER SEN — konversi terjadi di ProductDto.
              priceMinor: p.priceMinor,
              imageUrl: Value<String?>(p.imageUrl),
              categoryId: Value<String?>(p.categoryId),
              syncedAt: syncedAt,
            ),
          )
          .toList(growable: false),
    );

    await _syncDao.writeMeta(
      SyncMetaKeys.masterDataSyncedAt,
      syncedAt.millisecondsSinceEpoch.toString(),
      syncedAt,
    );

    // ── BUTIR 10 — versi yang DIPEGANG perangkat ([11 §M15.1]) ────────────
    //
    // `version` absen pada server pra-v2. Nilai lama sengaja TIDAK ditimpa
    // dalam kasus itu: menimpanya akan menghapus versi sah yang sudah dipegang
    // perangkat hanya karena satu penarikan menemui backend lama, dan gerbang
    // Buka Shift akan memblokir outlet yang sebenarnya baik-baik saja.
    if (data.version != null) {
      await _syncDao.writeMeta(
        SyncMetaKeys.masterDataVersion,
        data.version.toString(),
        syncedAt,
      );
    }

    // Blok kebijakan ([11 §4.4]).
    if (data.config != null) {
      await _syncDao.writeMeta(
        SyncMetaKeys.remoteConfig,
        jsonEncode(data.config),
        syncedAt,
      );
    }
  }

  Future<DateTime?> lastSyncedAt() => _syncDao.masterDataSyncedAt();

  Future<bool> isStale(DateTime now) => _syncDao.isMasterDataStale(now);

  Future<bool> isEmpty() => _masterDao.isEmpty();
}
