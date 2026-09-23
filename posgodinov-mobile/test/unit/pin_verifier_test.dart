import 'package:bcrypt/bcrypt.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/crypto/pin_verifier.dart';

void main() {
  // `compute` membuat isolate sungguhan; binding harus siap lebih dulu.
  TestWidgetsFlutterBinding.ensureInitialized();

  const PinVerifier verifier = PinVerifier();

  // Cost 10 = `bcrypt.DefaultCost` yang dipakai backend Go ([01 §2]).
  final String hashBenar = BCrypt.hashpw('1234', BCrypt.gensalt(logRounds: 10));

  group('PinVerifier.verify', () {
    test('PIN benar diterima', () async {
      expect(
        await verifier.verify(pin: '1234', pinHash: hashBenar),
        isTrue,
      );
    });

    test('PIN salah ditolak', () async {
      expect(
        await verifier.verify(pin: '9999', pinHash: hashBenar),
        isFalse,
      );
    });

    test('PIN kosong ditolak', () async {
      expect(await verifier.verify(pin: '', pinHash: hashBenar), isFalse);
    });

    test('staff tidak ditemukan (hash null) selalu ditolak', () async {
      expect(await verifier.verify(pin: '1234', pinHash: null), isFalse);
    });

    test('hash umpan tidak pernah cocok dengan PIN apa pun', () async {
      // Bila hash umpan kebetulan cocok, verifier tetap wajib menolak karena
      // staff-nya memang tidak ada.
      for (final String pin in <String>['0000', '1234', '999999']) {
        expect(
          await verifier.verify(pin: pin, pinHash: PinVerifier.decoyHash),
          isFalse,
          reason: pin,
        );
      }
    });

    test('PIN 6 digit didukung', () async {
      final String hash6 =
          BCrypt.hashpw('135790', BCrypt.gensalt(logRounds: 10));

      expect(await verifier.verify(pin: '135790', pinHash: hash6), isTrue);
      expect(await verifier.verify(pin: '13579', pinHash: hash6), isFalse);
    });
  });

  group('Perlindungan terhadap kebocoran lewat waktu respons', () {
    // Backend tidak punya endpoint login kasir ([01 §4.5]); perangkat inilah
    // satu-satunya gerbang. Bila identifier yang tidak ada dijawab seketika
    // sementara yang ada butuh ratusan milidetik, selisihnya cukup untuk
    // menebak identifier mana yang sah.
    test('staff tidak ada memakan waktu sebanding dengan staff ada', () async {
      final Stopwatch ada = Stopwatch()..start();
      await verifier.verify(pin: '0000', pinHash: hashBenar);
      ada.stop();

      final Stopwatch tidakAda = Stopwatch()..start();
      await verifier.verify(pin: '0000', pinHash: null);
      tidakAda.stop();

      // Ambang longgar: yang diuji adalah "sama-sama menjalankan bcrypt",
      // bukan kesetaraan waktu yang presisi. Tanpa hash umpan, jalur
      // `pinHash == null` akan selesai nyaris seketika.
      expect(
        tidakAda.elapsedMicroseconds,
        greaterThan(ada.elapsedMicroseconds ~/ 10),
        reason: 'jalur staff-tidak-ada tampak melewatkan bcrypt',
      );
    });
  });

  group('comparePinIsolate', () {
    test('dapat dipanggil langsung sebagai fungsi top-level', () {
      // Sifat top-level ini WAJIB: `compute` mengirim referensi fungsi ke
      // isolate baru, dan closure maupun method instance tidak dapat dikirim.
      expect(
        comparePinIsolate(PinComparePayload('1234', hashBenar)),
        isTrue,
      );
    });
  });
}
