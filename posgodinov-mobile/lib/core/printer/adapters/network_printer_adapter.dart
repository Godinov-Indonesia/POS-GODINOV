import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';

/// Printer LAN lewat **soket TCP mentah** ke port 9100 (RAW/JetDirect).
///
/// > Inilah yang mustahil dilakukan browser ([05 §1.7.3]): Web POS terhalang
/// > *mixed content* dan Private Network Access, sehingga cetak LAN sama sekali
/// > tidak tersedia di sana. Di Flutter, seluruh masalahnya selesai dalam
/// > beberapa baris `dart:io`.
///
/// Tidak memakai paket pihak ketiga mana pun — hanya pustaka standar.
class NetworkPrinterAdapter implements PrinterTransport {
  NetworkPrinterAdapter({
    Duration connectTimeout = const Duration(seconds: 5),
    Duration writeTimeout = const Duration(seconds: 10),
  })  : _connectTimeout = connectTimeout,
        _writeTimeout = writeTimeout;

  final Duration _connectTimeout;
  final Duration _writeTimeout;

  PrinterTarget? _target;

  @override
  PrinterKind get kind => PrinterKind.network;

  /// Selalu tersedia — soket TCP tidak memerlukan izin runtime maupun
  /// perangkat keras khusus.
  @override
  Future<bool> isAvailable() async => true;

  @override
  Future<List<PrinterTarget>> discover({
    Duration timeout = const Duration(seconds: 6),
  }) async =>
      const <PrinterTarget>[];

  @override
  Future<void> connect(PrinterTarget target) async {
    // Koneksi TIDAK dipertahankan antar-cetak. Printer LAN kerap memutus
    // koneksi menganggur setelah beberapa menit, dan soket yang tampak hidup
    // tetapi sudah mati adalah sumber kegagalan cetak yang paling
    // membingungkan. Membuka soket baru per struk memakan ~50 ms dan
    // menghilangkan seluruh kelas masalah itu.
    _target = target;
  }

  @override
  Future<void> disconnect() async {
    _target = null;
  }

  @override
  Future<void> write(Uint8List bytes) async {
    final PrinterTarget? target = _target;
    if (target == null) {
      throw const PrinterException('Printer jaringan belum dipilih.');
    }

    final (String host, int port) = parseTarget(target.id);

    Socket? socket;
    try {
      socket = await Socket.connect(host, port, timeout: _connectTimeout);
      socket.add(bytes);
      await socket.flush().timeout(_writeTimeout);
    } on SocketException catch (e) {
      throw PrinterException(
        'Tidak dapat menjangkau printer di $host:$port. '
        'Periksa kabel jaringan dan alamat IP. (${e.osError?.message ?? e.message})',
      );
    } on TimeoutException {
      throw PrinterException('Printer di $host:$port tidak merespons.');
    } finally {
      // `destroy` bukan `close`: sebagian printer tidak pernah menutup sisi
      // mereka, dan `close()` akan menggantung menunggu FIN yang tidak datang.
      socket?.destroy();
    }
  }

  /// Membaca status kertas lewat `DLE EOT 4`.
  ///
  /// Soket TCP mendukung baca-balik, jadi deteksi kertas habis benar-benar
  /// bekerja di sini — berbeda dari BLE ([09 §4.2]).
  @override
  Future<PrinterState?> queryPaperStatus() async {
    final PrinterTarget? target = _target;
    if (target == null) return null;

    final (String host, int port) = parseTarget(target.id);

    Socket? socket;
    try {
      socket = await Socket.connect(host, port, timeout: _connectTimeout);
      socket.add(PrinterCommands.realtimePaperStatus);
      await socket.flush();

      final List<int> reply = await socket.first.timeout(
        const Duration(seconds: 2),
      );
      return PrinterCommands.interpretPaperStatus(reply);
    } on Object {
      // Kegagalan membaca status BUKAN kegagalan cetak; jangan merambatkannya.
      return null;
    } finally {
      socket?.destroy();
    }
  }

  /// `id` berbentuk `host:port`; port default 9100.
  /// Publik agar dapat diuji langsung — penguraian alamat adalah sumber
  /// kesalahan konfigurasi yang paling sering di lapangan.
  static (String, int) parseTarget(String id) {
    final int sep = id.lastIndexOf(':');
    if (sep < 0) return (id, 9100);
    return (
      id.substring(0, sep),
      int.tryParse(id.substring(sep + 1)) ?? 9100,
    );
  }
}
