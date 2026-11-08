import 'package:equatable/equatable.dart';

/// Ringkasan hasil `GET /v1/pos/sync/master-data` ([03 §2.2]).
///
/// Isinya sengaja hanya berupa **hitungan**, bukan daftar entitas: baris-barisnya
/// sudah masuk ke Drift di lapisan data, dan layar produk membacanya lewat
/// stream reaktif — bukan lewat objek yang dioper dari sini.
class MasterSnapshot extends Equatable {
  const MasterSnapshot({
    required this.staffCount,
    required this.categoryCount,
    required this.productCount,
    required this.syncedAt,
  });

  final int staffCount;
  final int categoryCount;
  final int productCount;
  final DateTime syncedAt;

  /// Outlet tanpa satu pun staff tidak dapat dipakai berjualan — kasir tidak
  /// akan bisa login karena tidak ada `pin_hash` untuk dibandingkan.
  bool get hasNoStaff => staffCount == 0;

  /// Outlet tanpa produk bukan kondisi error: pemilik mungkin belum sempat
  /// mengisi katalog. Layar kasir menampilkan keadaan kosong, bukan kegagalan.
  bool get hasNoProducts => productCount == 0;

  @override
  List<Object?> get props =>
      <Object?>[staffCount, categoryCount, productCount, syncedAt];
}
