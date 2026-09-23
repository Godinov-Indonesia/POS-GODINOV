import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/database/tables/returns_table.dart';

/// Baris item yang diretur ([11 §3.2] migrasi `000019`).
///
/// Sama seperti `TransactionItems`, tabel ini relasional sehingga
/// `insertWithItems` berjalan dalam satu transaksi SQLite — **tidak mungkin**
/// ada retur tersimpan tanpa itemnya.
@DataClassName('LocalReturnItem')
class ReturnItems extends Table {
  /// UUID v4 dibuat KLIEN.
  TextColumn get id => text()();

  /// FK ditegakkan ke induk — keduanya selalu lahir bersama.
  TextColumn get returnId => text().references(Returns, #id)();

  /// Baris item pada transaksi **asal**.
  ///
  /// Tanpa FK, dengan alasan yang sama seperti `Returns.originalTransactionId`:
  /// transaksi asal dapat berasal dari perangkat lain.
  TextColumn get transactionItemId => text()();

  TextColumn get productId => text()();

  /// Salinan nama produk saat retur — master data dapat berubah setelahnya.
  TextColumn get productName => text()();

  /// INT — selalu > 0. Retur nol baris bukan retur.
  IntColumn get quantity => integer()();

  /// **INTEGER SEN** — snapshot harga **asal**, bukan harga hari ini.
  ///
  /// Pelanggan menerima kembali uang yang benar-benar ia bayarkan; harga yang
  /// naik atau turun sejak itu tidak mengubah kewajiban toko.
  IntColumn get unitPriceMinor => integer()();

  /// `false` untuk barang rusak: uang kembali ke pelanggan, stok **tidak**.
  ///
  /// Inilah yang membuat retur mustahil direduksi menjadi "transaksi bernilai
  /// negatif" — arah uang dan arah barang dapat berbeda. Item ber-[restock]
  /// `false` melahirkan baris `product_wastes` di server ([11 §M13.6]).
  BoolColumn get restock => boolean().withDefault(const Constant(true))();

  /// Wajib bila [restock] `false`; memakai kamus `ReasonCodes.wasteReasons`.
  TextColumn get wasteReasonCode => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
