import 'package:drift/drift.dart';

/// Kasir outlet, beserta **hash PIN bcrypt** dari master data ([03 §2.2]).
///
/// > 🔴 **Inilah baris paling sensitif di seluruh perangkat.** Backend tidak
/// > memiliki endpoint login kasir ([01 §4.5]); verifikasi PIN sepenuhnya lokal
/// > dengan membandingkan masukan terhadap [pinHash]. PIN hanya 4–6 digit —
/// > ruang tebakan maksimum 1,1 juta kombinasi — sehingga siapa pun yang
/// > memperoleh berkas basis data dapat melakukan *brute force* offline.
/// >
/// > Enkripsi basis data (SQLCipher) adalah mitigasi yang masih menunggu
/// > keputusan tim ([09 §1.4] opsi A). Sampai itu diputuskan, `allowBackup`
/// > wajib `false` di manifest.
@DataClassName('Staff')
class Staffs extends Table {
  /// UUID staff dari server.
  TextColumn get id => text()();

  /// Identitas yang diketik kasir saat login (mis. `kasir01`).
  TextColumn get staffIdentifier => text()();

  TextColumn get name => text()();

  /// Hash bcrypt, dibandingkan di background isolate ([09 §5.3]).
  /// **Tidak pernah** ditampilkan, di-log, maupun dikirim ke mana pun.
  TextColumn get pinHash => text()();

  /* ── v2 · otorisasi OFFLINE (butir 12) ───────────────────────────────── */

  /// Peran staff, mis. `OWNER` / `SUPERVISOR` / `CASHIER` ([11 §4.4]).
  ///
  /// Bawaannya string KOSONG, bukan `CASHIER` maupun peran istimewa. Perangkat
  /// yang master datanya berasal dari server pra-v2 karena itu tidak punya
  /// siapa pun yang berwenang Force Close — dan itu keadaan yang benar: jalur
  /// darurat yang terbuka untuk semua orang bukan kompatibilitas, melainkan
  /// pintu belakang ([11 §M15.2]).
  ///
  /// Ikut master data justru supaya otorisasi dapat diputuskan **tanpa
  /// jaringan**: Force Close dibutuhkan tepat ketika ada yang tidak beres.
  TextColumn get role => text().withDefault(const Constant(''))();

  /// Izin granular di atas peran, disimpan sebagai JSON array.
  ///
  /// Drift tidak punya tipe daftar; JSON dipilih ketimbang tabel terpisah
  /// karena isinya selalu dibaca utuh bersama barisnya dan tidak pernah
  /// di-query per elemen.
  TextColumn get permissionsJson => text().withDefault(const Constant('[]'))();

  DateTimeColumn get syncedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
