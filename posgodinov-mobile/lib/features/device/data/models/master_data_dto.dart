import 'package:posgodinov_mobile/core/network/envelope.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';

/// Staff beserta `pin_hash` bcrypt ([03 §2.2]).
class StaffDto {
  const StaffDto({
    required this.id,
    required this.staffIdentifier,
    required this.name,
    required this.pinHash,
  });

  factory StaffDto.fromJson(Map<String, dynamic> json) => StaffDto(
        id: json['id'] as String? ?? '',
        staffIdentifier: json['staff_identifier'] as String? ?? '',
        name: json['name'] as String? ?? '',
        pinHash: json['pin_hash'] as String? ?? '',
      );

  final String id;
  final String staffIdentifier;
  final String name;

  /// **Jangan pernah** menuliskan nilai ini ke log atau menampilkannya.
  final String pinHash;
}

class CategoryDto {
  const CategoryDto({
    required this.id,
    required this.name,
    required this.description,
  });

  factory CategoryDto.fromJson(Map<String, dynamic> json) => CategoryDto(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        description: json['description'] as String? ?? '',
      );

  final String id;
  final String name;
  final String description;
}

class ProductDto {
  const ProductDto({
    required this.id,
    required this.name,
    required this.priceMinor,
    required this.imageUrl,
    required this.categoryId,
  });

  factory ProductDto.fromJson(Map<String, dynamic> json) => ProductDto(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        // BATAS API MASUK — Rupiah dari server menjadi integer sen (ADR-05).
        // Inilah satu-satunya tempat konversi ini terjadi untuk produk.
        priceMinor: Money.toMinor((json['price'] as num?) ?? 0),
        imageUrl: json['image_url'] as String?,
        categoryId: json['category_id'] as String?,
      );

  final String id;
  final String name;

  /// **INTEGER SEN.**
  final int priceMinor;

  final String? imageUrl;
  final String? categoryId;
}

/// Payload `data` dari `GET /v1/pos/sync/master-data`.
///
/// > ⚠️ **Ketiga koleksi dapat bernilai `null`, bukan `[]`.** Service backend
/// > membangun slice dengan `append` ke variabel `nil`; outlet yang belum punya
/// > produk menghasilkan `"products": null` ([03 §2.2]). Normalisasinya
/// > dilakukan `Envelope.list` — **tidak ada** `as List` langsung di sini.
///
/// > ⚠️ Payload ini **tidak** memuat stok maupun resep (BOM). Konsekuensinya,
/// > layar kasir dilarang menampilkan ketersediaan stok ([09 §9.5]).
class MasterDataDto {
  const MasterDataDto({
    required this.staffs,
    required this.categories,
    required this.products,
  });

  factory MasterDataDto.fromJson(Map<String, dynamic> json) => MasterDataDto(
        staffs: Envelope.list(json['staffs'], StaffDto.fromJson),
        categories: Envelope.list(json['categories'], CategoryDto.fromJson),
        products: Envelope.list(json['products'], ProductDto.fromJson),
      );

  final List<StaffDto> staffs;
  final List<CategoryDto> categories;
  final List<ProductDto> products;
}

/// Respons `POST /v1/auth/device/bind`.
class DeviceBindResponseDto {
  const DeviceBindResponseDto({required this.deviceToken});

  factory DeviceBindResponseDto.fromJson(Map<String, dynamic> json) =>
      DeviceBindResponseDto(
        deviceToken: json['device_token'] as String? ?? '',
      );

  final String deviceToken;
}
