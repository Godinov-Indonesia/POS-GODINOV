import 'package:drift/drift.dart';

/// Laporan waste **produk jadi** dari kasir — P-11 ([02 §2.14]).
///
/// > ⚠️ Kunci payload sinkronisasi adalah **`wastes`**, bukan `product_wastes`.
/// > `CLIENTS.md` backend menyebut `product_wastes` dan itu **keliru**; struct
/// > Go-nya `Wastes []*ProductWaste \`json:"wastes"\`` ([03 §2.3]). Memakai nama
/// > yang salah membuat data waste diabaikan server **tanpa error apa pun**.
///
/// Kegagalan waste tidak dilaporkan per-ID oleh backend — hanya lewat selisih
/// hitungan `wastes_synced`, sehingga rekonsiliasi memperlakukan seluruh batch
/// sebagai satu kesatuan ([09 §6.3]).
@DataClassName('LocalWaste')
class Wastes extends Table {
  /// UUID v4 dibuat KLIEN.
  TextColumn get id => text()();

  /// Tanpa FK ke `staffs` — staff yang dihapus pemilik lenyap dari sync master
  /// berikutnya, dan laporan waste yang sudah terjadi tidak boleh ikut hilang.
  TextColumn get staffId => text()();

  /// Tanpa FK — produk dapat lenyap dari master data setelah waste dilaporkan.
  TextColumn get productId => text()();

  /// Salinan nama produk untuk tampilan riwayat waste.
  TextColumn get productName => text()();

  IntColumn get quantity => integer()();

  TextColumn get reason => text()();

  DateTimeColumn get clientCreatedAt => dateTime()();

  // ── Metadata lokal — TIDAK PERNAH dikirim ke server ────────────────────────

  BoolColumn get synced => boolean().withDefault(const Constant(false))();

  TextColumn get syncError => text().nullable()();

  IntColumn get syncAttempts => integer().withDefault(const Constant(0))();

  DateTimeColumn get lastSyncAttemptAt => dateTime().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
