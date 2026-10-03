import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

/// Penyimpanan & cache gambar produk lokal ke disk Android.
///
/// Memastikan gambar hanya diunduh SEKALI dari Cloudinary dan selalu tersedia
/// saat offline. Saat produk dihapus dari master data, file gambarnya di disk
/// otomatis ikut dibersihkan (pruned) untuk menghemat storage dan bandwidth.
class ProductImageStorage {
  ProductImageStorage({Dio? dio}) : _dio = dio ?? Dio();

  final Dio _dio;
  Directory? _directory;

  Future<Directory> _getDir() async {
    if (_directory != null) return _directory!;
    final Directory base = await getApplicationDocumentsDirectory();
    final Directory dir = Directory('${base.path}/product_images');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    _directory = dir;
    return dir;
  }

  /// Mengembalikan path file gambar lokal bila sudah ada di disk.
  Future<File?> getLocalImageFile(String productId) async {
    final Directory dir = await _getDir();
    final File file = File('${dir.path}/$productId.jpg');
    if (await file.exists()) {
      return file;
    }
    return null;
  }

  /// Download gambar satu kali dan simpan ke disk Android.
  Future<File?> cacheImage(String productId, String url) async {
    if (url.isEmpty) return null;
    try {
      final Directory dir = await _getDir();
      final File file = File('${dir.path}/$productId.jpg');
      if (await file.exists()) return file;

      final Response<List<int>> response = await _dio.get<List<int>>(
        url,
        options: Options(responseType: ResponseType.bytes),
      );
      if (response.data != null && response.statusCode == 200) {
        await file.writeAsBytes(response.data!);
        return file;
      }
    } on Object catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[ProductImageStorage] Gagal mengunduh gambar $productId: $e',);
      }
    }
    return null;
  }

  /// Membersihkan gambar produk lokal yang sudah tidak ada di katalog aktif.
  Future<void> pruneImages(Set<String> activeProductIds) async {
    try {
      final Directory dir = await _getDir();
      final List<FileSystemEntity> entities = await dir.list().toList();
      for (final FileSystemEntity entity in entities) {
        if (entity is File && entity.path.endsWith('.jpg')) {
          final String filename = entity.uri.pathSegments.last;
          final String id = filename.replaceAll('.jpg', '');
          if (!activeProductIds.contains(id)) {
            await entity.delete();
          }
        }
      }
    } on Object catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[ProductImageStorage] Error saat membersihkan cache gambar: $e',);
      }
    }
  }
}
