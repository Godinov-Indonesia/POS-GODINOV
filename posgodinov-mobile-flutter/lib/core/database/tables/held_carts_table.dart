import 'package:drift/drift.dart';

/// Pesanan ditahan (*hold order*) — P-08.
///
/// > **Murni lokal. TIDAK PERNAH dikirim ke server.** Backend tidak memiliki
/// > konsep pesanan tertahan ([03 §14]); ini hanya laci sementara di perangkat.
/// > Karena itu tabel ini tidak punya kolom `synced` sama sekali — kehadirannya
/// > akan menggoda seseorang untuk memasukkannya ke antrean sync.
///
/// Isi keranjang disimpan sebagai JSON agar tidak perlu tabel item kedua untuk
/// data yang belum menjadi transaksi. Begitu pesanan dibayar, ia lahir kembali
/// sebagai baris `transactions` + `transaction_items` yang relasional.
@DataClassName('HeldCart')
class HeldCarts extends Table {
  /// UUID v4 dibuat KLIEN saat pesanan ditahan.
  TextColumn get id => text()();

  /// Label yang dilihat kasir saat memilih pesanan (mis. nama pelanggan atau
  /// nomor meja).
  TextColumn get label => text().withDefault(const Constant(''))();

  /// Snapshot `List<CartLine>` dalam JSON, seluruh nominal **integer sen**.
  TextColumn get linesJson => text()();

  /// Denormalisasi untuk daftar P-08 tanpa perlu mengurai [linesJson].
  IntColumn get totalMinor => integer()();

  IntColumn get itemCount => integer()();

  DateTimeColumn get heldAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
