import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
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
      PaymentMethod.values.contains(tx.paymentMethod),
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

  /// Waktu selalu dikirim UTC ISO-8601.
  ///
  /// **Tidak pernah dikoreksi** walau *clock skew* terdeteksi: nilai ini adalah
  /// kesaksian perangkat tentang kapan uang diterima ([05 §1.8.2]).
  static String _iso(DateTime t) => t.toUtc().toIso8601String();
}
