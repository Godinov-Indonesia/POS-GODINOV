import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/features/register/domain/cart_math.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/sale_transaction.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:uuid/uuid.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/tender_draft.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';
import 'package:posgodinov_mobile/core/printer/print_queue_service.dart';
import 'package:posgodinov_mobile/core/printer/audit_receipt_data.dart';
import 'package:posgodinov_mobile/core/database/tables/void_logs_table.dart';
import 'package:posgodinov_mobile/core/database/daos/void_log_dao.dart';
import 'dart:convert';

class RegisterRepositoryImpl implements RegisterRepository {
  const RegisterRepositoryImpl({
    required TransactionDao dao,
    required VoidLogDao voidLogDao,
    required PrintQueueService printQueue,
    Uuid uuid = const Uuid(),
    DateTime Function()? now,
  })  : _dao = dao,
        _voidLogDao = voidLogDao,
        _printQueue = printQueue,
        _uuid = uuid,
        _now = now ?? DateTime.now;

  final TransactionDao _dao;

  /// Butir 5 — jejak audit penurunan kuantitas ([11 §M13.4]).
  final VoidLogDao _voidLogDao;

  /// Butir 6 — struk pembatalan untuk KETIGA cakupan void ([11 §M14.2]).
  final PrintQueueService _printQueue;

  final Uuid _uuid;
  final DateTime Function() _now;

  @override
  Future<SaleTransaction> completeSale({
    required String shiftId,
    required List<CartLine> lines,
    required PaymentMethod paymentMethod,
    required int cashReceivedMinor,
    String customerName = '',
    List<TenderDraft> tenders = const <TenderDraft>[],
  }) async {
    if (lines.isEmpty) {
      throw ArgumentError('Tidak dapat menyimpan transaksi tanpa item.');
    }

    // UUID transaksi dibuat SEKALI di sini. Baris keranjang sudah membawa
    // UUID-nya masing-masing sejak lahir, dan keduanya tidak pernah
    // diregenerasi saat pengiriman ulang ([03 §2.3]).
    final String transactionId = _uuid.v4();
    final DateTime createdAt = _now().toUtc();
    final int totalMinor = CartMath.total(lines);

    // ── Rincian tender — butir 8 ([11 §M17.2]) ───────────────────────────
    //
    // Metode tunggal mensintesis SATU baris tender, bukan nol. Invarian
    // `Σ tenders = total_amount` karena itu berlaku untuk setiap transaksi,
    // dan sisi server tidak perlu mengenal dua bentuk.
    final List<TenderDraft> effective = tenders.isEmpty
        ? <TenderDraft>[
            TenderDraft(
              method: _asTender(paymentMethod),
              amountMinor: totalMinor,
            ),
          ]
        : tenders;

    final int tendered =
        effective.fold(0, (int sum, TenderDraft t) => sum + t.amountMinor);
    if (tendered != totalMinor) {
      // Ditolak DI SINI, bukan saat sinkronisasi: baris yang sudah tertulis
      // akan ditolak server berulang kali tanpa cara memperbaikinya dari
      // perangkat.
      throw ArgumentError(
        'Rincian pembayaran tidak seimbang: $tendered sen vs total $totalMinor sen.',
      );
    }

    // `SPLIT` HANYA sah bila benar-benar ada dua tender atau lebih untuk
    // menjelaskannya ([11 §3.2]).
    final PaymentMethod summary = effective.length > 1
        ? PaymentMethod.split
        : _asPayment(effective.first.method);

    await _dao.insertWithItems(
      TransactionsCompanion.insert(
        id: transactionId,
        shiftId: shiftId,
        totalAmountMinor: totalMinor,
        paymentMethod: summary,
        status: TransactionStatus.completed,
        clientCreatedAt: createdAt,
        customerName: Value<String>(customerName),
        // `synced` dibiarkan pada nilai bawaan `false`: transaksi langsung
        // masuk antrean sinkronisasi.
      ),
      lines
          .map(
            (CartLine l) => TransactionItemsCompanion.insert(
              id: l.id,
              transactionId: transactionId,
              productId: l.productId,
              productName: l.productName,
              quantity: l.quantity,
              unitPriceMinor: l.unitPriceMinor,
            ),
          )
          .toList(growable: false),
      // ── Baris tender — butir 8 ([11 §3.2]) ─────────────────────────────
      //
      // Ditulis dalam TRANSAKSI yang sama dengan transaksinya sendiri
      // (`insertWithItems` membungkus keduanya). Menulisnya terpisah membuka
      // jendela di mana transaksi ada tetapi rinciannya belum — dan
      // `assertTenderIntegrity` akan menolak baris itu selamanya saat
      // sinkronisasi, tanpa cara memperbaikinya dari perangkat.
      payments: <TransactionPaymentsCompanion>[
        for (int i = 0; i < effective.length; i++)
          TransactionPaymentsCompanion.insert(
            id: _uuid.v4(),
            transactionId: transactionId,
            // `sequence` mulai dari 1, bukan 0 — cerminan langsung kolom
            // `transaction_payments.sequence` di PostgreSQL. Ketidakcocokan
            // satu angka di sini hanya terlihat saat rekonsiliasi EDC
            // berbulan-bulan kemudian.
            sequence: Value<int>(i + 1),
            method: effective[i].method,
            amountMinor: effective[i].amountMinor,
            traceNumber: Value<String?>(effective[i].traceNumber),
            cardLast4: Value<String?>(effective[i].cardLast4),
          ),
      ],
    );

    return SaleTransaction(
      id: transactionId,
      shiftId: shiftId,
      lines: lines,
      totalAmountMinor: totalMinor,
      paymentMethod: paymentMethod,
      status: TransactionStatus.completed,
      clientCreatedAt: createdAt,
      customerName: customerName,
      cashReceivedMinor: cashReceivedMinor,
    );
  }

  /// Mencatat pembatalan baris keranjang — butir 5 ([11 §M13.4]).
  ///
  /// Urutannya mengikat: log DULU, struk KEMUDIAN.
  ///
  /// Bila struk diantrekan lebih dulu dan penulisan log gagal, yang tersisa
  /// adalah kertas pembatalan untuk peristiwa yang tidak ada catatannya —
  /// tepat kebalikan dari yang butir 5 dan 6 bangun bersama.
  @override
  Future<void> recordCartLineVoid({
    required String shiftId,
    required String staffId,
    required CartLine line,
    required int quantityBefore,
    required int quantityAfter,
    required String reasonCode,
    required String reasonNotes,
    String? authorizedBy,
    String cashierName = '',
    String? authorizedByName,
  }) async {
    final int decrease = quantityBefore - quantityAfter;
    if (decrease <= 0) return;

    final DateTime now = _now().toUtc();
    final String voidLogId = _uuid.v4();
    final int valueMinor = decrease * line.unitPriceMinor;

    await _voidLogDao.insertLog(
      VoidLogsCompanion.insert(
        id: voidLogId,
        shiftId: shiftId,
        staffId: staffId,
        authorizedBy: Value<String?>(authorizedBy),
        scope: VoidScope.cartLine,
        // `ck_void_scope_ref` di PostgreSQL menolak baris `CART_LINE` tanpa
        // `product_id`: satu log gabungan tidak dapat menyatakan produk mana
        // yang lenyap ([11 §3.2]).
        productId: Value<String?>(line.productId),
        // `quantity_before` adalah PUNCAK, bukan kuantitas saat ini: yang
        // diaudit adalah seluruh penurunan sejak barang itu masuk keranjang,
        // bukan hanya ketukan terakhir.
        quantityBefore: Value<int>(quantityBefore),
        quantityAfter: Value<int>(quantityAfter),
        valueAmountMinor: valueMinor,
        reasonCode: reasonCode,
        reasonNotes: Value<String>(reasonNotes),
        // ⚠️ WAJIB UTUH. Baris keranjang tidak pernah ada di server; snapshot
        // ini satu-satunya salinan isi yang akan pernah dilihat auditor.
        itemsSnapshotJson: Value<String?>(
          jsonEncode(<Map<String, dynamic>>[
            <String, dynamic>{
              'product_id': line.productId,
              'product_name': line.productName,
              'quantity': decrease,
              'unit_price': Money.toMajor(line.unitPriceMinor),
            },
          ]),
        ),
        clientCreatedAt: now,
      ),
    );

    // ── BUTIR 6 — struk pembatalan, SETELAH log ter-commit ────────────────
    //
    // Aturan R6: kegagalan cetak tidak pernah menggulung pembatalan yang sudah
    // sah. `enqueueCancelReceipt` sendiri berjanji tidak melempar; `try` di
    // sini menjaga janji itu tetap benar bila kelak berubah.
    try {
      await _printQueue.enqueueCancelReceipt(
        voidLogId,
        CancelReceiptData(
          outletName: await _printQueue.resolveOutletName(),
          issuedAt: now,
          scope: VoidScope.cartLine,
          // Tidak ada kode struk maupun label pesanan: baris ini dibatalkan
          // SEBELUM menjadi transaksi apa pun. Keduanya sengaja dibiarkan null
          // alih-alih diisi teks karangan yang tampak seperti nomor sungguhan.
          cashierName: cashierName,
          authorizedByName: authorizedByName,
          reasonCode: reasonCode,
          reasonNotes: reasonNotes,
          lines: <AuditReceiptLine>[
            AuditReceiptLine(
              productName: line.productName,
              quantity: decrease,
              unitPriceMinor: line.unitPriceMinor,
            ),
          ],
          totalCancelledMinor: valueMinor,
        ),
      );
    } on Object {
      // sengaja ditelan — lihat catatan di atas
    }
  }

  /// [PaymentMethod] → [TenderMethod].
  ///
  /// Keduanya berbagi `wireValue`, sehingga jembatan lewat string tetap aman
  /// dan tidak menuntut pemetaan manual yang harus diperbarui setiap kali
  /// kontrak beku bertambah.
  static TenderMethod _asTender(PaymentMethod m) =>
      TenderMethod.fromWire(m.wireValue);

  /// [TenderMethod] → [PaymentSummary], untuk transaksi bertender tunggal.
  static PaymentSummary _asPayment(TenderMethod m) =>
      PaymentSummary.fromTender(m);
}
