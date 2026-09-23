import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';

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

  // ── v2 ([11 §3.2] migrasi 000023) ─────────────────────────────────────────

  /// Kamus beku [ReasonCodes.wasteReasons]. Kolom [reason] v1 tetap ada sebagai
  /// catatan bebas; kode inilah yang dapat dikelompokkan laporan pemilik.
  TextColumn get reasonCode =>
      text().withDefault(const Constant(ReasonCodes.other))();

  /// Shift saat pembuangan terjadi. v1 tidak mencatatnya sama sekali, sehingga
  /// waste tidak dapat dipertanggungjawabkan ke kasir mana pun.
  TextColumn get shiftId => text().nullable()();

  TextColumn get deviceId => text().withDefault(const Constant('legacy'))();

  /// Bukti struk pembuangan terbit (butir 7).
  BoolColumn get receiptPrinted =>
      boolean().withDefault(const Constant(false))();

  DateTimeColumn get printedAt => dateTime().nullable()();

  // ── Metadata lokal — TIDAK PERNAH dikirim ke server ────────────────────────

  BoolColumn get synced => boolean().withDefault(const Constant(false))();

  /// Ditolak server secara **PERMANEN** — KARANTINA ([11 §4.3]).
  ///
  /// Berbeda dari [synced] yang menjawab "sudah sampai?", kolom ini menjawab
  /// "masih layak dicoba?". Baris berkarantina adalah baris yang alasan
  /// penolakannya TIDAK AKAN BERUBAH berapa kali pun dikirim ulang — pembayaran
  /// kartu tanpa nomor trace, retur yang melebihi kuantitas asli.
  ///
  /// Membiarkannya di antrean berarti setiap putaran sinkronisasi membawa ulang
  /// baris yang pasti ditolak, dan seluruh baris di belakangnya ikut tertahan.
  /// Karena itu ia dikeluarkan dari antrean — **bukan dihapus**. Datanya tetap
  /// utuh di perangkat dan muncul di P-13 sebagai "Butuh tindakan".
  BoolColumn get quarantined => boolean().withDefault(const Constant(false))();

  TextColumn get syncError => text().nullable()();

  IntColumn get syncAttempts => integer().withDefault(const Constant(0))();

  DateTimeColumn get lastSyncAttemptAt => dateTime().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
