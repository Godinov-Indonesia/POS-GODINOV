import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

part 'database.g.dart';

class LocalSoForms extends Table {
  TextColumn get id => text()();
  TextColumn get title => text()();
  TextColumn get notes => text().nullable()();
  TextColumn get status => text()();
  IntColumn get totalItems => integer().withDefault(const Constant(0))();
  IntColumn get countedItems => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

class LocalSoMaterials extends Table {
  TextColumn get id => text()();
  TextColumn get sessionId => text()();
  TextColumn get name => text()();
  TextColumn get sku => text().nullable()();
  TextColumn get barcode => text().nullable()();
  TextColumn get categoryName => text().nullable()();
  TextColumn get unit => text()(); // e.g. "Liter", "Kg", "Pcs"
  TextColumn get packageUnit => text().nullable()(); // e.g. "Dus", "Ball", "Karung"
  RealColumn get quantityPerPackage => real().nullable()(); // e.g. 12.0
  // Blind counting rule: NO system_stock stored here!

  @override
  Set<Column> get primaryKey => {id, sessionId};
}

class LocalCountEntries extends Table {
  TextColumn get sessionId => text()();
  TextColumn get rawMaterialId => text()();
  TextColumn get staffId => text()();
  RealColumn get actualStock => real()();
  RealColumn get actualPackageQuantity => real().nullable()();
  TextColumn get inputType => text().withDefault(const Constant('base_unit'))();
  TextColumn get notes => text().nullable()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(false))();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {sessionId, rawMaterialId, staffId};
}

@DriftDatabase(tables: [LocalSoForms, LocalSoMaterials, LocalCountEntries])
class AppDatabase extends _$AppDatabase {
  AppDatabase([QueryExecutor? e]) : super(e ?? _openConnection());

  @override
  int get schemaVersion => 1;

  static LazyDatabase _openConnection() {
    return LazyDatabase(() async {
      final dbFolder = await getApplicationDocumentsDirectory();
      final file = File(p.join(dbFolder.path, 'posgodinov_so.sqlite'));
      return NativeDatabase.createInBackground(file);
    });
  }

  // ── Helper Queries ─────────────────────────────────────────────────────────

  Future<void> cacheForms(List<LocalSoFormsCompanion> forms) async {
    await batch((b) {
      b.insertAllOnConflictUpdate(localSoForms, forms);
    });
  }

  Future<void> cacheMaterials(List<LocalSoMaterialsCompanion> materials) async {
    await batch((b) {
      b.insertAllOnConflictUpdate(localSoMaterials, materials);
    });
  }

  Future<List<LocalSoMaterial>> getMaterialsForSession(String sessionId) {
    return (select(localSoMaterials)..where((t) => t.sessionId.equals(sessionId))).get();
  }

  Future<LocalSoMaterial?> findMaterialByCode(String sessionId, String query) async {
    final clean = query.trim();
    if (clean.isEmpty) return null;
    return (select(localSoMaterials)
          ..where((t) =>
              t.sessionId.equals(sessionId) &
              (t.barcode.equals(clean) | t.sku.equals(clean))))
        .getSingleOrNull();
  }

  Future<void> saveCountEntry(LocalCountEntriesCompanion entry) async {
    await into(localCountEntries).insertOnConflictUpdate(entry);
  }

  Future<LocalCountEntry?> getStaffCount(String sessionId, String rawMaterialId, String staffId) {
    return (select(localCountEntries)
          ..where((t) =>
              t.sessionId.equals(sessionId) &
              t.rawMaterialId.equals(rawMaterialId) &
              t.staffId.equals(staffId)))
        .getSingleOrNull();
  }

  Future<List<LocalCountEntry>> getStaffCountsForSession(String sessionId, String staffId) {
    return (select(localCountEntries)
          ..where((t) => t.sessionId.equals(sessionId) & t.staffId.equals(staffId)))
        .get();
  }

  Future<List<LocalCountEntry>> getUnsyncedEntries(String sessionId, String staffId) {
    return (select(localCountEntries)
          ..where((t) =>
              t.sessionId.equals(sessionId) &
              t.staffId.equals(staffId) &
              t.isSynced.equals(false)))
        .get();
  }

  Future<void> markEntriesSynced(String sessionId, String staffId, List<String> materialIds) async {
    await (update(localCountEntries)
          ..where((t) =>
              t.sessionId.equals(sessionId) &
              t.staffId.equals(staffId) &
              t.rawMaterialId.isIn(materialIds)))
        .write(const LocalCountEntriesCompanion(isSynced: Value(true)));
  }
}
