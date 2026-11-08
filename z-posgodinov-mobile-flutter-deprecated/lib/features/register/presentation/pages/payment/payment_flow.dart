import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/tender_draft.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/transaction_cubit.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/payment/payment_card_page.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/payment/payment_cash_page.dart';
import 'package:posgodinov_mobile/features/register/presentation/pages/payment/payment_split_page.dart';

/// Alur pembayaran — **butir 11** ([11 §M17.2]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// LAYAR PENUH, BUKAN MODAL — DAN SUB-LANGKAHNYA JUGA
/// ═══════════════════════════════════════════════════════════════════════════
///
/// `PaymentDialog` yang lama adalah SATU dialog yang memuat seluruh langkah
/// sebagai cabang `if`: pemilihan metode, input tunai, dan konfirmasi hidup di
/// komponen yang sama di atas *scrim*.
///
/// Konsekuensinya nyata bagi kasir:
///
///   · Tombol kembali perangkat menutup SELURUH pembayaran. Kasir yang salah
///     pilih metode kehilangan langkahnya dan mengulang dari keranjang.
///   · Dialog memaksa lebar terbatas, sehingga keypad tidak pernah mencapai
///     56 dp yang dituntut kelas "Kritis" ([06 §2.1]).
///   · Tidak ada tempat untuk daftar tender pada pembayaran split.
///
/// Kini masing-masing langkah adalah **rute Navigator tersendiri**, sehingga
/// back mundur SATU langkah dan setiap layar memakai lebar penuh.
///
/// ⚠️ Kembali dari sub-layar **tidak pernah menghapus keranjang**. Keranjang
/// hanya dibersihkan pemanggil setelah `TxCompleted`.
abstract final class PaymentFlow {
  /// Nama rute — dipakai `popUntil` saat pembayaran selesai.
  static const String methodRoute = 'payment/method';

  /// Membuka alur pembayaran sebagai halaman penuh.
  ///
  /// Mengembalikan `true` bila transaksi benar-benar tersimpan.
  static Future<bool> open(
    BuildContext context, {
    required TransactionCubit cubit,
    required int totalMinor,
    required Future<void> Function(
            List<TenderDraft> tenders, int cashReceivedMinor,)
        onConfirm,
    List<CartLine> lines = const <CartLine>[],
    String customerName = '',
    String outletName = '',
  }) async {
    cubit.startPayment(totalMinor);

    final bool? done = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        settings: const RouteSettings(name: 'payment/cash'),
        builder: (_) => BlocProvider<TransactionCubit>.value(
          value: cubit,
          child: PaymentCashPage(
            remainingMinor: totalMinor,
            lines: lines,
            customerName: customerName,
            outletName: outletName,
            onSubmit: (TenderDraft tender, int cashReceived) async {
              await onConfirm(<TenderDraft>[tender], cashReceived);
              if (context.mounted) {
                Navigator.of(context).pop(true);
              }
            },
          ),
        ),
      ),
    );

    if (done != true) {
      cubit.cancel();
    }
    return done ?? false;
  }

  /// Rute sub-langkah tunai.
  static Route<bool> cash({
    required TransactionCubit cubit,
    required int remainingMinor,
    required Future<void> Function(TenderDraft tender, int cashReceivedMinor)
        onSubmit,
    List<CartLine> lines = const <CartLine>[],
    String customerName = '',
    String outletName = '',
  }) =>
      MaterialPageRoute<bool>(
        settings: const RouteSettings(name: 'payment/cash'),
        builder: (_) => BlocProvider<TransactionCubit>.value(
          value: cubit,
          child: PaymentCashPage(
            remainingMinor: remainingMinor,
            lines: lines,
            customerName: customerName,
            outletName: outletName,
            onSubmit: onSubmit,
          ),
        ),
      );

  /// Rute sub-langkah kartu / non-tunai.
  static Route<bool> card({
    required TransactionCubit cubit,
    required TenderMethod method,
    required int remainingMinor,
    required Future<void> Function(TenderDraft tender) onSubmit,
    required void Function(TenderDraft tender) onAddAndContinue,
  }) =>
      MaterialPageRoute<bool>(
        settings: const RouteSettings(name: 'payment/card'),
        builder: (_) => BlocProvider<TransactionCubit>.value(
          value: cubit,
          child: PaymentCardPage(
            method: method,
            remainingMinor: remainingMinor,
            onSubmit: onSubmit,
            onAddAndContinue: onAddAndContinue,
          ),
        ),
      );

  /// Rute penyusun pembayaran terpisah.
  static Route<bool> split({
    required TransactionCubit cubit,
    required int totalMinor,
    required List<TenderDraft> tenders,
    required void Function(int index) onRemove,
    required VoidCallback onAdd,
    required Future<void> Function() onSubmit,
  }) =>
      MaterialPageRoute<bool>(
        settings: const RouteSettings(name: 'payment/split'),
        builder: (_) => BlocProvider<TransactionCubit>.value(
          value: cubit,
          child: PaymentSplitPage(
            totalMinor: totalMinor,
            tenders: tenders,
            onRemove: onRemove,
            onAdd: onAdd,
            onSubmit: onSubmit,
          ),
        ),
      );
}
