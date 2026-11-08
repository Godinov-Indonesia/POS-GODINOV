import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/cart_cubit.dart';

void main() {
  late CartCubit cart;

  setUp(() => cart = CartCubit());
  tearDown(() => cart.close());

  void addKopi({int priceMinor = 2200000}) => cart.addProduct(
        productId: 'prod-kopi',
        productName: 'Kopi Susu Gula Aren',
        priceMinor: priceMinor,
      );

  group('Menambah produk', () {
    test('produk baru menjadi baris baru', () {
      addKopi();

      expect(cart.state.lines, hasLength(1));
      expect(cart.state.totalMinor, 2200000);
      expect(cart.state.itemCount, 1);
    });

    test('produk yang sama menaikkan kuantitas, bukan menambah baris', () {
      addKopi();
      addKopi();

      expect(cart.state.lines, hasLength(1));
      expect(cart.state.lines.single.quantity, 2);
      expect(cart.state.totalMinor, 4400000);
    });

    test('setiap baris mendapat UUID sendiri', () {
      addKopi();
      cart.addProduct(
        productId: 'prod-teh',
        productName: 'Es Teh Manis',
        priceMinor: 800000,
      );

      final Set<String> ids =
          cart.state.lines.map((CartLine l) => l.id).toSet();
      expect(ids, hasLength(2));
      expect(ids.every((String id) => id.isNotEmpty), isTrue);
    });

    test('UUID baris TIDAK berubah saat kuantitas dinaikkan', () {
      // UUID dibuat saat item lahir dan menjadi `transaction_items.id`;
      // menggantinya merusak idempotensi backend ([03 §2.3]).
      addKopi();
      final String idAwal = cart.state.lines.single.id;

      addKopi();
      cart.increment(idAwal);

      expect(cart.state.lines.single.id, idAwal);
      expect(cart.state.lines.single.quantity, 3);
    });

    test('harga adalah SNAPSHOT — sync master tidak mengubah keranjang', () {
      addKopi(); // Rp 22.000
      // Sinkronisasi master menaikkan harga menjadi Rp 25.000.
      addKopi(priceMinor: 2500000);

      // Baris yang sudah ada tetap memakai harga saat item pertama ditambahkan.
      expect(cart.state.lines.single.unitPriceMinor, 2200000);
      expect(cart.state.totalMinor, 4400000);
    });

    test('kuantitas nol atau negatif diabaikan', () {
      cart.addProduct(
        productId: 'p',
        productName: 'X',
        priceMinor: 1000,
        quantity: 0,
      );
      expect(cart.state.isEmpty, isTrue);
    });
  });

  group('Mengubah baris', () {
    test('increment dan decrement', () {
      addKopi();
      final String id = cart.state.lines.single.id;

      cart.increment(id);
      expect(cart.state.lines.single.quantity, 2);

      cart.decrement(id);
      expect(cart.state.lines.single.quantity, 1);
    });

    test('decrement sampai nol menghapus baris', () {
      addKopi();
      final String id = cart.state.lines.single.id;

      cart.decrement(id);

      expect(cart.state.isEmpty, isTrue);
    });

    test('setQuantity dengan nilai <= 0 menghapus baris', () {
      addKopi();
      cart.setQuantity(cart.state.lines.single.id, -5);
      expect(cart.state.isEmpty, isTrue);
    });

    test('catatan tersimpan pada baris yang benar', () {
      addKopi();
      final String id = cart.state.lines.single.id;

      cart.setNote(id, 'less sugar');

      expect(cart.state.lines.single.note, 'less sugar');
    });

    test('operasi pada id yang tidak ada tidak mengubah apa pun', () {
      addKopi();
      final CartState sebelum = cart.state;

      cart.increment('id-palsu');
      cart.decrement('id-palsu');

      expect(cart.state.lines, sebelum.lines);
    });
  });

  group('Turunan state', () {
    test('subtotal dan total selalu konsisten dengan lines', () {
      addKopi();
      cart.addProduct(
        productId: 'prod-croissant',
        productName: 'Croissant Butter',
        priceMinor: 1800000,
      );
      cart.increment(cart.state.lines.first.id);

      // 2 × Rp 22.000 + 1 × Rp 18.000 = Rp 62.000
      expect(cart.state.subtotalMinor, 6200000);
      expect(cart.state.totalMinor, cart.state.subtotalMinor);
      expect(cart.state.itemCount, 3);
    });
  });

  group('Tahan & ambil kembali', () {
    test('restore mengisi keranjang dengan UUID baris yang SAMA', () {
      const List<CartLine> tertahan = <CartLine>[
        CartLine(
          id: 'item-lama-1',
          productId: 'prod-kopi',
          productName: 'Kopi Susu Gula Aren',
          unitPriceMinor: 2200000,
          quantity: 2,
        ),
      ];

      cart.restore(tertahan, heldId: 'held-1');

      expect(cart.state.lines.single.id, 'item-lama-1');
      expect(cart.state.resumedFromHeldId, 'held-1');
      expect(cart.state.totalMinor, 4400000);
    });

    test('clear mengosongkan seluruh state', () {
      addKopi();
      cart.setCustomerName('Andi');

      cart.clear();

      expect(cart.state.isEmpty, isTrue);
      expect(cart.state.customerName, '');
      expect(cart.state.resumedFromHeldId, isNull);
    });
  });
}
