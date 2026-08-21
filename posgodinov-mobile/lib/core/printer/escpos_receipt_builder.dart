import 'dart:typed_data';

import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';

/// Merender [ReceiptData] menjadi byte ESC/POS.
///
/// **Renderer, bukan transport** (ADR-07, [05 §1.7.1]). Kelas ini tidak tahu
/// apa pun tentang Bluetooth, USB, maupun soket; ia hanya menghasilkan byte.
/// Konsekuensinya: satu-satunya cara memperbaiki tata letak struk adalah di
/// sini, dan seluruh transport otomatis ikut berubah.
class EscPosReceiptBuilder {
  const EscPosReceiptBuilder({this.paperSize = PaperSize.mm58});

  /// 58 mm adalah standar printer termal murah dan printer internal handheld.
  final PaperSize paperSize;

  /// Lebar kolom total pada `Generator.row` selalu 12.
  static const int _cols = 12;

  Future<Uint8List> build(ReceiptData r) async {
    final CapabilityProfile profile = await CapabilityProfile.load();
    final Generator g = Generator(paperSize, profile);

    final List<int> bytes = <int>[];

    // ── Kepala ─────────────────────────────────────────────────────────────
    bytes.addAll(
      g.text(
        r.outletName,
        styles: const PosStyles(
          align: PosAlign.center,
          bold: true,
          height: PosTextSize.size2,
          width: PosTextSize.size2,
        ),
      ),
    );
    bytes.addAll(g.hr());

    bytes.addAll(_kv(g, 'No', r.shortId));
    bytes.addAll(_kv(g, 'Waktu', _formatDateTime(r.issuedAt)));
    if (r.cashierName.isNotEmpty) {
      bytes.addAll(_kv(g, 'Kasir', r.cashierName));
    }
    if (r.customerName.isNotEmpty) {
      bytes.addAll(_kv(g, 'Pelanggan', r.customerName));
    }
    bytes.addAll(g.hr());

    // ── Item ───────────────────────────────────────────────────────────────
    for (final ReceiptLine line in r.lines) {
      // Nama produk pada barisnya sendiri: nama F&B panjang tidak muat
      // berdampingan dengan nominal pada kertas 58 mm.
      bytes.addAll(g.text(line.productName));
      bytes.addAll(
        g.row(<PosColumn>[
          PosColumn(
            text: '${line.quantity} x ${Money.format(line.unitPriceMinor)}',
            width: 7,
          ),
          PosColumn(
            text: Money.format(line.lineTotalMinor),
            width: 5,
            styles: const PosStyles(align: PosAlign.right),
          ),
        ]),
      );
    }

    // ── Total ──────────────────────────────────────────────────────────────
    bytes.addAll(g.hr());
    bytes.addAll(
      g.row(<PosColumn>[
        PosColumn(text: 'TOTAL', width: 5, styles: const PosStyles(bold: true)),
        PosColumn(
          text: Money.format(r.totalMinor),
          width: 7,
          styles: const PosStyles(
            align: PosAlign.right,
            bold: true,
            height: PosTextSize.size2,
          ),
        ),
      ]),
    );

    if (r.paymentMethod.isCash) {
      bytes.addAll(_kv(g, 'TUNAI', Money.format(r.cashReceivedMinor)));
      bytes.addAll(_kv(g, 'KEMBALI', Money.format(r.changeMinor)));
    } else {
      // Nilai teknis ikut dicetak: saat terjadi sengketa laporan, kasir dan
      // pemilik merujuk string yang sama persis dengan isi kolom
      // `payment_method` ([06 §4.6.2]).
      bytes.addAll(
        _kv(g, 'METODE', '${r.paymentMethod.label} (${r.paymentMethod.wireValue})'),
      );
    }

    // ── Kaki ───────────────────────────────────────────────────────────────
    bytes.addAll(g.feed(1));

    // QR memuat UUID PENUH, bukan `shortId`. Saat pemilik menelusuri sengketa,
    // delapan karakter tidak cukup untuk mencari baris di basis data server.
    bytes.addAll(g.qrcode(r.transactionId, size: QRSize.size4));
    bytes.addAll(
      g.text(
        r.transactionId,
        styles: const PosStyles(align: PosAlign.center, fontType: PosFontType.fontB),
      ),
    );

    bytes.addAll(g.feed(1));
    bytes.addAll(
      g.text('Terima kasih', styles: const PosStyles(align: PosAlign.center)),
    );
    bytes.addAll(g.feed(2));
    bytes.addAll(g.cut());

    // Laci kas hanya dibuka untuk transaksi tunai. Membukanya pada QRIS atau
    // kartu hanya mengundang kesalahan hitung di akhir shift.
    if (r.paymentMethod.isCash) {
      bytes.addAll(g.drawer(pin: PosDrawer.pin2));
    }

    return Uint8List.fromList(bytes);
  }

  List<int> _kv(Generator g, String key, String value) => g.row(<PosColumn>[
        PosColumn(text: key, width: 5),
        PosColumn(
          text: value,
          width: _cols - 5,
          styles: const PosStyles(align: PosAlign.right),
        ),
      ]);

  /// `dd/MM/yy HH:mm` dalam waktu lokal perangkat.
  ///
  /// Ditulis manual alih-alih memakai `DateFormat`: struk dicetak di perangkat
  /// yang mungkin belum pernah memuat data locale, dan format ini tidak
  /// bergantung pada apa pun.
  String _formatDateTime(DateTime utc) {
    final DateTime t = utc.toLocal();
    String two(int v) => v.toString().padLeft(2, '0');
    return '${two(t.day)}/${two(t.month)}/${two(t.year % 100)} '
        '${two(t.hour)}:${two(t.minute)}';
  }
}
