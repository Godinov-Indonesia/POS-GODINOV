import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';

/// Uji kontrak lintas platform ([05 §3.3] / [09 §9.3]).
///
/// # Mengapa uji ini ada
///
/// `transactions.payment_method` adalah `VARCHAR(50)` bebas tanpa enum database
/// ([02 §2.12]). Backend menerima **string apa pun**. Bila Web mengirim `CASH`
/// dan Flutter mengirim `TUNAI`, laporan pemilik terbelah **secara permanen** —
/// tidak ada endpoint untuk memperbaiki data historis.
///
/// Uji ini gagal begitu salah satu platform menyimpang.
void main() {
  /// Lokasi berkas kontrak Web relatif terhadap akar proyek Flutter.
  const String webContractPath = '../posgodinov-fe/lib/constants/payment.ts';

  group('PAYMENT_METHODS — kontrak beku', () {
    test('daftar Flutter sesuai kesepakatan', () {
      // Perubahan pada daftar ini WAJIB disertai perubahan di Web dan
      // persetujuan lintas tim. Menambah nilai baru masih mungkin;
      // mengganti nama nilai lama tidak.
      expect(
        PaymentMethod.values.map((PaymentMethod m) => m.wireValue).toList(),
        <String>['CASH', 'QRIS', 'DEBIT', 'TRANSFER'],
      );
    });

    test('setiap nilai punya label Bahasa Indonesia', () {
      for (final PaymentMethod m in PaymentMethod.values) {
        expect(m.label, isNotEmpty, reason: m.name);
        expect(m.label, isNot(equals(m.wireValue)), reason: m.name);
      }
    });

    test('wireValue selalu HURUF BESAR tanpa spasi', () {
      for (final PaymentMethod m in PaymentMethod.values) {
        expect(m.wireValue, m.wireValue.toUpperCase(), reason: m.name);
        expect(m.wireValue.contains(' '), isFalse, reason: m.name);
      }
    });

    test('hanya CASH yang memengaruhi saldo laci', () {
      // Memasukkan metode lain membuat setiap shift tampak kekurangan uang
      // sebesar total pembayaran non-tunai ([04 §A.3]).
      expect(cashMethods, <PaymentMethod>{PaymentMethod.cash});
    });

    test('fromWire menolak nilai di luar kontrak', () {
      expect(PaymentMethod.fromWire('CASH'), PaymentMethod.cash);
      expect(() => PaymentMethod.fromWire('TUNAI'), throwsArgumentError);
      expect(() => PaymentMethod.fromWire('cash'), throwsArgumentError);
    });

    test('daftar Web dan Flutter identik', () {
      final File web = File(webContractPath);

      // Uji dilewati bila repo Web tidak ada di sebelah — mis. saat CI hanya
      // meng-checkout proyek Flutter. Yang tidak boleh adalah lolos diam-diam
      // ketika berkasnya ADA tetapi isinya menyimpang.
      if (!web.existsSync()) {
        markTestSkipped(
          'Kontrak Web tidak ditemukan di $webContractPath — '
          'lewati perbandingan lintas platform.',
        );
        return;
      }

      final String source = web.readAsStringSync();
      final RegExpMatch? block = RegExp(
        r'PAYMENT_METHODS\s*=\s*\[(.*?)\]',
        dotAll: true,
      ).firstMatch(source);

      expect(
        block,
        isNotNull,
        reason: 'PAYMENT_METHODS tidak ditemukan di berkas kontrak Web',
      );

      final Set<String> webValues = RegExp("'([A-Z_]+)'")
          .allMatches(block!.group(1)!)
          .map((RegExpMatch m) => m.group(1)!)
          .toSet();

      final Set<String> dartValues =
          PaymentMethod.values.map((PaymentMethod m) => m.wireValue).toSet();

      expect(
        dartValues,
        webValues,
        reason: 'Daftar metode pembayaran Web dan Flutter menyimpang. '
            'Perbedaan sekecil apa pun memecah laporan historis secara '
            'permanen ([09 §9.3]).',
      );
    });
  });

  group('TransactionStatus & ShiftStatus', () {
    test('nilai kawat sesuai skema backend', () {
      expect(
        TransactionStatus.values
            .map((TransactionStatus s) => s.wireValue)
            .toList(),
        <String>['COMPLETED', 'CANCELLED'],
      );
      expect(
        ShiftStatus.values.map((ShiftStatus s) => s.wireValue).toList(),
        <String>['OPEN', 'CLOSED'],
      );
    });
  });
}
