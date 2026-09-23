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
    this.peakQuantity = const <String, int>{},
  });

  final List<CartLine> lines;
  final String customerName;

  /// Terisi bila keranjang ini berasal dari pesanan tertahan.
  final String? resumedFromHeldId;

  /// Kuantitas TERTINGGI yang pernah dicapai setiap baris dalam keranjang ini.
  ///
  /// ═══════════════════════════════════════════════════════════════════════
  /// MENGAPA PUNCAK, BUKAN PENGHITUNG PENURUNAN
  /// ═══════════════════════════════════════════════════════════════════════
  ///
  /// Rancangan awal ([11 §M13.4]) menyebut "akumulator penurunan yang direset
  /// saat baris ditambah". Bentuk itu dapat dipermainkan dengan sepele:
  /// turunkan 5 → tambah 1 → turunkan 5 lagi. Akumulatornya kembali nol, dan
  /// sembilan unit lenyap tanpa satu pun Void Sheet muncul.
  ///
  /// Puncak tidak dapat dipermainkan. Penurunan kumulatif SELALU
  /// `puncak − kuantitas sekarang`, sehingga menambah barang kembali
  /// benar-benar membatalkan penurunan alih-alih sekadar menghapus jejaknya.
  /// Dua aturan rancangan — "sekaligus > 5" dan "akumulasi > 5" — juga melebur
  /// menjadi satu pemeriksaan, dan satu pemeriksaan tidak dapat menyimpang
  /// dari dirinya sendiri.
  ///
  /// Kuncinya `lineId`, bukan `productId`: satu produk dapat muncul di dua
  /// baris dengan harga snapshot berbeda.
  final Map<String, int> peakQuantity;

  /// Penurunan kumulatif sebuah baris terhadap puncaknya.
  int decreaseOf(String lineId) {
    final CartLine? line = _lineOrNull(lineId);
    final int peak = peakQuantity[lineId] ?? line?.quantity ?? 0;
    final int current = line?.quantity ?? 0;
    return peak - current < 0 ? 0 : peak - current;
  }

  CartLine? _lineOrNull(String lineId) {
    for (final CartLine l in lines) {
      if (l.id == lineId) return l;
    }
    return null;
  }

  int get subtotalMinor => CartMath.subtotal(lines);
  int get totalMinor => CartMath.total(lines);
  int get itemCount => CartMath.itemCount(lines);
  bool get isEmpty => lines.isEmpty;
  bool get isNotEmpty => lines.isNotEmpty;

  CartState copyWith({
    List<CartLine>? lines,
    String? customerName,
    String? resumedFromHeldId,
    Map<String, int>? peakQuantity,
  }) =>
      CartState(
        lines: lines ?? this.lines,
        customerName: customerName ?? this.customerName,
        resumedFromHeldId: resumedFromHeldId ?? this.resumedFromHeldId,
        peakQuantity: peakQuantity ?? this.peakQuantity,
      );

  @override
  List<Object?> get props =>
      <Object?>[lines, customerName, resumedFromHeldId, peakQuantity];
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
      final int next = updated[idx].quantity + quantity;
      updated[idx] = updated[idx].copyWith(quantity: next);
      emit(
        state.copyWith(
          lines: updated,
          peakQuantity: _raisePeak(updated[idx].id, next),
        ),
      );
      return;
    }

    // UUID dibuat lebih dulu supaya puncak dapat dikunci ke baris yang sama.
    final String newId = _uuid.v4();

    emit(
      state.copyWith(
        lines: <CartLine>[
          ...state.lines,
          CartLine(
            // UUID item dibuat saat lahir dan tidak pernah diganti — ia menjadi
            // `transaction_items.id` saat transaksi disimpan ([03 §2.3]).
            id: newId,
            productId: productId,
            productName: productName,
            unitPriceMinor: priceMinor,
            quantity: quantity,
          ),
        ],
        peakQuantity: _raisePeak(newId, quantity),
      ),
    );
  }

  /// Menetapkan kuantitas. Nilai `<= 0` menghapus baris.
  ///
  /// ⚠️ **Tidak memeriksa ambang butir 5.** Penurunan yang berasal dari
  /// interaksi kasir wajib melewati [canDecrementTo]; metode ini dipakai jalur
  /// yang memang tidak diaudit — mis. menaikkan kuantitas.
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
        peakQuantity: _raisePeak(lineId, quantity),
      ),
    );
  }

  void increment(String lineId) {
    final CartLine? line = _find(lineId);
    if (line != null) setQuantity(lineId, line.quantity + 1);
  }

  /// ⚠️ **Jangan dipanggil langsung dari UI.** Pakai [canDecrementTo] lebih
  /// dulu; bila hasilnya `blocked`, buka Void Sheet dan panggil [applyAudited].
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

  /* ── BUTIR 5 — Strict Qty Audit ([11 §M13.4]) ──────────────────────────── */

  /// Apakah menurunkan sebuah baris ke [nextQuantity] masih boleh lewat stepper
  /// biasa.
  ///
  /// **Tidak mengubah apa pun.** Pemanggil yang menerima `blocked` wajib
  /// membuka Void Sheet, menulis `void_logs`, lalu memanggil [applyAudited].
  DecrementVerdict canDecrementTo(
    String lineId,
    int nextQuantity,
    int threshold,
  ) {
    final CartLine? line = _find(lineId);
    if (line == null) return const DecrementVerdict.allowed();

    final int clamped = nextQuantity < 0 ? 0 : nextQuantity;
    if (clamped >= line.quantity) return const DecrementVerdict.allowed();

    final int peak = state.peakQuantity[lineId] ?? line.quantity;
    final int totalDecrease = peak - clamped;

    if (totalDecrease > threshold) {
      return DecrementVerdict.blocked(
        totalDecrease: totalDecrease,
        threshold: threshold,
      );
    }
    return const DecrementVerdict.allowed();
  }

  /// Menurunkan kuantitas SETELAH pembatalan tercatat.
  ///
  /// Dipisahkan dari [setQuantity] supaya jalur yang melewati ambang tidak
  /// dapat dipakai tanpa sengaja: namanya sendiri menyatakan bahwa audit sudah
  /// dilakukan.
  void applyAudited(String lineId, int nextQuantity) {
    if (nextQuantity <= 0) {
      removeLine(lineId);
      return;
    }

    emit(
      state.copyWith(
        lines: state.lines
            .map(
              (CartLine l) =>
                  l.id == lineId ? l.copyWith(quantity: nextQuantity) : l,
            )
            .toList(growable: false),
        // Puncak SENGAJA tidak diturunkan. Pembatalan yang sudah tercatat tidak
        // menghapus fakta bahwa barang itu pernah masuk keranjang, dan
        // menurunkan puncak akan memberi kasir satu jatah ambang baru secara
        // cuma-cuma pada baris yang sama.
        peakQuantity: state.peakQuantity,
      ),
    );
  }

  /// Puncak hanya boleh naik — itulah yang membuatnya tidak dapat dipermainkan.
  Map<String, int> _raisePeak(String lineId, int quantity) {
    final int current = state.peakQuantity[lineId] ?? 0;
    if (quantity <= current) return state.peakQuantity;
    return <String, int>{...state.peakQuantity, lineId: quantity};
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
    emit(
      CartState(
        lines: lines,
        resumedFromHeldId: heldId,
        // Pesanan yang diambil kembali memulai jatah ambangnya sendiri:
        // kuantitas yang tersimpan ADALAH puncaknya.
        peakQuantity: <String, int>{
          for (final CartLine l in lines) l.id: l.quantity,
        },
      ),
    );
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


/// Hasil pemeriksaan ambang penurunan — **butir 5** ([11 §M13.4]).
///
/// `blocked` bukan kegagalan; ia adalah perintah untuk membuka Void Sheet.
class DecrementVerdict {
  const DecrementVerdict.allowed()
      : allowed = true,
        totalDecrease = 0,
        threshold = 0;

  const DecrementVerdict.blocked({
    required this.totalDecrease,
    required this.threshold,
  }) : allowed = false;

  final bool allowed;

  /// Berapa unit yang akan lenyap bila penurunan ini diteruskan.
  final int totalDecrease;

  final int threshold;
}
