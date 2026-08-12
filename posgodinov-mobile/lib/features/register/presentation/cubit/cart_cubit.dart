import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/features/register/domain/cart_math.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:uuid/uuid.dart';

/// Keranjang berjalan.
///
/// Subtotal dan total adalah **getter turunan**, bukan field tersimpan — tidak
/// ada peluang keduanya menjadi tidak sinkron dengan [lines] ([09 §7.2]).
class CartState extends Equatable {
  const CartState({
    this.lines = const <CartLine>[],
    this.customerName = '',
    this.resumedFromHeldId,
  });

  final List<CartLine> lines;
  final String customerName;

  /// Terisi bila keranjang ini berasal dari pesanan tertahan.
  final String? resumedFromHeldId;

  int get subtotalMinor => CartMath.subtotal(lines);
  int get totalMinor => CartMath.total(lines);
  int get itemCount => CartMath.itemCount(lines);
  bool get isEmpty => lines.isEmpty;
  bool get isNotEmpty => lines.isNotEmpty;

  CartState copyWith({
    List<CartLine>? lines,
    String? customerName,
    String? resumedFromHeldId,
  }) =>
      CartState(
        lines: lines ?? this.lines,
        customerName: customerName ?? this.customerName,
        resumedFromHeldId: resumedFromHeldId ?? this.resumedFromHeldId,
      );

  @override
  List<Object?> get props => <Object?>[lines, customerName, resumedFromHeldId];
}

/// Keranjang bersifat **ephemeral** dan berubah pada setiap ketukan.
///
/// Dipisahkan tegas dari `TransactionCubit` yang mengurus persistensi, dan dari
/// `SyncCubit` yang bekerja di latar. Menggabungkan ketiganya adalah cara
/// termudah membuat keranjang kasir ter-*reset* saat sinkronisasi gagal —
/// bug yang mahal dan sulit direproduksi ([09 §7.1]).
class CartCubit extends Cubit<CartState> {
  CartCubit({Uuid uuid = const Uuid()})
      : _uuid = uuid,
        super(const CartState());

  final Uuid _uuid;

  /// Menambahkan produk, atau menaikkan kuantitas bila sudah ada.
  ///
  /// [priceMinor] adalah **snapshot**: sinkronisasi master di tengah transaksi
  /// tidak mengubah harga yang sudah masuk keranjang.
  void addProduct({
    required String productId,
    required String productName,
    required int priceMinor,
    int quantity = 1,
  }) {
    if (quantity <= 0) return;

    final int idx =
        state.lines.indexWhere((CartLine l) => l.productId == productId);

    if (idx >= 0) {
      final List<CartLine> updated = List<CartLine>.of(state.lines);
      updated[idx] =
          updated[idx].copyWith(quantity: updated[idx].quantity + quantity);
      emit(state.copyWith(lines: updated));
      return;
    }

    emit(
      state.copyWith(
        lines: <CartLine>[
          ...state.lines,
          CartLine(
            // UUID item dibuat saat lahir dan tidak pernah diganti — ia menjadi
            // `transaction_items.id` saat transaksi disimpan ([03 §2.3]).
            id: _uuid.v4(),
            productId: productId,
            productName: productName,
            unitPriceMinor: priceMinor,
            quantity: quantity,
          ),
        ],
      ),
    );
  }

  /// Menetapkan kuantitas. Nilai `<= 0` menghapus baris.
  void setQuantity(String lineId, int quantity) {
    if (quantity <= 0) {
      removeLine(lineId);
      return;
    }

    emit(
      state.copyWith(
        lines: state.lines
            .map(
              (CartLine l) => l.id == lineId ? l.copyWith(quantity: quantity) : l,
            )
            .toList(growable: false),
      ),
    );
  }

  void increment(String lineId) {
    final CartLine? line = _find(lineId);
    if (line != null) setQuantity(lineId, line.quantity + 1);
  }

  void decrement(String lineId) {
    final CartLine? line = _find(lineId);
    if (line != null) setQuantity(lineId, line.quantity - 1);
  }

  void removeLine(String lineId) {
    emit(
      state.copyWith(
        lines: state.lines
            .where((CartLine l) => l.id != lineId)
            .toList(growable: false),
      ),
    );
  }

  void setNote(String lineId, String note) {
    emit(
      state.copyWith(
        lines: state.lines
            .map((CartLine l) => l.id == lineId ? l.copyWith(note: note) : l)
            .toList(growable: false),
      ),
    );
  }

  void setCustomerName(String name) => emit(state.copyWith(customerName: name));

  /// Mengisi keranjang dari pesanan tertahan yang diambil kembali.
  void restore(List<CartLine> lines, {String? heldId}) {
    emit(CartState(lines: lines, resumedFromHeldId: heldId));
  }

  /// Mengosongkan keranjang — dipanggil setelah transaksi tersimpan, setelah
  /// pesanan ditahan, dan oleh tombol "Kosongkan".
  void clear() => emit(const CartState());

  CartLine? _find(String lineId) {
    for (final CartLine l in state.lines) {
      if (l.id == lineId) return l;
    }
    return null;
  }
}
