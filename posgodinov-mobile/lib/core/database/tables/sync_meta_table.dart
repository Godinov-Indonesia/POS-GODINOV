import 'package:drift/drift.dart';

/// Penyimpanan kunci–nilai untuk keadaan mesin sinkronisasi.
///
/// Menampung backoff, jumlah kegagalan beruntun, umur snapshot master data, dan
/// *clock skew* ([09 §6.4]). Daftar kuncinya ada di `SyncMetaKeys`
/// (`core/config/constants.dart`) agar tidak ada literal string berkeliaran.
///
/// Bentuk kunci–nilai dipilih dengan sadar: keadaan sync bertambah seiring waktu
/// (backoff, skew, penanda migrasi), dan setiap tambahan tidak boleh memaksa
/// kenaikan `schemaVersion` beserta migrasinya.
@DataClassName('SyncMetaEntry')
class SyncMeta extends Table {
  TextColumn get key => text()();

  TextColumn get value => text()();

  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{key};
}
