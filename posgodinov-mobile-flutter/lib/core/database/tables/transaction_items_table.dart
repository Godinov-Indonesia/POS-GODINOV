import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/database/tables/transactions_table.dart';

/// Baris item transaksi.
///
/// Berbeda dari Dexie yang menyimpan `items` bersarang di dalam dokumen
/// transaksi ([05 §1.5.1]), Drift bersifat **relasional**: item adalah tabel
/// tersendiri dengan foreign key. Penyusunan ulang menjadi payload bersarang
/// terjadi di `core/sync/wire_mapper.dart` ([09 §6.2]).
///
/// Keuntungannya nyata: `insertWithItems` berjalan dalam satu transaksi SQLite,
/// sehingga **tidak mungkin** ada transaksi tersimpan tanpa itemnya.
@DataClassName('LocalTransactionItem')
class TransactionItems extends Table {
  /// UUID v4 dibuat KLIEN saat item masuk keranjang, tidak pernah diganti.
  TextColumn get id => text()();

  /// FK ditegakkan. `PRAGMA foreign_keys = ON` dipasang di `beforeOpen`
  /// karena SQLite mematikannya secara bawaan ([09 §5.1]).
  TextColumn get transactionId => text().references(Transactions, #id)();

  /// Sengaja **tanpa** foreign key ke [Products].
  ///
  /// Produk dapat dihapus pemilik lewat Dashboard dan lenyap dari sync master
  /// berikutnya. Baris penjualan yang sudah terjadi tidak boleh ikut hilang —
  /// karena itu [productName] disimpan sebagai salinan, bukan hasil join.
  TextColumn get productId => text()();

  /// Salinan nama produk saat penjualan terjadi.
  ///
  /// Untuk struk dan riwayat. Nama yang berubah di master data **tidak** boleh
  /// mengubah struk yang sudah dicetak.
  TextColumn get productName => text()();

  IntColumn get quantity => integer()();

  /// **INTEGER SEN** — *snapshot* harga saat item ditambahkan ke keranjang.
  ///
  /// Sync master di tengah transaksi tidak mengubah nilai ini; pelanggan
  /// membayar harga yang ditunjukkan saat item dipilih ([09 §7.2]).
  IntColumn get unitPriceMinor => integer()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
