import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';

/// Item baris untuk ditampilkan pada kertas thermal preview.
class ReceiptPreviewItem {
  const ReceiptPreviewItem({
    required this.name,
    required this.quantity,
    this.priceMinor = 0,
    this.totalMinor = 0,
    this.note,
  });

  final String name;
  final int quantity;
  final int priceMinor;
  final int totalMinor;
  final String? note;
}

/// Dialog Universal Preview Struk Thermal POS sebelum/saat dicetak fisik.
class ReceiptPreviewDialog extends StatelessWidget {
  const ReceiptPreviewDialog({
    super.key,
    required this.title,
    this.subtitle,
    required this.outletName,
    required this.dateTime,
    required this.cashierName,
    this.supervisorName,
    this.items = const <ReceiptPreviewItem>[],
    this.summaryRows = const <String, String>{},
    this.totalAmountMinor,
    this.onPrint,
  });

  final String title;
  final String? subtitle;
  final String outletName;
  final DateTime dateTime;
  final String cashierName;
  final String? supervisorName;
  final List<ReceiptPreviewItem> items;
  final Map<String, String> summaryRows;
  final int? totalAmountMinor;
  final Future<void> Function()? onPrint;

  static Future<void> open(
    BuildContext context, {
    required String title,
    String? subtitle,
    required String outletName,
    required DateTime dateTime,
    required String cashierName,
    String? supervisorName,
    List<ReceiptPreviewItem> items = const <ReceiptPreviewItem>[],
    Map<String, String> summaryRows = const <String, String>{},
    int? totalAmountMinor,
    Future<void> Function()? onPrint,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext ctx) => ReceiptPreviewDialog(
        title: title,
        subtitle: subtitle,
        outletName: outletName,
        dateTime: dateTime,
        cashierName: cashierName,
        supervisorName: supervisorName,
        items: items,
        summaryRows: summaryRows,
        totalAmountMinor: totalAmountMinor,
        onPrint: onPrint,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final DateFormat df = DateFormat('dd/MM/yyyy HH:mm:ss');

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(
        horizontal: Gap.lg,
        vertical: Gap.md,
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            // Kertas Struk Thermal
            Flexible(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(Radii.md),
                  boxShadow: <BoxShadow>[
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.35),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: Gap.lg,
                    vertical: Gap.xl,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      // Header Outlet
                      Text(
                        outletName.toUpperCase(),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.black,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        title.toUpperCase(),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                          letterSpacing: 1.1,
                        ),
                      ),
                      if (subtitle != null && subtitle!.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 2),
                        Text(
                          subtitle!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                      const SizedBox(height: Gap.xs),
                      const _DashedLine(),
                      const SizedBox(height: Gap.xs),

                      // Meta (Waktu, Kasir, Supervisor)
                      _metaRow('Waktu', df.format(dateTime)),
                      _metaRow('Kasir', cashierName),
                      if (supervisorName != null &&
                          supervisorName!.isNotEmpty)
                        _metaRow('Supervisor', supervisorName!),

                      const SizedBox(height: Gap.xs),
                      const _DashedLine(),
                      const SizedBox(height: Gap.xs),

                      // Daftar Item
                      if (items.isNotEmpty) ...<Widget>[
                        for (final ReceiptPreviewItem item in items) ...<Widget>[
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: <Widget>[
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Expanded(
                                      child: Text(
                                        item.name,
                                        style: const TextStyle(
                                          fontFamily: 'monospace',
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.black,
                                        ),
                                      ),
                                    ),
                                    if (item.totalMinor > 0)
                                      MoneyText(
                                        item.totalMinor,
                                        size: MoneySize.sm,
                                      ),
                                  ],
                                ),
                                Row(
                                  children: <Widget>[
                                    Text(
                                      '${item.quantity} x ',
                                      style: const TextStyle(
                                        fontFamily: 'monospace',
                                        fontSize: 11,
                                        color: Colors.black54,
                                      ),
                                    ),
                                    if (item.priceMinor > 0)
                                      MoneyText(
                                        item.priceMinor,
                                        size: MoneySize.sm,
                                      ),
                                    if (item.note != null &&
                                        item.note!.isNotEmpty) ...<Widget>[
                                      const SizedBox(width: Gap.xs),
                                      Text(
                                        '(${item.note})',
                                        style: const TextStyle(
                                          fontFamily: 'monospace',
                                          fontSize: 10,
                                          color: Colors.black87,
                                          fontStyle: FontStyle.italic,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: Gap.xs),
                        const _DashedLine(),
                        const SizedBox(height: Gap.xs),
                      ],

                      // Summary Rows
                      for (final MapEntry<String, String> entry
                          in summaryRows.entries)
                        _metaRow(entry.key, entry.value),

                      // Total Amount (Jika Ada)
                      if (totalAmountMinor != null) ...<Widget>[
                        const SizedBox(height: Gap.xs),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: <Widget>[
                            const Text(
                              'TOTAL',
                              style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: Colors.black,
                              ),
                            ),
                            MoneyText(
                              totalAmountMinor!,
                              size: MoneySize.lg,
                            ),
                          ],
                        ),
                      ],

                      const SizedBox(height: Gap.md),
                      const _DashedLine(),
                      const SizedBox(height: Gap.xs),
                      const Text(
                        '*** DOKUMEN CETAK POS GODINOV ***',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 10,
                          color: Colors.black45,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: Gap.md),

            // Tombol Kontrol Bawah
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white70),
                      padding: const EdgeInsets.symmetric(vertical: Gap.md),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(Radii.md),
                      ),
                    ),
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Tutup'),
                  ),
                ),
                if (onPrint != null) ...<Widget>[
                  const SizedBox(width: Gap.md),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: t.brand,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: Gap.md),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(Radii.md),
                        ),
                      ),
                      icon: const Icon(Icons.print),
                      label: const Text(
                        'Cetak Struk Fisik',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      onPressed: () async {
                        await onPrint!();
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              duration: Duration(seconds: 1),
                              content: Text('Perintah cetak dikirim ke printer'),
                            ),
                          );
                        }
                      },
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _metaRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(
            label,
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 11,
              color: Colors.black87,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Colors.black,
            ),
          ),
        ],
      ),
    );
  }
}

class _DashedLine extends StatelessWidget {
  const _DashedLine();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double boxWidth = constraints.constrainWidth();
        const double dashWidth = 4.0;
        const double dashHeight = 1.0;
        final int dashCount = (boxWidth / (2 * dashWidth)).floor();
        return Flex(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          direction: Axis.horizontal,
          children: List<Widget>.generate(dashCount, (_) {
            return const SizedBox(
              width: dashWidth,
              height: dashHeight,
              child: DecoratedBox(
                decoration: BoxDecoration(color: Colors.black38),
              ),
            );
          }),
        );
      },
    );
  }
}
