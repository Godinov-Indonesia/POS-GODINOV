import 'package:drift/drift.dart';

/// Katalog produk hasil `GET /v1/pos/sync/master-data` ([03 §2.2]).
///
/// > ⚠️ **Payload master data TIDAK memuat stok maupun resep (BOM).** Kode
/// > backend menyebutnya *"SENGAJA DIHAPUS dari payload klien"*. Karena itu
/// > tabel ini tidak punya kolom stok, dan layar kasir maupun Kiosk **dilarang**
/// > menampilkan penanda "habis" ([09 §9.5]).
@DataClassName('Product')
class Products extends Table {
  /// UUID produk dari server.
  TextColumn get id => text()();

  TextColumn get name => text()();

  /// **INTEGER SEN** (ADR-05). Server mengirim Rupiah (`22000`); konversi
  /// `Money.toMinor()` terjadi di batas API, bukan di sini ([09 §3.5]).
  IntColumn get priceMinor => integer()();

  TextColumn get imageUrl => text().nullable()();

  /// Sengaja **tanpa** foreign key ke [Categories].
  ///
  /// Master data ditarik utuh setiap kali disinkronkan dan tidak punya jaminan
  /// urutan; produk yang kategorinya sudah dihapus pemilik akan menolak masuk
  /// bila FK ditegakkan, sehingga **satu baris yatim menggagalkan seluruh sync
  /// master**. Baris yatim direkonsiliasi di lapisan data ([05 §Fase 9]).
  TextColumn get categoryId => text().nullable()();

  /// Waktu snapshot master data yang membawa baris ini — dipakai membuang
  /// produk yang hilang dari payload terbaru.
  DateTimeColumn get syncedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
