import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_pos_printer_platform_image_3/flutter_pos_printer_platform_image_3.dart'
    as platform;
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';

/// Transport Bluetooth Classic (SPP), BLE, dan USB lewat
/// `flutter_pos_printer_platform_image_3`.
///
/// # Mengapa satu kelas untuk tiga transport
///
/// [09 §4.1] mendaftarkan `BtClassicPrinterAdapter`, `BlePrinterAdapter`, dan
/// `UsbPrinterAdapter` sebagai tiga adapter. Ketiganya berbeda **hanya** pada
/// `PrinterType` dan bendera `isBle` yang diteruskan ke paket; menuliskannya
/// tiga kali berarti menyalin permukaan paket tiga kali, dan setiap perubahan
/// API paket harus diperbaiki di tiga tempat.
///
/// Kontrak [PrinterTransport] tetap terpenuhi: `PrinterRegistry` membuat
/// instance terpisah per [PrinterKind], sehingga dari luar tetap tampak sebagai
/// tiga adapter.
///
/// # Prioritas BT Classic
///
/// Mayoritas printer termal murah di pasar Indonesia adalah **Bluetooth Classic
/// (SPP)**, bukan BLE — inilah alasan Web POS tidak dapat menjangkaunya sama
/// sekali ([05 §1.7.2]). `isBle: false` adalah jalur utama; BLE adalah
/// pelengkap untuk perangkat generasi baru.
///
/// > ⚠️ **Satu-satunya berkas di M6 yang bergantung pada API paket pihak
/// > ketiga.** Bila `flutter analyze` melaporkan galat setelah `pub get`,
/// > kemungkinan besar di sini — sesuaikan pemanggilan paket, bukan kontraknya.
class PlatformPrinterAdapter implements PrinterTransport {
  PlatformPrinterAdapter(this.kind)
      : assert(
          kind == PrinterKind.btClassic ||
              kind == PrinterKind.ble ||
              kind == PrinterKind.usb,
          'PlatformPrinterAdapter hanya melayani BT Classic, BLE, dan USB.',
        );

  @override
  final PrinterKind kind;

  final platform.PrinterManager _manager = platform.PrinterManager.instance;

  PrinterTarget? _connected;

  bool get _isBle => kind == PrinterKind.ble;

  platform.PrinterType get _type => kind == PrinterKind.usb
      ? platform.PrinterType.usb
      : platform.PrinterType.bluetooth;

  @override
  Future<bool> isAvailable() async => true;

  @override
  Future<List<PrinterTarget>> discover({
    Duration timeout = const Duration(seconds: 6),
  }) async {
    final List<PrinterTarget> hasil = <PrinterTarget>[];

    try {
      final Stream<platform.PrinterDevice> stream =
          _manager.discovery(type: _type, isBle: _isBle);

      await for (final platform.PrinterDevice d in stream.timeout(
        timeout,
        onTimeout: (EventSink<platform.PrinterDevice> sink) => sink.close(),
      )) {
        final String? id = _identify(d);
        if (id == null) continue;
        if (hasil.any((PrinterTarget t) => t.id == id)) continue;

        hasil.add(
          PrinterTarget(
            id: id,
            name: d.name.isEmpty ? id : d.name,
            kind: kind,
          ),
        );
      }
    } on Object {
      // Pemindaian yang gagal mengembalikan daftar yang sudah terkumpul, bukan
      // melempar: kasir yang sudah menemukan printernya tidak perlu diganggu
      // oleh galat pada perangkat lain di sekitarnya.
    }

    return hasil;
  }

  @override
  Future<void> connect(PrinterTarget target) async {
    final bool ok = await _manager.connect(
      type: _type,
      model: kind == PrinterKind.usb
          ? _usbInput(target)
          : platform.BluetoothPrinterInput(
              name: target.name,
              address: target.id,
              isBle: _isBle,
              autoConnect: true,
            ),
    );

    if (!ok) {
      throw PrinterException('Gagal terhubung ke ${target.name}.');
    }
    _connected = target;
  }

  @override
  Future<void> disconnect() async {
    try {
      await _manager.disconnect(type: _type);
    } on Object {
      // Memutus koneksi yang sudah mati bukan kegagalan.
    }
    _connected = null;
  }

  @override
  Future<void> write(Uint8List bytes) async {
    if (_connected == null) {
      throw const PrinterException('Printer belum terhubung.');
    }

    try {
      final bool ok = await _manager.send(type: _type, bytes: bytes);
      if (!ok) {
        throw PrinterException(
          'Printer ${_connected!.name} menolak data cetak.',
        );
      }
    } on PrinterException {
      rethrow;
    } on Object catch (e) {
      throw PrinterException('Gagal mengirim ke printer: $e');
    }
  }

  /// Status kertas tidak dibaca lewat transport ini.
  ///
  /// Paket tidak mengekspos jalur baca-balik yang seragam untuk ketiga
  /// transport. Mengembalikan `null` — **bukan** menebak `ready` — supaya UI
  /// tidak menampilkan jaminan yang tidak dapat ditepati ([09 §4.2]).
  @override
  Future<PrinterState?> queryPaperStatus() async => null;

  /// USB dikenali dari `vendorId:productId`; Bluetooth dari MAC address.
  String? _identify(platform.PrinterDevice d) {
    if (kind == PrinterKind.usb) {
      final String? vid = d.vendorId;
      final String? pid = d.productId;
      if (vid == null || pid == null) return null;
      return '$vid:$pid';
    }
    final String? address = d.address;
    return (address == null || address.isEmpty) ? null : address;
  }

  platform.UsbPrinterInput _usbInput(PrinterTarget target) {
    final List<String> parts = target.id.split(':');
    return platform.UsbPrinterInput(
      name: target.name,
      vendorId: parts.isNotEmpty ? parts.first : null,
      productId: parts.length > 1 ? parts[1] : null,
    );
  }
}
