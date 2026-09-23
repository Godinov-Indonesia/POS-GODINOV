import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/core/network/envelope.dart';

/// Membangun [Response] tiruan tanpa menyentuh jaringan.
Response<dynamic> _response(Object? body, {int status = 200}) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: '/v1/pos/sync/master-data'),
    statusCode: status,
    data: body,
  );
}

Map<String, dynamic> _envelope(Object? data) => <String, dynamic>{
      'status': 'success',
      'message': 'Master data berhasil disinkronisasi',
      'data': data,
    };

/// DTO minimal untuk menguji pemetaan.
class _Item {
  const _Item(this.id);

  factory _Item.fromJson(Map<String, dynamic> json) =>
      _Item(json['id'] as String);

  final String id;
}

void main() {
  group('Envelope.list — null koleksi menjadi []', () {
    // Inilah pertahanan terhadap [03 §2.2]: service backend membangun slice
    // dengan `append` ke variabel nil, sehingga outlet tanpa produk menghasilkan
    // "products": null, bukan [].
    test('null menghasilkan daftar kosong, bukan lemparan', () {
      expect(Envelope.list(null, _Item.fromJson), isEmpty);
    });

    test('daftar kosong tetap kosong', () {
      expect(Envelope.list(<dynamic>[], _Item.fromJson), isEmpty);
    });

    test('ketiga koleksi master data dinormalkan secara independen', () {
      // Kasus nyata: outlet baru yang sudah punya staff tetapi belum punya
      // produk maupun kategori.
      final Map<String, dynamic> data = <String, dynamic>{
        'staffs': <dynamic>[
          <String, dynamic>{'id': 'staff-1'},
        ],
        'categories': null,
        'products': null,
      };

      expect(Envelope.list(data['staffs'], _Item.fromJson), hasLength(1));
      expect(Envelope.list(data['categories'], _Item.fromJson), isEmpty);
      expect(Envelope.list(data['products'], _Item.fromJson), isEmpty);
    });

    test('memetakan setiap baris lewat fromJson', () {
      final List<_Item> items = Envelope.list(
        <dynamic>[
          <String, dynamic>{'id': 'a'},
          <String, dynamic>{'id': 'b'},
        ],
        _Item.fromJson,
      );

      expect(items.map((_Item i) => i.id), <String>['a', 'b']);
    });

    test('koleksi berisi elemen non-objek ditolak sebagai ContractFailure', () {
      expect(
        () => Envelope.list(<dynamic>['bukan objek'], _Item.fromJson),
        throwsA(isA<ContractFailure>()),
      );
    });

    test('nilai non-koleksi ditolak sebagai ContractFailure', () {
      expect(
        () => Envelope.list('bukan daftar', _Item.fromJson),
        throwsA(isA<ContractFailure>()),
      );
    });
  });

  group('Envelope.unwrap', () {
    test('mengembalikan isi data saat status success', () {
      final Object? data = Envelope.unwrap(
        _response(_envelope(<String, dynamic>{'device_token': 'v4.local.x'})),
      );

      expect(data, isA<Map<String, dynamic>>());
    });

    test('status fail dilempar sebagai ApiFailure dengan pesan server', () {
      // Pesan backend sudah berbahasa Indonesia dan layak tampil apa adanya.
      final Response<dynamic> response = _response(
        <String, dynamic>{
          'status': 'fail',
          'message': 'kredensial bisnis tidak valid',
        },
        status: 401,
      );

      expect(
        () => Envelope.unwrap(response),
        throwsA(
          isA<ApiFailure>().having(
            (ApiFailure f) => f.message,
            'message',
            'kredensial bisnis tidak valid',
          ),
        ),
      );
    });

    test('body bukan objek JSON ditolak sebagai ContractFailure', () {
      expect(
        () => Envelope.unwrap(_response('<html>502 Bad Gateway</html>')),
        throwsA(isA<ContractFailure>()),
      );
    });

    test('data null diteruskan apa adanya untuk dinormalkan list()', () {
      expect(Envelope.unwrap(_response(_envelope(null))), isNull);
    });
  });

  group('Envelope.dataList', () {
    test('data null pada endpoint koleksi menjadi []', () {
      // `GET /v1/pos/transactions` pada outlet yang belum pernah berjualan.
      expect(
        Envelope.dataList(_response(_envelope(null)), _Item.fromJson),
        isEmpty,
      );
    });

    test('memetakan koleksi berisi', () {
      final List<_Item> items = Envelope.dataList(
        _response(
          _envelope(<dynamic>[
            <String, dynamic>{'id': 'tx-1'},
          ]),
        ),
        _Item.fromJson,
      );

      expect(items.single.id, 'tx-1');
    });
  });

  group('Envelope.data', () {
    test('data berupa koleksi ditolak saat objek diharapkan', () {
      expect(
        () => Envelope.data(
          _response(_envelope(<dynamic>[])),
          _Item.fromJson,
        ),
        throwsA(isA<ContractFailure>()),
      );
    });
  });

  group('Envelope.messageOf', () {
    test('mengambil message tingkat atas', () {
      expect(
        Envelope.messageOf(<String, dynamic>{'message': 'Berhasil'}),
        'Berhasil',
      );
    });

    test('jatuh ke errors bila message kosong', () {
      // Kunci di dalam `errors` bervariasi: server, password, credentials,
      // token, rate_limit, error ([03 §0]).
      expect(
        Envelope.messageOf(<String, dynamic>{
          'message': '   ',
          'errors': <String, dynamic>{'server': 'koneksi database terputus'},
        }),
        'koneksi database terputus',
      );
    });

    test('mengembalikan null bila tidak ada pesan yang dapat dipakai', () {
      expect(Envelope.messageOf(<String, dynamic>{}), isNull);
      expect(Envelope.messageOf('bukan map'), isNull);
      expect(Envelope.messageOf(null), isNull);
    });
  });
}
