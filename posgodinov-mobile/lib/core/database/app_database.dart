import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:posgodinov_mobile/core/database/daos/held_cart_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/master_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/print_job_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/return_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/security_event_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/shift_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/void_log_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/waste_dao.dart';
import 'package:posgodinov_mobile/core/database/tables/categories_table.dart';
import 'package:posgodinov_mobile/core/database/tables/held_carts_table.dart';
import 'package:posgodinov_mobile/core/database/tables/print_jobs_table.dart';
import 'package:posgodinov_mobile/core/database/tables/products_table.dart';
import 'package:posgodinov_mobile/core/database/tables/return_items_table.dart';
import 'package:posgodinov_mobile/core/database/tables/returns_table.dart';
import 'package:posgodinov_mobile/core/database/tables/security_events_table.dart';
import 'package:posgodinov_mobile/core/database/tables/shifts_table.dart';
import 'package:posgodinov_mobile/core/database/tables/staffs_table.dart';
import 'package:posgodinov_mobile/core/database/tables/sync_logs_table.dart';
import 'package:posgodinov_mobile/core/database/tables/sync_meta_table.dart';
import 'package:posgodinov_mobile/core/database/tables/transaction_items_table.dart';
import 'package:posgodinov_mobile/core/database/tables/transaction_payments_table.dart';
import 'package:posgodinov_mobile/core/database/tables/transactions_table.dart';
import 'package:posgodinov_mobile/core/database/tables/void_logs_table.dart';
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
    // v2 — audit & multi-tender ([11 §3.2]).
    TransactionPayments,
    Returns,
    ReturnItems,
    VoidLogs,
    SecurityEvents,
    // Murni lokal.
    HeldCarts,
    PrintJobs,
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
    // v2.
    ReturnDao,
    VoidLogDao,
    SecurityEventDao,
    PrintJobDao,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  /// **v1** memuat kesepuluh tabel dasar sekaligus.
  ///
  /// **v2** (Fase M11.5) menambahkan enam tabel audit & multi-tender beserta
  /// kolom baru pada `transactions`, `shifts`, dan `wastes` ([11 §3.7]).
  ///
  /// ## Migrasi ini bersifat MURNI ADITIF
  ///
  /// Tidak ada kolom yang dihapus, tidak ada tipe yang berubah, dan tidak ada
  /// tabel yang dibangun ulang. Alasannya bukan kerapian: berkas ini memuat
  /// **antrean penjualan yang belum tersinkron** — uang yang sudah diterima
  /// tetapi belum pernah sampai ke server. Migrasi yang merusaknya menghapus
  /// satu-satunya salinan yang ada.
  @override
  int get schemaVersion => 2;

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
        onUpgrade: (Migrator m, int from, int to) async {
          if (from < 2) {
            // ── Tabel baru ────────────────────────────────────────────────
            //
            // Urutan penting: `return_items` memiliki FK ke `returns`, jadi
            // induknya harus ada lebih dulu.
            await m.createTable(transactionPayments);
            await m.createTable(returns);
            await m.createTable(returnItems);
            await m.createTable(voidLogs);
            await m.createTable(securityEvents);
            await m.createTable(printJobs);

            // ── Kolom baru pada tabel yang sudah ada ──────────────────────
            //
            // Seluruhnya nullable atau ber-`withDefault`; `ALTER TABLE ADD
            // COLUMN` di SQLite menolak kolom NOT NULL tanpa nilai bawaan.
            await m.addColumn(transactions, transactions.receiptPrintedAt);
            await m.addColumn(transactions, transactions.reprintCount);
            await m.addColumn(transactions, transactions.shortCode);
            await m.addColumn(transactions, transactions.returnState);
            await m.addColumn(transactions, transactions.deviceId);
            await m.addColumn(transactions, transactions.voidedAt);
            await m.addColumn(transactions, transactions.voidedBy);
            await m.addColumn(transactions, transactions.voidReasonCode);

            await m.addColumn(shifts, shifts.declaredCashMinor);
            await m.addColumn(shifts, shifts.declaredEdcTotalMinor);
            await m.addColumn(shifts, shifts.declaredQrisTotalMinor);
            await m.addColumn(shifts, shifts.blindClose);
            await m.addColumn(shifts, shifts.masterDataVersion);
            await m.addColumn(shifts, shifts.deviceId);
            await m.addColumn(shifts, shifts.closedBy);

            // Otorisasi offline (butir 12, M15.2). Disatukan ke migrasi v2
            // dengan alasan yang sama seperti kolom karantina di bawah: v2
            // belum pernah dirilis ke perangkat mana pun.
            await m.addColumn(staffs, staffs.role);
            await m.addColumn(staffs, staffs.permissionsJson);

            await m.addColumn(wastes, wastes.reasonCode);
            await m.addColumn(wastes, wastes.shiftId);
            await m.addColumn(wastes, wastes.deviceId);
            await m.addColumn(wastes, wastes.receiptPrinted);
            await m.addColumn(wastes, wastes.printedAt);

            // KARANTINA ([11 §4.3], ditambahkan pada Fase M12.3).
            //
            // Disatukan ke migrasi v2 — BUKAN v3 — karena v2 belum pernah
            // dirilis ke perangkat mana pun. Memecahnya menjadi dua migrasi
            // hanya menambah satu langkah yang harus dijalankan benar di
            // lapangan tanpa menambah satu pun jaminan.
            await m.addColumn(transactions, transactions.quarantined);
            await m.addColumn(shifts, shifts.quarantined);
            await m.addColumn(wastes, wastes.quarantined);

            // ── Backfill ──────────────────────────────────────────────────
            //
            // ⚠️ KEPUTUSAN YANG TIDAK BOLEH DIBALIK TANPA DISKUSI.
            //
            // Struk v1 SELALU dicetak saat commit ([09 §7.3]), jadi setiap
            // transaksi lama memang sudah berpindah tangan sebagai kertas.
            // Membiarkan `receipt_printed_at` kosong akan membuka jalur VOID
            // untuk seluruh transaksi lampau — persis yang butir 15 larang,
            // dan persis lubang yang v2 dibangun untuk menutupnya ([11 §2.1]).
            await customStatement(
              'UPDATE transactions SET receipt_printed_at = client_created_at '
              'WHERE receipt_printed_at IS NULL',
            );

            // Satu tender tunggal yang merekonstruksi keadaan v1: seluruh
            // nominal dibayar dengan satu metode. Invarian
            // `Σ amount_minor == total_amount_minor` berlaku sejak baris
            // pertama, sehingga sisi server tidak perlu mengenal dua bentuk.
            //
            // `id` sengaja MEMAKAI ULANG UUID transaksi — deterministik. UUID
            // acak akan membuat percobaan ulang menyisipkan tender ganda di
            // server; `ON CONFLICT (id)` hanya melindungi bila id-nya stabil
            // ([11 §1] aturan R2). Tabelnya berbeda, jadi tidak ada tabrakan.
            //
            // `trace_number`/`card_last4` DIBIARKAN NULL untuk baris DEBIT
            // lama — mengarangnya berarti memalsukan bukti audit.
            await customStatement(
              'INSERT INTO transaction_payments '
              '(id, transaction_id, sequence, method, amount_minor) '
              'SELECT id, id, 1, payment_method, total_amount_minor '
              'FROM transactions '
              'WHERE id NOT IN (SELECT transaction_id FROM transaction_payments)',
            );

            // Kasir v1 menghitung dan MELIHAT angka penutupan; nilainya tetap
            // dipakai sebagai deklarasi historis agar shift lama tidak kosong
            // di laporan. `blind_close` tetap `false` — menandainya sebagai
            // kesaksian buta berarti berbohong pada audit.
            await customStatement(
              'UPDATE shifts SET declared_cash_minor = closing_balance_minor '
              'WHERE declared_cash_minor = 0',
            );

            // ── Indeks ────────────────────────────────────────────────────
            //
            // Tanpa indeks, setiap pembacaan antrean menjadi full table scan
            // yang tumbuh sepanjang umur perangkat ([09 §5.1]).
            await customStatement(
              'CREATE INDEX IF NOT EXISTS idx_tx_shift_created '
              'ON transactions (shift_id, client_created_at DESC)',
            );
            // Butir 16 — pencarian Kode Struk. TIDAK unik: tabrakan diputus
            // server dengan 409 lalu klien membuat ulang suffix ([11 §3.2]).
            await customStatement(
              'CREATE INDEX IF NOT EXISTS idx_tx_short_code '
              'ON transactions (short_code)',
            );
            await customStatement(
              'CREATE INDEX IF NOT EXISTS idx_tx_payment_parent '
              'ON transaction_payments (transaction_id)',
            );
            await customStatement(
              'CREATE INDEX IF NOT EXISTS idx_return_queue '
              'ON returns (synced, client_created_at)',
            );
            await customStatement(
              'CREATE INDEX IF NOT EXISTS idx_return_original '
              'ON returns (original_transaction_id)',
            );
            await customStatement(
              'CREATE INDEX IF NOT EXISTS idx_return_item_parent '
              'ON return_items (return_id)',
            );
            await customStatement(
              'CREATE INDEX IF NOT EXISTS idx_void_queue '
              'ON void_logs (synced, client_created_at)',
            );
            await customStatement(
              'CREATE INDEX IF NOT EXISTS idx_void_shift '
              'ON void_logs (shift_id, client_created_at)',
            );
            await customStatement(
              'CREATE INDEX IF NOT EXISTS idx_sec_queue '
              'ON security_events (synced, client_created_at)',
            );
            // Antrean dibaca dengan filter `synced = 0 AND quarantined = 0`;
            // tanpa indeks ini, setiap pembacaan memindai seluruh tabel yang
            // tumbuh sepanjang umur perangkat.
            await customStatement(
              'CREATE INDEX IF NOT EXISTS idx_tx_quarantine '
              'ON transactions (quarantined)',
            );
            await customStatement(
              'CREATE INDEX IF NOT EXISTS idx_print_job_status '
              'ON print_jobs (status, created_at)',
            );
            await customStatement(
              'CREATE INDEX IF NOT EXISTS idx_print_job_ref '
              'ON print_jobs (ref_type, ref_id)',
            );
          }
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
