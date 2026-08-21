import 'dart:typed_data';

import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/printer/audit_receipt_data.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';

/// Merender tiga struk audit menjadi byte ESC/POS ([11 §M14.2–M14.4]).
///
/// **Renderer, bukan transport** (ADR-07, [05 §1.7.1]). Kelas ini tidak tahu
/// apa pun tentang Bluetooth, USB, maupun soket; ia hanya menghasilkan byte.
/// Konsekuensinya: satu-satunya cara memperbaiki tata letak struk audit adalah
/// di sini, dan seluruh transport otomatis ikut berubah.
class EscPosAuditBuilder {
  const EscPosAuditBuilder({this.paperSize = PaperSize.mm58});

  /// 58 mm adalah standar printer termal murah dan printer internal handheld.
  final PaperSize paperSize;

  /// Lebar kolom total pada `Generator.row` selalu 12.
  static const int _cols = 12;

  /* ── M15.3 · Struk Tutup Shift (Blind Closing) ───────────────────────── */

  /// Merender laporan tutup shift untuk kasir — **butir 9**.
  ///
  /// ⚠️ Perhatikan apa yang TIDAK dirender di sini: tidak ada ekspektasi, tidak
  /// ada selisih, tidak ada total penjualan. [ShiftReportData] memang tidak
  /// membawanya — lihat catatan pada kelas itu.
  ///
  /// Perannya adalah tanda terima: kasir memegang bukti bahwa ia menyerahkan
  /// laci dengan angka yang ini, pada jam yang ini. Rekonsiliasinya terjadi di
  /// kantor.
  Future<Uint8List> buildShiftReport(ShiftReportData r) async {
    final Generator g = await _generator();
    final List<int> bytes = <int>[];

    bytes.addAll(_title(g, 'LAPORAN'));
    bytes.addAll(_title(g, 'TUTUP SHIFT'));
    bytes.addAll(_subtitle(g, r.outletName));
    if (r.isReprint) bytes.addAll(_reprintMark(g));

    bytes.addAll(g.hr());
    bytes.addAll(_kv(g, 'Kasir', r.cashierName));
    bytes.addAll(_kv(g, 'Mulai', _formatDateTime(r.openedAt)));
    bytes.addAll(_kv(g, 'Tutup', _formatDateTime(r.closedAt)));
    bytes.addAll(_kv(g, 'Shift', _shortCode(r.shiftId)));

    bytes.addAll(g.hr());
    bytes.addAll(
      g.text('DEKLARASI KASIR', styles: const PosStyles(bold: true)),
    );
    bytes.addAll(_kv(g, 'Uang Laci', Money.format(r.declaredCashMinor)));
    bytes.addAll(_kv(g, 'Settle EDC', Money.format(r.declaredEdcMinor)));
    bytes.addAll(_kv(g, 'Settle QRIS', Money.format(r.declaredQrisMinor)));

    if (!r.blindClose) {
      // Penanda Force Close. Dicetak MENCOLOK karena kertas ini akan tersimpan
      // bersama laporan shift lain yang angkanya benar-benar dihitung
      // seseorang, dan keduanya tidak boleh terlihat setara saat ditumpuk.
      bytes.addAll(g.hr());
      bytes.addAll(
        g.text(
          '** DITUTUP PAKSA SUPERVISOR **',
          styles: const PosStyles(align: PosAlign.center, bold: true),
        ),
      );
      bytes.addAll(
        g.text(
          'Laci TIDAK dihitung. Angka di atas bukan hasil hitungan kasir.',
          styles: const PosStyles(fontType: PosFontType.fontB),
        ),
      );
      if (r.closedByName != null) {
        bytes.addAll(_kv(g, 'Ditutup oleh', r.closedByName!));
      }
    }

    bytes.addAll(g.hr());

    // Tanda terima penyerahan laci. Tanpa dua tanda tangan, kertas ini hanya
    // cetakan angka yang dapat diklaim siapa pun.
    bytes.addAll(_signature(g, 'Kasir'));
    bytes.addAll(_signature(g, 'Penerima Setoran'));

    bytes.addAll(g.hr());
    bytes.addAll(
      g.text(
        'Simpan bersama setoran laci.',
        styles: const PosStyles(align: PosAlign.center, fontType: PosFontType.fontB),
      ),
    );
    // Angka selisih SENGAJA tidak ada — lihat catatan pada [ShiftReportData].
    bytes.addAll(
      g.text(
        'Rekonsiliasi dilakukan di kantor.',
        styles: const PosStyles(align: PosAlign.center, fontType: PosFontType.fontB),
      ),
    );
    bytes.addAll(g.feed(2));
    bytes.addAll(g.cut());
    // ⚠️ TANPA `g.drawer(...)` — alasan yang sama dengan `_footer`.

    return Uint8List.fromList(bytes);
  }

  /* ── M14.2 · Struk Pembatalan ────────────────────────────────────────── */

  /// Dipakai KETIGA cakupan void — lihat catatan pada [CancelReceiptData].
  Future<Uint8List> buildCancel(CancelReceiptData r) async {
    final Generator g = await _generator();
    final List<int> bytes = <int>[];

    bytes.addAll(_title(g, 'STRUK'));
    bytes.addAll(_title(g, 'PEMBATALAN'));
    bytes.addAll(_subtitle(g, r.outletName));
    if (r.isReprint) bytes.addAll(_reprintMark(g));

    bytes.addAll(g.hr());
    bytes.addAll(_kv(g, 'Jenis', ReasonLabels.voidScopes[r.scope] ?? r.scope.wireValue));
    bytes.addAll(_kv(g, 'Waktu', _formatDateTime(r.issuedAt)));

    // Rujukan ke dokumen asal — kunci penelusuran saat audit. Tanpa ini, struk
    // pembatalan hanyalah selembar kertas yang tidak menunjuk apa pun.
    if (r.originalCode != null && r.originalCode!.isNotEmpty) {
      bytes.addAll(_kv(g, 'Struk Asal', r.originalCode!));
    }
    if (r.heldCartLabel != null && r.heldCartLabel!.isNotEmpty) {
      bytes.addAll(_kv(g, 'Pesanan', r.heldCartLabel!));
    }

    bytes.addAll(_kv(g, 'Kasir', r.cashierName));
    bytes.addAll(_kv(g, 'Otoritas', _authorityLabel(r.authorizedByName)));

    bytes.addAll(g.hr());
    bytes.addAll(_reason(g, r.reasonCode, ReasonLabels.voidReasons));
    bytes.addAll(_notes(g, r.reasonNotes));

    bytes.addAll(g.hr());
    bytes.addAll(
      g.text('ITEM YANG DIBATALKAN', styles: const PosStyles(bold: true)),
    );

    if (r.lines.isEmpty) {
      bytes.addAll(g.text('(tidak ada rincian item)'));
    }
    for (final AuditReceiptLine line in r.lines) {
      bytes.addAll(_itemRow(g, line));
    }

    bytes.addAll(g.hr());
    bytes.addAll(
      g.row(<PosColumn>[
        PosColumn(text: 'TOTAL DIBATALKAN', width: 7, styles: const PosStyles(bold: true)),
        PosColumn(
          text: Money.format(r.totalCancelledMinor),
          width: 5,
          styles: const PosStyles(align: PosAlign.right, bold: true),
        ),
      ]),
    );

    bytes.addAll(_signature(g, 'Pemberi Otoritas'));
    bytes.addAll(_footer(g));

    return Uint8List.fromList(bytes);
  }

  /* ── M14.3 · Struk Pembuangan ────────────────────────────────────────── */

  Future<Uint8List> buildWaste(WasteReceiptData r) async {
    final Generator g = await _generator();
    final List<int> bytes = <int>[];

    bytes.addAll(_title(g, 'STRUK'));
    bytes.addAll(_title(g, 'PEMBUANGAN'));
    bytes.addAll(
      g.text('/ WASTE', styles: const PosStyles(align: PosAlign.center, bold: true)),
    );
    bytes.addAll(_subtitle(g, r.outletName));
    if (r.isReprint) bytes.addAll(_reprintMark(g));

    bytes.addAll(g.hr());
    bytes.addAll(_kv(g, 'Waktu', _formatDateTime(r.issuedAt)));
    bytes.addAll(_kv(g, 'Petugas', r.staffName));
    bytes.addAll(g.hr());

    bytes.addAll(g.text(r.productName, styles: const PosStyles(bold: true)));
    bytes.addAll(_kv(g, 'Jumlah', '${r.quantity} ${r.unit}'));
    bytes.addAll(_reason(g, r.reasonCode, ReasonLabels.wasteReasons));
    bytes.addAll(_notes(g, r.reasonNotes));

    bytes.addAll(g.hr());
    // Penyaksi, BUKAN pelapor — lihat catatan pada [WasteReceiptData].
    bytes.addAll(_signature(g, 'Penyaksi'));
    bytes.addAll(_footer(g));

    return Uint8List.fromList(bytes);
  }

  /* ── M14.4 · Struk Retur ─────────────────────────────────────────────── */

  Future<Uint8List> buildReturn(ReturnReceiptData r) async {
    final Generator g = await _generator();
    final List<int> bytes = <int>[];

    bytes.addAll(_title(g, 'STRUK RETUR'));
    bytes.addAll(_subtitle(g, r.outletName));
    if (r.isReprint) bytes.addAll(_reprintMark(g));

    bytes.addAll(g.hr());
    bytes.addAll(_kv(g, 'No. Retur', r.returnCode));
    bytes.addAll(_kv(g, 'Struk Asal', r.originalCode));
    bytes.addAll(_kv(g, 'Waktu', _formatDateTime(r.issuedAt)));
    bytes.addAll(_kv(g, 'Kasir', r.cashierName));
    bytes.addAll(_kv(g, 'Otoritas', _authorityLabel(r.authorizedByName)));

    bytes.addAll(g.hr());
    bytes.addAll(_reason(g, r.reasonCode, ReasonLabels.returnReasons));
    bytes.addAll(_notes(g, r.reasonNotes));

    bytes.addAll(g.hr());
    bytes.addAll(g.text('ITEM YANG DIRETUR', styles: const PosStyles(bold: true)));

    for (final AuditReceiptLine line in r.lines) {
      bytes.addAll(_itemRow(g, line));
      // Barang yang TIDAK kembali ke stok dinyatakan di kertas. Pelanggan
      // berhak tahu bahwa barangnya dinyatakan rusak, dan gudang berhak tahu
      // mengapa stoknya tidak bertambah.
      if (!line.restock) {
        final String code = line.wasteReasonCode ?? '';
        bytes.addAll(
          g.text(
            '  ! tidak kembali ke stok${code.isEmpty ? '' : ' ($code)'}',
            styles: const PosStyles(fontType: PosFontType.fontB),
          ),
        );
      }
    }

    bytes.addAll(g.hr());
    bytes.addAll(
      _kv(g, 'Metode', '${r.refundMethod.label} (${r.refundMethod.wireValue})'),
    );
    bytes.addAll(
      g.row(<PosColumn>[
        PosColumn(text: 'TOTAL REFUND', width: 6, styles: const PosStyles(bold: true)),
        PosColumn(
          text: Money.format(r.refundAmountMinor),
          width: 6,
          styles: const PosStyles(
            align: PosAlign.right,
            bold: true,
            height: PosTextSize.size2,
          ),
        ),
      ]),
    );

    // Dua tanda tangan, keduanya wajib — lihat catatan pada [ReturnReceiptData].
    bytes.addAll(_signature(g, 'Pelanggan'));
    bytes.addAll(_signature(g, 'Pemberi Otoritas'));
    bytes.addAll(_footer(g));

    return Uint8List.fromList(bytes);
  }

  /* ── Blok bersama ────────────────────────────────────────────────────── */

  Future<Generator> _generator() async =>
      Generator(paperSize, await CapabilityProfile.load());

  /// Judul dokumen dengan tinggi DAN lebar ganda.
  ///
  /// Bukan hiasan: struk audit yang terlihat sama dengan struk penjualan biasa
  /// akan tercampur di laci dan tidak pernah ditemukan saat rekonsiliasi.
  /// Judulnya harus dapat dikenali dari tumpukan, bukan setelah dibaca.
  List<int> _title(Generator g, String text) => g.text(
        text,
        styles: const PosStyles(
          align: PosAlign.center,
          bold: true,
          height: PosTextSize.size2,
          width: PosTextSize.size2,
        ),
      );

  List<int> _subtitle(Generator g, String text) =>
      g.text(text, styles: const PosStyles(align: PosAlign.center));

  List<int> _reprintMark(Generator g) => g.text(
        '--- CETAK ULANG ---',
        styles: const PosStyles(align: PosAlign.center, bold: true),
      );

  /// `null` dinyatakan APA ADANYA, bukan dibiarkan kosong.
  ///
  /// Kolom kosong akan dibaca sebagai "belum sempat diisi", padahal artinya
  /// kebijakan outlet ini memang tidak mewajibkannya — dan itu temuan audit
  /// tersendiri.
  String _authorityLabel(String? name) =>
      (name == null || name.isEmpty) ? '(tanpa otoritas)' : name;

  /// Baris alasan: kode kontrak DAN labelnya.
  ///
  /// Kode ikut dicetak, bukan hanya labelnya. Saat pemilik menelusuri laporan,
  /// yang ia cari adalah string yang sama persis dengan isi kolom `reason_code`
  /// — label Bahasa Indonesia dapat berubah kapan saja tanpa memberi tahu
  /// siapa pun.
  List<int> _reason(Generator g, String code, Map<String, String> labels) =>
      _kv(g, 'Alasan', '${labels[code] ?? code} ($code)');

  List<int> _notes(Generator g, String notes) {
    if (notes.trim().isEmpty) return const <int>[];
    return <int>[
      ...g.text('Catatan:'),
      // `Generator.text` membungkus sendiri pada batas kertas; catatan alasan
      // TIDAK boleh dipotong — bagian yang terpotong justru sering memuat
      // keterangan yang membuat pembatalannya masuk akal.
      ...g.text(notes.trim(), styles: const PosStyles(fontType: PosFontType.fontB)),
    ];
  }

  List<int> _itemRow(Generator g, AuditReceiptLine line) => <int>[
        // Nama produk pada barisnya sendiri: nama F&B panjang tidak muat
        // berdampingan dengan nominal pada kertas 58 mm.
        ...g.text(line.productName),
        ...g.row(<PosColumn>[
          PosColumn(
            text: '  ${line.quantity} x ${Money.format(line.unitPriceMinor)}',
            width: 7,
          ),
          PosColumn(
            text: Money.format(line.lineTotalMinor),
            width: 5,
            styles: const PosStyles(align: PosAlign.right),
          ),
        ]),
      ];

  /// Garis tanda tangan.
  ///
  /// Ruang kosong di atas garis sengaja tiga baris: tanda tangan yang tidak
  /// muat akan ditulis melintang di atas teks lain, dan struk yang tidak
  /// terbaca sama saja dengan struk yang tidak pernah dicetak.
  List<int> _signature(Generator g, String label) => <int>[
        ...g.feed(3),
        ...g.text('........................'),
        ...g.text(label, styles: const PosStyles(fontType: PosFontType.fontB)),
      ];

  List<int> _footer(Generator g) => <int>[
        ...g.hr(),
        ...g.text(
          'Simpan bersama laporan shift.',
          styles: const PosStyles(align: PosAlign.center, fontType: PosFontType.fontB),
        ),
        ...g.text(
          'Bukan bukti pembayaran.',
          styles: const PosStyles(align: PosAlign.center, fontType: PosFontType.fontB),
        ),
        ...g.feed(2),
        ...g.cut(),
        // ⚠️ TANPA `g.drawer(...)`. Laci kas hanya dibuka pada penjualan tunai;
        // membukanya pada pembatalan atau pembuangan memberi jalan resmi untuk
        // membuka laci tanpa transaksi — persis yang butir 5 dan 6 hendak cegah.
      ];

  List<int> _kv(Generator g, String key, String value) => g.row(<PosColumn>[
        PosColumn(text: key, width: 5),
        PosColumn(
          text: value,
          width: _cols - 5,
          styles: const PosStyles(align: PosAlign.right),
        ),
      ]);

  /// Delapan karakter pertama UUID tanpa tanda hubung — cukup untuk dicocokkan
  /// manusia, dan muat pada kertas 58 mm.
  String _shortCode(String uuid) =>
      uuid.replaceAll('-', '').substring(0, 8).toUpperCase();

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
