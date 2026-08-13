import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:posgodinov_mobile/core/database/daos/held_cart_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/master_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/shift_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/waste_dao.dart';
import 'package:posgodinov_mobile/core/database/tables/categories_table.dart';
import 'package:posgodinov_mobile/core/database/tables/held_carts_table.dart';
import 'package:posgodinov_mobile/core/database/tables/products_table.dart';
import 'package:posgodinov_mobile/core/database/tables/shifts_table.dart';
import 'package:posgodinov_mobile/core/database/tables/staffs_table.dart';
import 'package:posgodinov_mobile/core/database/tables/sync_logs_table.dart';
import 'package:posgodinov_mobile/core/database/tables/sync_meta_table.dart';
import 'package:posgodinov_mobile/core/database/tables/transaction_items_table.dart';
import 'package:posgodinov_mobile/core/database/tables/transactions_table.dart';
import 'package:posgodinov_mobile/core/database/tables/wastes_table.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/storage/secure_storage_service.dart';

part 'app_database.g.dart';

/// Nama berkas basis data di direktori dokumen aplikasi.
const String kDatabaseFileName = 'posgodinov.db';

/// **Sumber kebenaran POS di perangkat.**
///
/// Seluruh penjualan hidup di sini lebih dulu, lalu disinkronkan ke server —
/// bukan sebaliknya ([09 §5.1]). Server bukan cadangan: sampai sinkronisasi
/// berhasil, berkas ini adalah satu-satunya salinan penjualan yang ada.
///
/// > ⚠️ **Berkas `app_database.g.dart` dibangkitkan `build_runner`** dan belum
/// > ada di repositori. Sampai `dart run build_runner build` dijalankan, seluruh
/// > rujukan ke `_$AppDatabase`, `$TransactionsTable`, `TransactionsCompanion`,
/// > dan kelas data (`LocalTransaction`, `Product`, …) akan ditandai analyzer
/// > sebagai *undefined*. Itu **normal** dan hilang setelah generasi kode.
@DriftDatabase(
  tables: <Type>[
    // Master data — datang dari server, dapat dibuang & ditarik ulang.
    Staffs,
    Categories,
    Products,
    // Data transaksional — dibuat perangkat, TIDAK PERNAH boleh hilang.
    Shifts,
    Transactions,
    TransactionItems,
    Wastes,
    // Murni lokal.
    HeldCarts,
    // Keadaan mesin sinkronisasi.
    SyncMeta,
    SyncLogs,
  ],
  daos: <Type>[
    MasterDao,
    ShiftDao,
    TransactionDao,
    WasteDao,
    HeldCartDao,
    SyncDao,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  /// Skema v1 memuat **kesepuluh** tabel sekaligus.
  ///
  /// Mendefinisikan sebagian dulu lalu menambah sisanya berarti migrasi v1→v2
  /// pada perangkat yang sudah membawa antrean penjualan — risiko yang tidak
  /// sebanding dengan penghematan menulis empat berkas tabel.
  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (Migrator m) async {
          await m.createAll();

          // Antrean sync dibaca dengan filter+urutan ini setiap 5 menit dan
          // pada setiap transaksi baru. Tanpa indeks, pembacaannya menjadi
          // full table scan yang tumbuh sepanjang umur perangkat ([09 §5.1]).
          await customStatement(
            'CREATE INDEX idx_tx_queue ON transactions (synced, client_created_at)',
          );
          await customStatement(
            'CREATE INDEX idx_tx_shift ON transactions (shift_id)',
          );
          await customStatement(
            'CREATE INDEX idx_tx_item_parent ON transaction_items (transaction_id)',
          );
          await customStatement(
            'CREATE INDEX idx_waste_queue ON wastes (synced, client_created_at)',
          );
          await customStatement(
            'CREATE INDEX idx_shift_status ON shifts (status, client_opened_at)',
          );
          // Login kasir mencari staff lewat identifier pada setiap percobaan.
          await customStatement(
            'CREATE INDEX idx_staff_identifier ON staffs (staff_identifier)',
          );
          await customStatement(
            'CREATE INDEX idx_product_category ON products (category_id)',
          );
        },
        beforeOpen: (OpeningDetails details) async {
          // WAJIB — SQLite mematikan foreign key secara bawaan pada setiap
          // koneksi baru. Tanpa baris ini, FK `transaction_items.transaction_id`
          // dan `transactions.shift_id` hanya menjadi dokumentasi ([09 §5.1]).
          await customStatement('PRAGMA foreign_keys = ON');

          // Write-Ahead Logging: pembacaan (grid produk, StatusBar) tidak
          // terblokir oleh penulisan (transaksi baru, batch sync).
          await customStatement('PRAGMA journal_mode = WAL');

          // Menunggu hingga 5 detik bila basis data sedang terkunci proses lain
          // — mis. isolate WorkManager yang sedang menyinkronkan di latar.
          await customStatement('PRAGMA busy_timeout = 5000');
        },
      );
}

/// Membuka basis data aplikasi.
///
/// `createInBackground` menjalankan SQLite di **isolate terpisah**, sehingga
/// batch sync 200 transaksi tidak membekukan UI kasir ([09 §5.1]).
///
/// [storage] belum dipakai selama enkripsi masih menunggu keputusan tim
/// ([09 §1.4]). Parameternya sengaja sudah ada agar mengaktifkan SQLCipher
/// kelak hanya menyentuh berkas ini.
Future<AppDatabase> openAppDatabase(SecureStorageService storage) async {
  final Directory dir = await getApplicationDocumentsDirectory();
  final File file = File(p.join(dir.path, kDatabaseFileName));

  return AppDatabase(
    NativeDatabase.createInBackground(
      file,
      // ── Opsi A [09 §1.4] — aktifkan bersama `sqlcipher_flutter_libs` ───────
      //
      // Berkas ini memuat `pin_hash` bcrypt SELURUH kasir outlet ([03 §2.2]).
      // PIN hanya 4–6 digit, jadi siapa pun yang memperoleh berkasnya dapat
      // melakukan brute force offline dalam hitungan menit.
      //
      // Mengaktifkan: ganti `sqlite3_flutter_libs` → `sqlcipher_flutter_libs`
      // di pubspec (KEDUANYA TIDAK BOLEH terpasang bersamaan — bentrok simbol
      // `sqlite3_open`), lalu buka komentar tiga baris berikut:
      //
      // setup: (Database raw) {
      //   raw.execute("PRAGMA key = '${await storage.getOrCreateDatabaseKey()}'");
      // },
    ),
  );
}
