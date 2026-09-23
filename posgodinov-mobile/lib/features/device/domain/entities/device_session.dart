import 'package:equatable/equatable.dart';

/// Identitas perangkat setelah *binding* berhasil ([03 §2.1]).
///
/// Token-nya sendiri **tidak** disimpan di sini — ia hidup di Android KeyStore
/// lewat `SecureStorageService`. Entitas ini hanya menyatakan bahwa perangkat
/// sudah terikat, plus metadata yang layak ditampilkan di layar Pengaturan.
class DeviceSession extends Equatable {
  const DeviceSession({
    required this.serialBusiness,
    required this.serialOutlet,
    required this.boundAt,
  });

  /// `businesses.serial_business`, mis. `KOPBU100826`.
  final String serialBusiness;

  /// `outlets.serial_tenant`, mis. `KOPBU100826001` — **bukan** `outlets.id`.
  final String serialOutlet;

  final DateTime boundAt;

  @override
  List<Object?> get props => <Object?>[serialBusiness, serialOutlet, boundAt];
}
