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
      // `VOIDED` ditambahkan pada v2 ([11 §2.1]); `CANCELLED` DIPERTAHANKAN
      // sebagai nilai warisan. Perangkat lapangan yang mati dua minggu akan
      // kembali membawa antrean berisi nilai lama, dan menolaknya berarti
      // membuang pembatalan yang benar-benar terjadi.
      expect(
        TransactionStatus.values
            .map((TransactionStatus s) => s.wireValue)
            .toList(),
        <String>['COMPLETED', 'VOIDED', 'CANCELLED'],
      );
      expect(
        ShiftStatus.values.map((ShiftStatus s) => s.wireValue).toList(),
        <String>['OPEN', 'CLOSED'],
      );
    });

    test('isCancellation mencakup VOIDED dan CANCELLED', () {
      // Melewatkan salah satunya berarti transaksi yang dibatalkan ikut
      // terhitung sebagai penjualan ([11 §2.4]).
      expect(TransactionStatus.voided.isCancellation, isTrue);
      expect(TransactionStatus.cancelled.isCancellation, isTrue);
      expect(TransactionStatus.completed.isCancellation, isFalse);
    });
  });

  /* ══════════════════════════ v2 — Fase M11.5 ═══════════════════════════ */

  group('TenderMethod & PaymentSummary — kontrak v2', () {
    test('daftar tender sesuai kesepakatan', () {
      expect(
        TenderMethod.values.map((TenderMethod m) => m.wireValue).toList(),
        <String>['CASH', 'QRIS', 'DEBIT', 'CREDIT', 'TRANSFER'],
      );
    });

    test('ringkasan menambahkan SPLIT di atas daftar tender', () {
      expect(
        PaymentSummary.values.map((PaymentSummary m) => m.wireValue).toList(),
        <String>[...TenderMethod.values.map((TenderMethod m) => m.wireValue),
          'SPLIT'],
      );
    });

    test('SPLIT bukan tender', () {
      // `SPLIT` adalah RINGKASAN atas dua tender atau lebih, bukan cara
      // membayar. Bila ia dapat menjadi nilai `transaction_payments.method`,
      // sebuah transaksi dapat mengaku gabungan tanpa satu pun baris tender
      // yang menjelaskannya.
      expect(() => TenderMethod.fromWire('SPLIT'), throwsArgumentError);
    });

    test('setiap PaymentMethod v1 adalah TenderMethod yang sah', () {
      for (final PaymentMethod m in PaymentMethod.values) {
        expect(TenderMethod.fromPaymentMethod(m).wireValue, m.wireValue);
      }
    });

    test('hanya kartu yang mewajibkan trace number & 4 digit akhir', () {
      // Cerminan `CHECK ck_card_requires_trace` ([11 §3.2] butir 8).
      expect(TenderMethod.debit.requiresCardDetails, isTrue);
      expect(TenderMethod.credit.requiresCardDetails, isTrue);
      expect(TenderMethod.cash.requiresCardDetails, isFalse);
      expect(TenderMethod.qris.requiresCardDetails, isFalse);
      expect(TenderMethod.transfer.requiresCardDetails, isFalse);
    });

    test('daftar tender Web dan Flutter identik', () {
      final File web = File(webContractPath);
      if (!web.existsSync()) {
        markTestSkipped('Kontrak Web tidak ditemukan di $webContractPath.');
        return;
      }

      final RegExpMatch? block = RegExp(
        r'TENDER_METHODS\s*=\s*\[(.*?)\]',
        dotAll: true,
      ).firstMatch(web.readAsStringSync());

      expect(
        block,
        isNotNull,
        reason: 'TENDER_METHODS tidak ditemukan di berkas kontrak Web',
      );

      final Set<String> webValues = RegExp("'([A-Z_]+)'")
          .allMatches(block!.group(1)!)
          .map((RegExpMatch m) => m.group(1)!)
          .toSet();

      expect(
        TenderMethod.values.map((TenderMethod m) => m.wireValue).toSet(),
        webValues,
        reason: 'Daftar tender Web dan Flutter menyimpang. Perbedaan sekecil '
            'apa pun memecah laporan historis secara permanen.',
      );
    });
  });

  group('Enum v2 — nilai kawat', () {
    test('VoidScope', () {
      expect(
        VoidScope.values.map((VoidScope s) => s.wireValue).toList(),
        <String>['CART_LINE', 'HELD_ORDER', 'TRANSACTION'],
      );
    });

    test('ReturnKind & ReturnState', () {
      expect(
        ReturnKind.values.map((ReturnKind k) => k.wireValue).toList(),
        <String>['FULL', 'PARTIAL'],
      );
      expect(
        ReturnState.values.map((ReturnState s) => s.wireValue).toList(),
        <String>['NONE', 'PARTIAL', 'FULL'],
      );
    });

    test('RefundMethod — hanya CASH yang memindahkan uang laci', () {
      expect(
        RefundMethod.values.map((RefundMethod m) => m.wireValue).toList(),
        <String>[
          'CASH',
          'CARD_REVERSAL',
          'QRIS_REVERSAL',
          'EXCHANGE',
          'STORE_CREDIT',
        ],
      );
      // `EXCHANGE` menukar barang tanpa uang berpindah; memasukkannya ke
      // hitungan kas membuat laci tampak kekurangan sebesar nilai tukar.
      expect(RefundMethod.exchange.movesCash, isFalse);
      expect(RefundMethod.cash.movesCash, isTrue);
    });

    test('SecuritySeverity & PrintJobStatus', () {
      expect(
        SecuritySeverity.values
            .map((SecuritySeverity s) => s.wireValue)
            .toList(),
        <String>['INFO', 'WARN', 'CRITICAL'],
      );
      expect(
        PrintJobStatus.values.map((PrintJobStatus s) => s.wireValue).toList(),
        <String>['PENDING', 'PRINTING', 'PRINTED', 'FAILED', 'ABANDONED'],
      );
    });

    test('kamus reason_code selalu menyediakan OTHER', () {
      // Tanpa jaring `OTHER`, kasir yang tidak menemukan alasan yang cocok akan
      // memilih alasan mana pun yang terdekat — dan laporan kecurangan
      // kehilangan seluruh dayanya.
      for (final List<String> dictionary in <List<String>>[
        ReasonCodes.voidReasons,
        ReasonCodes.returnReasons,
        ReasonCodes.wasteReasons,
      ]) {
        expect(dictionary, contains(ReasonCodes.other));
        expect(dictionary.toSet().length, dictionary.length,
            reason: 'kamus memuat duplikat');
      }
    });
  });
}
