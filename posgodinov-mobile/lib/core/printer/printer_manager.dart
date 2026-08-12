import 'dart:async';
import 'dart:typed_data';

import 'package:posgodinov_mobile/core/printer/escpos_receipt_builder.dart';
import 'package:posgodinov_mobile/core/printer/printer_preferences.dart';
import 'package:posgodinov_mobile/core/printer/printer_registry.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';
import 'package:synchronized/synchronized.dart';

/// Implementasi [ReceiptPrinter] yang menyatukan renderer, transport,
/// auto-reconnect, dan antrean.
///
/// Inilah yang membedakan printer "bisa dipakai demo" dari printer yang
/// bertahan satu shift penuh ([09 §4.2]).
///
/// # Kontrak yang tidak boleh dilanggar
///
/// [printReceipt] **tidak pernah melempar**. Pemanggilnya adalah
/// `TransactionCubit`, dan memaksanya membungkus setiap pencetakan dengan `try`
/// mengundang godaan membatalkan transaksi di blok `catch` — persis kesalahan
/// paling mahal yang mungkin terjadi ([09 §7.3]).
class PrinterManager implements ReceiptPrinter {
  PrinterManager({
    required PrinterRegistry registry,
    required PrinterPreferences preferences,
    EscPosReceiptBuilder? builder,
  })  : _registry = registry,
        _prefs = preferences,
        _builder = builder ?? const EscPosReceiptBuilder();

  final PrinterRegistry _registry;
  final PrinterPreferences _prefs;
  final EscPosReceiptBuilder _builder;

  final StreamController<PrinterStatus> _status =
      StreamController<PrinterStatus>.broadcast();

  /// Mencetak tidak boleh tumpang tindih: dua struk yang byte-nya berselang
  /// seling menghasilkan kertas yang tidak terbaca dan menghabiskan roll.
  final Lock _lock = Lock();

  PrinterTransport? _transport;
  PrinterTarget? _target;
  bool _connected = false;

  static const int _maxReconnectAttempts = 5;
  static const Duration _baseReconnectDelay = Duration(seconds: 2);
  static const Duration _connectTimeout = Duration(seconds: 8);

  PrinterStatus _last = const PrinterStatus(PrinterState.unavailable);

  /// Status terakhir — dibaca `PrinterCubit` saat pertama kali dipasang.
  PrinterStatus get currentStatus => _last;

  @override
  PrinterKind get kind => _target?.kind ?? PrinterKind.btClassic;

  @override
  Stream<PrinterStatus> get status => _status.stream;

  @override
  Future<bool> isAvailable() async =>
      _transport != null && await _transport!.isAvailable();

  /// Memulihkan printer yang dipilih pada sesi sebelumnya.
  ///
  /// Dipanggil saat aplikasi start dan setiap kali kembali dari latar.
  Future<void> restore() async {
    final PrinterTarget? saved = await _prefs.readTarget();

    if (saved == null) {
      _emit(
        const PrinterStatus(
          PrinterState.unavailable,
          message: 'Belum ada printer terpasang.',
        ),
      );
      return;
    }

    await select(saved, persist: false);
  }

  /// Menetapkan printer aktif.
  Future<void> select(PrinterTarget target, {bool persist = true}) async {
    if (_connected) await _transport?.disconnect();

    _target = target;
    _transport = _registry.adapterFor(target.kind);
    _connected = false;

    if (persist) await _prefs.saveTarget(target);
    await _ensureConnected();
  }

  /// Mencari printer pada sebuah transport.
  Future<List<PrinterTarget>> discover(PrinterKind kind) async {
    if (kind != PrinterKind.network && kind != PrinterKind.sunmiInner) {
      // Izin diminta tepat sebelum dibutuhkan, bukan saat aplikasi start.
      final bool granted = await _registry.ensureBluetoothPermissions();
      if (!granted) {
        _emit(
          const PrinterStatus(
            PrinterState.error,
            message: 'Izin Bluetooth ditolak. Pemindaian printer tidak dapat '
                'berjalan.',
          ),
        );
        return const <PrinterTarget>[];
      }
    }
    return _registry.adapterFor(kind).discover();
  }

  @override
  Future<bool> printReceipt(ReceiptData data) async {
    final Uint8List bytes;
    try {
      bytes = await _builder.build(data);
    } on Object catch (e) {
      // Kegagalan MERENDER adalah bug kita sendiri, bukan masalah perangkat
      // keras — tetap tidak boleh melempar ke pemanggil.
      _emit(PrinterStatus(PrinterState.error, message: 'Gagal menyusun struk: $e'));
      return false;
    }
    return printBytes(bytes);
  }

  @override
  Future<bool> printBytes(Uint8List bytes) {
    return _lock.synchronized<bool>(() async {
      if (!await _ensureConnected()) return false;

      try {
        _emit(const PrinterStatus(PrinterState.printing));
        await _transport!.write(bytes);

        // Status kertas dibaca SETELAH cetak: pada transport yang mendukung
        // baca-balik, inilah momen paling akurat untuk mengetahui roll habis.
        final PrinterState? paper = await _transport!.queryPaperStatus();
        if (paper == PrinterState.outOfPaper) {
          _emit(
            const PrinterStatus(
              PrinterState.outOfPaper,
              message: 'Kertas habis. Ganti roll, lalu tekan Cetak Ulang.',
            ),
          );
          // Byte sudah terkirim; sebagian struk mungkin tercetak sebelum
          // kertas habis. Dilaporkan sebagai GAGAL agar kasir mencetak ulang.
          return false;
        }

        _emit(PrinterStatus(PrinterState.ready, message: _target?.name));
        return true;
      } on PrinterException catch (e) {
        _connected = false;
        _emit(PrinterStatus(PrinterState.error, message: e.message));
        return false;
      } on Object catch (e) {
        _connected = false;
        _emit(PrinterStatus(PrinterState.error, message: 'Cetak gagal: $e'));
        return false;
      }
    });
  }

  /// Menghubungkan ulang dengan backoff eksponensial 2 / 4 / 8 / 16 / 32 detik.
  ///
  /// **Tidak pernah melempar.** Kegagalan menghubungkan bukan kegagalan
  /// transaksi.
  Future<bool> _ensureConnected() async {
    final PrinterTransport? transport = _transport;
    final PrinterTarget? target = _target;

    if (transport == null || target == null) {
      _emit(
        const PrinterStatus(
          PrinterState.unavailable,
          message: 'Belum ada printer terpasang.',
        ),
      );
      return false;
    }

    if (_connected) return true;

    for (int attempt = 1; attempt <= _maxReconnectAttempts; attempt++) {
      try {
        _emit(const PrinterStatus(PrinterState.connecting));
        await transport.connect(target).timeout(_connectTimeout);

        _connected = true;
        _emit(PrinterStatus(PrinterState.ready, message: target.name));
        return true;
      } on Object {
        _emit(
          PrinterStatus(
            PrinterState.error,
            message: 'Gagal terhubung ke ${target.name} '
                '(percobaan $attempt/$_maxReconnectAttempts).',
          ),
        );
        if (attempt < _maxReconnectAttempts) {
          await Future<void>.delayed(_baseReconnectDelay * (1 << (attempt - 1)));
        }
      }
    }

    _emit(
      const PrinterStatus(
        PrinterState.disconnected,
        message: 'Printer tidak terhubung. Struk dapat dicetak ulang dari '
            'Riwayat setelah printer tersambung.',
      ),
    );
    return false;
  }

  void _emit(PrinterStatus s) {
    _last = s;
    if (!_status.isClosed) _status.add(s);
  }

  Future<void> dispose() async {
    await _transport?.disconnect();
    await _status.close();
  }
}
