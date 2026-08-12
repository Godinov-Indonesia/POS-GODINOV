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

  DateTimeColumn get syncedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
