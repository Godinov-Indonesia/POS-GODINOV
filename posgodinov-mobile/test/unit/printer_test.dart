import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/printer/adapters/network_printer_adapter.dart';
import 'package:posgodinov_mobile/core/printer/escpos_receipt_builder.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';
import 'package:posgodinov_mobile/features/printer/presentation/cubit/printer_cubit.dart';

ReceiptData _receipt({
  PaymentMethod method = PaymentMethod.cash,
  int totalMinor = 4400000,
  int cashMinor = 5000000,
}) =>
    ReceiptData(
      transactionId: 'aaaa1111-2222-4333-8444-555566667777',
      shortId: 'AAAA1111',
      outletName: 'Outlet Sudirman',
      cashierName: 'Siti Aminah',
      lines: const <ReceiptLine>[
        ReceiptLine(
          productName: 'Kopi Susu Gula Aren',
          quantity: 2,
          unitPriceMinor: 2200000,
        ),
      ],
      totalMinor: totalMinor,
      paymentMethod: method,
      cashReceivedMinor: cashMinor,
      changeMinor: cashMinor - totalMinor,
      issuedAt: DateTime.utc(2026, 8, 12, 3, 22),
    );

void main() {
  group('PrinterCommands — status kertas DLE EOT 4', () {
    test('balasan kosong berarti tidak diketahui, bukan siap', () {
      // Menebak `ready` dari ketiadaan jawaban akan menyembunyikan printer
      // yang sebenarnya tidak merespons.
      expect(PrinterCommands.interpretPaperStatus(const <int>[]), isNull);
    });

    test('bit 5 atau 6 menyala berarti kertas habis', () {
      expect(
        PrinterCommands.interpretPaperStatus(const <int>[0x60]),
        PrinterState.outOfPaper,
      );
      expect(
        PrinterCommands.interpretPaperStatus(const <int>[0x20]),
        PrinterState.outOfPaper,
      );
      expect(
        PrinterCommands.interpretPaperStatus(const <int>[0x40]),
        PrinterState.outOfPaper,
      );
    });

    test('kertas hampir habis TIDAK dilaporkan sebagai habis', () {
      // Bit 2–3 = near-end. Struk masih dapat dicetak; menghentikan kasir di
      // situ merugikan tanpa alasan ([09 §4.2]).
      expect(
        PrinterCommands.interpretPaperStatus(const <int>[0x0C]),
        PrinterState.ready,
      );
    });

    test('status normal berarti siap', () {
      expect(
        PrinterCommands.interpretPaperStatus(const <int>[0x12]),
        PrinterState.ready,
      );
    });

    test('perintah yang dikirim adalah DLE EOT 4', () {
      expect(PrinterCommands.realtimePaperStatus, <int>[0x10, 0x04, 0x04]);
    });
  });

  group('NetworkPrinterAdapter.parseTarget', () {
    test('host tanpa port memakai 9100 (RAW/JetDirect)', () {
      expect(
        NetworkPrinterAdapter.parseTarget('192.168.1.50'),
        ('192.168.1.50', 9100),
      );
    });

    test('port eksplisit dihormati', () {
      expect(
        NetworkPrinterAdapter.parseTarget('192.168.1.50:9200'),
        ('192.168.1.50', 9200),
      );
    });

    test('port tidak valid jatuh ke 9100 alih-alih melempar', () {
      // Salah ketik saat pemasangan tidak boleh membuat aplikasi mati.
      expect(
        NetworkPrinterAdapter.parseTarget('192.168.1.50:abc'),
        ('192.168.1.50', 9100),
      );
    });

    test('alamat IPv6 memakai pemisah terakhir', () {
      expect(
        NetworkPrinterAdapter.parseTarget('fe80::1:9100'),
        ('fe80::1', 9100),
      );
    });
  });

  group('PrinterUiState — matriks 7 keadaan [09 §4.2]', () {
    PrinterUiState s(PrinterState state) =>
        PrinterUiState(status: PrinterStatus(state));

    test('hanya ready dan printing yang dianggap dapat mencetak', () {
      for (final PrinterState state in PrinterState.values) {
        final bool expected =
            state == PrinterState.ready || state == PrinterState.printing;
        expect(s(state).canPrint, expected, reason: state.name);
      }
    });

    test('setiap keadaan punya label', () {
      for (final PrinterState state in PrinterState.values) {
        expect(s(state).label, isNotEmpty, reason: state.name);
      }
    });

    test('keadaan yang dapat dipulihkan menawarkan aksi', () {
      expect(s(PrinterState.unavailable).actionLabel, 'Pasang printer');
      expect(s(PrinterState.disconnected).actionLabel, 'Hubungkan ulang');
      expect(s(PrinterState.outOfPaper).actionLabel, 'Cetak Ulang');
      expect(s(PrinterState.error).actionLabel, 'Coba lagi');
    });

    test('keadaan sementara tidak menawarkan aksi', () {
      expect(s(PrinterState.connecting).actionLabel, isNull);
      expect(s(PrinterState.printing).actionLabel, isNull);
      expect(s(PrinterState.ready).actionLabel, isNull);
    });
  });

  group('EscPosReceiptBuilder', () {
    // `CapabilityProfile.load()` membaca aset paket, jadi binding harus siap.
    TestWidgetsFlutterBinding.ensureInitialized();

    const EscPosReceiptBuilder builder = EscPosReceiptBuilder();

    test('menghasilkan byte dan diakhiri perintah potong', () async {
      final List<int> bytes = await builder.build(_receipt());

      expect(bytes, isNotEmpty);
      // GS V — perintah potong kertas harus ada, jika tidak struk berikutnya
      // menyambung ke struk sebelumnya.
      expect(_contains(bytes, <int>[0x1D, 0x56]), isTrue);
    });

    test('transaksi TUNAI menyertakan perintah buka laci', () async {
      final List<int> bytes = await builder.build(_receipt());

      // ESC p — pulse ke pin laci kas.
      expect(_contains(bytes, <int>[0x1B, 0x70]), isTrue);
    });

    test('transaksi NON-TUNAI TIDAK membuka laci', () async {
      // Membuka laci pada QRIS hanya mengundang kesalahan hitung di akhir
      // shift.
      final List<int> bytes =
          await builder.build(_receipt(method: PaymentMethod.qris));

      expect(_contains(bytes, <int>[0x1B, 0x70]), isFalse);
    });

    test('QR memuat UUID penuh, bukan shortId', () async {
      final List<int> bytes = await builder.build(_receipt());
      final String asAscii = String.fromCharCodes(
        bytes.where((int b) => b >= 32 && b < 127),
      );

      // Delapan karakter tidak cukup untuk menelusuri baris di server saat
      // terjadi sengketa.
      expect(asAscii, contains('aaaa1111-2222-4333-8444-555566667777'));
    });

    test('nominal dirender lewat format Rupiah yang sama dengan layar', () async {
      final List<int> bytes = await builder.build(_receipt());
      final String asAscii = String.fromCharCodes(
        bytes.where((int b) => b >= 32 && b < 127),
      );

      expect(asAscii, contains('44.000'));
      expect(asAscii, contains('22.000'));
    });
  });
}

/// Mencari sub-urutan byte.
bool _contains(List<int> haystack, List<int> needle) {
  for (int i = 0; i + needle.length <= haystack.length; i++) {
    bool cocok = true;
    for (int j = 0; j < needle.length; j++) {
      if (haystack[i + j] != needle[j]) {
        cocok = false;
        break;
      }
    }
    if (cocok) return true;
  }
  return false;
}
