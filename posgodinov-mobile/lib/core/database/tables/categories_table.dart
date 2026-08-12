import 'package:drift/drift.dart';

/// Kategori produk dari master data ([03 §2.2]).
///
/// Dipakai `CategoryTabs` di P-05. Backend tidak menyediakan `PUT`/`DELETE`
/// untuk kategori ([03 §5.3]), jadi tabel ini murni baca-saja di sisi POS.
@DataClassName('Category')
class Categories extends Table {
  /// UUID kategori dari server.
  TextColumn get id => text()();

  TextColumn get name => text()();

  TextColumn get description => text().withDefault(const Constant(''))();

  DateTimeColumn get syncedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
