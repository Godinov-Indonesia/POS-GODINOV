import 'dart:convert';

import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/return_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';

/// Menyusun payload `POST /v1/pos/sync` ([03 §2.3]).
///
/// **Tiga transformasi wajib**, dan ketiganya mudah terlewat:
///
/// 1. **Sen → Rupiah desimal.** Kolom server bertipe `DECIMAL(15,2)`; mengirim
///    sen apa adanya akan melipatgandakan seluruh nominal seratus kali.
/// 2. **Kolom lokal dibuang.** `synced`, `syncError`, `syncAttempts`,
///    `lastSyncAttemptAt` tidak pernah meninggalkan perangkat ([09 §6.3]
///    aturan 5).
/// 3. **`business_id`/`outlet_id` tidak dikirim.** Server menimpanya paksa dari
///    device token; mengirimnya hanya menambah ukuran payload dan menyesatkan
///    saat menelusuri log.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// v2 (M11.5) — DUA JALUR BERDAMPINGAN, BUKAN SATU YANG DIUBAH
/// ═══════════════════════════════════════════════════════════════════════════
///
/// [shift], [transaction], [waste], dan [body] **tetap memancarkan bentuk v1
/// persis seperti sebelumnya**. Varian `…V2` berdiri di sebelahnya dan baru
/// dipakai setelah M12 memasang header `X-POS-Contract-Version: 2` pada mesin
/// sync.
///
/// Alasannya adalah gerbang M11 itu sendiri: fase ini wajib menyelesaikan
/// bentuk data **tanpa mengubah satu pun perilaku yang terlihat**, termasuk
/// bentuk byte yang keluar ke jaringan. Menyunting mapper v1 di tempat akan
/// membuat kegagalan M11 dan kegagalan M12 mustahil dibedakan saat rilis
/// percontohan. Pembagian ini mencerminkan `decodeV1`/`decodeV2` di sisi Go
/// ([11 §4.1]).
abstract final class WireMapper {
  /// Bentuk kawat sebuah shift.
  ///
  /// Dikirim baik saat masih `OPEN` maupun setelah `CLOSED`: upsert backend
  /// hanya menyentuh kolom penutupan, sehingga pengiriman ulang aman
  /// ([02 §2.11]).
  static Map<String, dynamic> shift(LocalShift s) => <String, dynamic>{
        'id': s.id,
        'staff_id': s.staffId,
        'opening_balance': Money.toMajor(s.openingBalanceMinor),
        'closing_balance': Money.toMajor(s.closingBalanceMinor),
        'expected_balance': Money.toMajor(s.expectedBalanceMinor),
        'discrepancy': Money.toMajor(s.discrepancyMinor),
        'status': s.status.wireValue,
        'client_opened_at': _iso(s.clientOpenedAt),
        if (s.clientClosedAt != null)
          'client_closed_at': _iso(s.clientClosedAt!),
      };

  /// Bentuk kawat sebuah transaksi beserta itemnya.
  static Map<String, dynamic> transaction(TransactionWithItems t) {
    final LocalTransaction tx = t.transaction;

    // Jaring pengaman terakhir sebelum data meninggalkan perangkat. Nilai
    // `payment_method` yang tidak sah lebih baik menggagalkan sinkronisasi
    // daripada mencemari laporan historis selamanya — tidak ada endpoint untuk
    // memperbaiki data lama ([09 §9.3]).
    assert(
      PaymentSummary.values.contains(tx.paymentMethod),
      'payment_method di luar kontrak beku: ${tx.paymentMethod}',
    );

    return <String, dynamic>{
      'id': tx.id,
      'shift_id': tx.shiftId,
      'customer_name': tx.customerName,
      'total_amount': Money.toMajor(tx.totalAmountMinor),
      'payment_method': tx.paymentMethod.wireValue,
      'status': tx.status.wireValue,
      'cancel_notes': tx.cancelNotes,
      'client_created_at': _iso(tx.clientCreatedAt),
      'items': t.items
          .map(
            (LocalTransactionItem i) => <String, dynamic>{
              'id': i.id,
              'transaction_id': i.transactionId,
              'product_id': i.productId,
              'quantity': i.quantity,
              'unit_price': Money.toMajor(i.unitPriceMinor),
              // `product_name` TIDAK dikirim — kolomnya tidak ada di server
              // ([02 §2.13]); ia hanya salinan lokal untuk struk dan riwayat.
            },
          )
          .toList(growable: false),
    };
  }

  static Map<String, dynamic> waste(LocalWaste w) => <String, dynamic>{
        'id': w.id,
        'staff_id': w.staffId,
        'product_id': w.productId,
        'quantity': w.quantity,
        'reason': w.reason,
        'client_created_at': _iso(w.clientCreatedAt),
      };

  /// Merakit seluruh payload.
  ///
  /// > ⚠️ Kunci koleksi waste adalah **`wastes`**, bukan `product_wastes`.
  /// > `CLIENTS.md` backend menyebut `product_wastes` dan itu **keliru**;
  /// > struct Go-nya `Wastes []*ProductWaste \\`json:"wastes"\\`` ([03 §2.3]).
  /// > Memakai nama yang salah membuat data waste diabaikan server **tanpa
  /// > error apa pun** — kegagalan paling senyap yang mungkin terjadi.
  static Map<String, dynamic> body({
    required List<LocalShift> shifts,
    required List<TransactionWithItems> transactions,
    required List<LocalWaste> wastes,
  }) =>
      <String, dynamic>{
        'shifts': shifts.map(shift).toList(growable: false),
        'transactions': transactions.map(transaction).toList(growable: false),
        'wastes': wastes.map(waste).toList(growable: false),
      };

  /* ═══════════════════ v2 — kontrak sync versi 2 ([11 §4.2]) ═══════════════ */

  /// Bentuk kawat satu baris tender (butir 8).
  static Map<String, dynamic> payment(LocalTransactionPayment p) =>
      <String, dynamic>{
        'id': p.id,
        'sequence': p.sequence,
        'method': p.method.wireValue,
        'amount': Money.toMajor(p.amountMinor),
        if (p.traceNumber != null) 'trace_number': p.traceNumber,
        if (p.cardLast4 != null) 'card_last4': p.cardLast4,
        if (p.cardNetwork != null) 'card_network': p.cardNetwork,
        if (p.approvalCode != null) 'approval_code': p.approvalCode,
        if (p.edcTerminalId != null) 'edc_terminal_id': p.edcTerminalId,
      };

  /// Rincian tender sebuah transaksi, dengan **sintesis** untuk baris warisan.
  ///
  /// Transaksi yang lahir sebelum M17.2 memasang penulis multi-tender hanya
  /// memiliki `paymentMethod`. Merekonstruksi satu baris tender di sini menjaga
  /// invarian `Σ amount == totalAmount` berlaku untuk **setiap** baris, berapa
  /// pun umurnya — sehingga sisi server tidak perlu mengenal dua bentuk.
  ///
  /// `id` sengaja memakai ulang UUID transaksi: deterministik, sehingga
  /// pengiriman ulang tidak menyisipkan tender ganda ([11 §1] aturan R2).
  static List<LocalTransactionPayment> resolvePayments(
    TransactionWithItems t,
  ) {
    if (t.payments.isNotEmpty) return t.payments;

    final LocalTransaction tx = t.transaction;
    return <LocalTransactionPayment>[
      LocalTransactionPayment(
        id: tx.id,
        transactionId: tx.id,
        sequence: 1,
        // `split` TIDAK dapat direkonstruksi menjadi satu tender: ia menyatakan
        // ada dua tender atau lebih dan tidak menyisakan informasi tentang
        // pembagiannya. Mengarang pembagian berarti memalsukan bukti audit,
        // jadi baris seperti itu gagal keras di `assertTenderIntegrity`.
        method: TenderMethod.fromWire(tx.paymentMethod.wireValue),
        amountMinor: tx.totalAmountMinor,
      ),
    ];
  }

  /// Invarian tender yang **wajib** dipenuhi sebelum payload meninggalkan
  /// perangkat.
  ///
  /// > ⚠️ Sengaja `throw`, **bukan** `assert`. `assert` dibuang pada build
  /// > rilis, sehingga payload yang tidak seimbang justru akan lolos diam-diam
  /// > di satu-satunya tempat yang penting — perangkat kasir sungguhan.
  ///
  /// Server menolak ketidakcocokan dengan `422 TENDER_MISMATCH` dan baris masuk
  /// karantina ([11 §3.4]). Memeriksanya di sini mengubah kegagalan senyap yang
  /// baru ketahuan berjam-jam kemudian menjadi lemparan di tempat, dengan angka
  /// yang menjelaskan dirinya sendiri.
  static void assertTenderIntegrity(
    LocalTransaction tx,
    List<LocalTransactionPayment> payments,
  ) {
    final int sum = payments.fold<int>(
      0,
      (int acc, LocalTransactionPayment p) => acc + p.amountMinor,
    );

    if (sum != tx.totalAmountMinor) {
      throw StateError(
        'Tender tidak seimbang pada transaksi ${tx.id}: '
        'Σ payments = $sum sen, total_amount = ${tx.totalAmountMinor} sen.',
      );
    }

    for (final LocalTransactionPayment p in payments) {
      // Cerminan `CHECK ck_card_requires_trace` (butir 8). Ditegakkan di tiga
      // lapis — layar, berkas ini, dan basis data — karena lapisan UI saja
      // dapat dilewati perangkat yang dimodifikasi.
      if (!p.method.requiresCardDetails) continue;

      if ((p.traceNumber ?? '').trim().isEmpty) {
        throw StateError(
          'Tender kartu tanpa trace_number pada transaksi ${tx.id}.',
        );
      }
      if (!RegExp(r'^[0-9]{4}$').hasMatch(p.cardLast4 ?? '')) {
        throw StateError(
          'Tender kartu tanpa 4 digit akhir yang sah pada transaksi ${tx.id}.',
        );
      }
    }
  }

  /// Shift pada kontrak v2.
  ///
  /// ⚠️ `expected_balance` dan `discrepancy` **tetap dikirim** demi
  /// kompatibilitas v1, tetapi server **mengabaikannya** dan menghitung ulang
  /// ([11 §1] aturan R4). Klien yang dimodifikasi tidak boleh menentukan
  /// selisih kasnya sendiri.
  static Map<String, dynamic> shiftV2(LocalShift s, String deviceId) =>
      <String, dynamic>{
        ...shift(s),
        'device_id': s.deviceId == 'legacy' ? deviceId : s.deviceId,
        'master_data_version': s.masterDataVersion,
        'declared_cash': Money.toMajor(s.declaredCashMinor),
        'declared_edc_total': Money.toMajor(s.declaredEdcTotalMinor),
        'declared_qris_total': Money.toMajor(s.declaredQrisTotalMinor),
        'blind_close': s.blindClose,
        'closed_by': s.closedBy,
      };

  /// Transaksi pada kontrak v2, beserta rincian tendernya.
  static Map<String, dynamic> transactionV2(
    TransactionWithItems t,
    String deviceId,
  ) {
    final LocalTransaction tx = t.transaction;
    final List<LocalTransactionPayment> payments = resolvePayments(t);
    assertTenderIntegrity(tx, payments);

    // Ringkasan v1-compat: `SPLIT` hanya sah bila benar-benar ada dua tender
    // atau lebih untuk menjelaskannya.
    final String summary = payments.length > 1
        ? PaymentSummary.split.wireValue
        : payments.first.method.wireValue;

    return <String, dynamic>{
      ...transaction(t),
      'payment_method': summary,
      'payments':
          payments.map(payment).toList(growable: false),
      'device_id': tx.deviceId == 'legacy' ? deviceId : tx.deviceId,
      'short_code': tx.shortCode,
      'receipt_printed_at':
          tx.receiptPrintedAt == null ? null : _iso(tx.receiptPrintedAt!),
      'reprint_count': tx.reprintCount,
      'voided_at': tx.voidedAt == null ? null : _iso(tx.voidedAt!),
      'voided_by': tx.voidedBy,
      'void_reason_code': tx.voidReasonCode,
    };
  }

  /// Bentuk kawat sebuah retur beserta itemnya (butir 15).
  static Map<String, dynamic> returnEntity(ReturnWithItems r, String deviceId) {
    final LocalReturn row = r.returnRow;

    return <String, dynamic>{
      'id': row.id,
      'original_transaction_id': row.originalTransactionId,
      'shift_id': row.shiftId,
      'device_id': row.deviceId == 'legacy' ? deviceId : row.deviceId,
      'staff_id': row.staffId,
      'authorized_by': row.authorizedBy,
      'return_type': row.returnType.wireValue,
      'refund_method': row.refundMethod.wireValue,
      'refund_amount': Money.toMajor(row.refundAmountMinor),
      'reason_code': row.reasonCode,
      'reason_notes': row.reasonNotes,
      'receipt_printed': row.receiptPrinted,
      'short_code': row.shortCode,
      'client_created_at': _iso(row.clientCreatedAt),
      'items': r.items
          .map(
            (LocalReturnItem i) => <String, dynamic>{
              'id': i.id,
              'transaction_item_id': i.transactionItemId,
              'product_id': i.productId,
              'quantity': i.quantity,
              'unit_price': Money.toMajor(i.unitPriceMinor),
              'restock': i.restock,
              if (i.wasteReasonCode != null)
                'waste_reason_code': i.wasteReasonCode,
              // `product_name` TIDAK dikirim — kolomnya tidak ada di server;
              // ia hanya salinan lokal untuk struk dan riwayat.
            },
          )
          .toList(growable: false),
    };
  }

  /// Bentuk kawat sebuah log pembatalan (butir 5, 6, 13, 15).
  static Map<String, dynamic> voidLog(LocalVoidLog v, String deviceId) =>
      <String, dynamic>{
        'id': v.id,
        'shift_id': v.shiftId,
        'device_id': v.deviceId == 'legacy' ? deviceId : v.deviceId,
        'staff_id': v.staffId,
        'authorized_by': v.authorizedBy,
        'scope': v.scope.wireValue,
        'transaction_id': v.transactionId,
        'held_cart_id': v.heldCartId,
        'product_id': v.productId,
        'quantity_before': v.quantityBefore,
        'quantity_after': v.quantityAfter,
        'value_amount': Money.toMajor(v.valueAmountMinor),
        'reason_code': v.reasonCode,
        'reason_notes': v.reasonNotes,
        'receipt_printed': v.receiptPrinted,
        'items_snapshot': _decodeSnapshot(v.itemsSnapshotJson),
        'client_created_at': _iso(v.clientCreatedAt),
      };

  /// Bentuk kawat sebuah peristiwa keamanan ([11 §1] aturan R9).
  static Map<String, dynamic> securityEvent(
    LocalSecurityEvent e,
    String deviceId,
  ) =>
      <String, dynamic>{
        'id': e.id,
        'shift_id': e.shiftId,
        'staff_id': e.staffId,
        'device_id': e.deviceId == 'legacy' ? deviceId : e.deviceId,
        'event_type': e.eventType,
        'severity': e.severity.wireValue,
        'details': _decodeDetails(e.detailsJson),
        'client_created_at': _iso(e.clientCreatedAt),
      };

  /// Waste pada kontrak v2 (butir 7).
  static Map<String, dynamic> wasteV2(LocalWaste w, String deviceId) =>
      <String, dynamic>{
        ...waste(w),
        'shift_id': w.shiftId,
        'device_id': w.deviceId == 'legacy' ? deviceId : w.deviceId,
        'reason_code': w.reasonCode,
        'receipt_printed': w.receiptPrinted,
      };

  /// Merakit seluruh payload kontrak v2 ([11 §4.2]).
  ///
  /// Urutan kunci mencerminkan urutan pemrosesan server:
  /// `shifts → transactions → returns → void_logs → wastes → security_events`.
  /// Retur diproses setelah transaksi karena merujuknya; log pembatalan setelah
  /// keduanya karena dapat merujuk salah satunya.
  static Map<String, dynamic> bodyV2({
    required String deviceId,
    required int? masterDataVersion,
    required List<LocalShift> shifts,
    required List<TransactionWithItems> transactions,
    required List<ReturnWithItems> returns,
    required List<LocalVoidLog> voidLogs,
    required List<LocalWaste> wastes,
    required List<LocalSecurityEvent> securityEvents,
  }) =>
      <String, dynamic>{
        'device_id': deviceId,
        'master_data_version': masterDataVersion,
        'shifts': shifts
            .map((LocalShift s) => shiftV2(s, deviceId))
            .toList(growable: false),
        'transactions': transactions
            .map((TransactionWithItems t) => transactionV2(t, deviceId))
            .toList(growable: false),
        'returns': returns
            .map((ReturnWithItems r) => returnEntity(r, deviceId))
            .toList(growable: false),
        'void_logs': voidLogs
            .map((LocalVoidLog v) => voidLog(v, deviceId))
            .toList(growable: false),
        'wastes': wastes
            .map((LocalWaste w) => wasteV2(w, deviceId))
            .toList(growable: false),
        'security_events': securityEvents
            .map((LocalSecurityEvent e) => securityEvent(e, deviceId))
            .toList(growable: false),
      };

  /// Snapshot item disimpan sebagai JSON di SQLite tetapi dikirim sebagai
  /// array. JSON rusak **tidak boleh** menggagalkan pengiriman seluruh batch:
  /// nilai audit utama log pembatalan ada pada nominal dan pelakunya, bukan
  /// pada daftar itemnya.
  static List<dynamic>? _decodeSnapshot(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    try {
      final Object? decoded = jsonDecode(raw);
      return decoded is List ? decoded : null;
    } on FormatException {
      return null;
    }
  }

  static Map<String, dynamic> _decodeDetails(String raw) {
    try {
      final Object? decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    } on FormatException {
      return <String, dynamic>{};
    }
  }

  /// Waktu selalu dikirim UTC ISO-8601.
  ///
  /// **Tidak pernah dikoreksi** walau *clock skew* terdeteksi: nilai ini adalah
  /// kesaksian perangkat tentang kapan uang diterima ([05 §1.8.2]).
  static String _iso(DateTime t) => t.toUtc().toIso8601String();
}
