import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/money_text.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// Hasil formulir pembatalan.
class VoidReasonResult {
  const VoidReasonResult({required this.reasonCode, required this.reasonNotes});

  final String reasonCode;
  final String reasonNotes;
}

/// Label Bahasa Indonesia untuk kamus beku [ReasonCodes.voidReasons].
///
/// Peta terpisah dari kamusnya: kode adalah kontrak lintas platform yang tidak
/// boleh berubah, label adalah teks yang boleh diperbaiki kapan saja.
const Map<String, String> kVoidReasonLabels = <String, String>{
  'CUSTOMER_CANCEL': 'Pelanggan membatalkan',
  'WRONG_ITEM': 'Item salah',
  'WRONG_QTY': 'Jumlah salah',
  'PRICE_DISPUTE': 'Selisih harga',
  'TRAINING': 'Latihan / uji coba',
  'SYSTEM_ERROR': 'Kesalahan sistem',
  'DUPLICATE_ENTRY': 'Input ganda',
  'OTHER': 'Lainnya',
};

/// **Formulir pembatalan — dipakai KETIGA cakupan void** ([11 §M13]).
///
/// | Cakupan       | Dipicu dari                               |
/// |---------------|-------------------------------------------|
/// | `CART_LINE`   | Stepper keranjang, penurunan qty > ambang |
/// | `HELD_ORDER`  | Pembatalan pesanan tertahan               |
/// | `TRANSACTION` | Layar Void (P-10)                         |
///
/// Satu widget untuk ketiganya bukan penghematan baris, melainkan penegakan:
/// aturan `OTHER` wajib bercatatan, kewajiban otoritas, dan peringatan bahwa
/// struk akan tercetak harus berbunyi sama di mana pun pembatalan terjadi. Tiga
/// formulir terpisah akan menyimpang, dan yang menyimpang adalah yang paling
/// jarang dilihat penguji.
///
/// Mengembalikan `null` bila kasir mundur.
Future<VoidReasonResult?> showVoidReasonSheet(
  BuildContext context, {
  required String title,
  required String description,
  required int valueMinor,
  required bool requiresAuth,
  String submitLabel = 'Batalkan',
}) {
  return showModalBottomSheet<VoidReasonResult>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (BuildContext ctx) => _VoidReasonSheet(
      title: title,
      description: description,
      valueMinor: valueMinor,
      requiresAuth: requiresAuth,
      submitLabel: submitLabel,
    ),
  );
}

class _VoidReasonSheet extends StatefulWidget {
  const _VoidReasonSheet({
    required this.title,
    required this.description,
    required this.valueMinor,
    required this.requiresAuth,
    required this.submitLabel,
  });

  final String title;
  final String description;
  final int valueMinor;
  final bool requiresAuth;
  final String submitLabel;

  @override
  State<_VoidReasonSheet> createState() => _VoidReasonSheetState();
}

class _VoidReasonSheetState extends State<_VoidReasonSheet> {
  final TextEditingController _notes = TextEditingController();
  String? _reasonCode;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  /// Aturan `OTHER`: tanpa kewajiban catatan, seluruh kamus runtuh menjadi
  /// "Lainnya" dalam dua minggu — jalur yang paling sedikit gesekannya selalu
  /// menang — dan laporan kecurangan kehilangan seluruh dayanya.
  bool get _complete {
    final String? code = _reasonCode;
    if (code == null) return false;
    if (code != ReasonCodes.other) return true;
    return _notes.text.trim().length >= ReasonCodes.otherNotesMinLength;
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Padding(
      padding: EdgeInsets.only(
        left: Gap.xl,
        right: Gap.xl,
        top: Gap.xl,
        // Menyisakan ruang untuk papan ketik: form yang tertutup keyboard
        // membuat kasir menekan tombol yang tidak terlihat.
        bottom: MediaQuery.of(context).viewInsets.bottom + Gap.xl,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(widget.title, style: PosText.buttonLg),
            const SizedBox(height: Gap.sm),

            // Butir 6 — dinyatakan SEBELUM kasir menekan tombol, bukan sesudah.
            Container(
              padding: const EdgeInsets.all(Gap.md),
              decoration: BoxDecoration(
                color: t.warningSubtle,
                borderRadius: BorderRadius.circular(Radii.md),
              ),
              child: Text(
                'Struk pembatalan akan tercetak untuk audit. Simpan bersama '
                'laporan shift.'
                '${widget.requiresAuth ? ' Pembatalan ini memerlukan persetujuan supervisor.' : ''}',
                style: PosText.sm,
              ),
            ),

            const SizedBox(height: Gap.md),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                Text('Nilai yang dibatalkan', style: PosText.sm.copyWith(color: t.fgMuted)),
                MoneyText(widget.valueMinor, size: MoneySize.lg),
              ],
            ),

            const SizedBox(height: Gap.sm),
            Text(widget.description, style: PosText.sm.copyWith(color: t.fgMuted)),

            const SizedBox(height: Gap.lg),
            Text('Alasan pembatalan (wajib)', style: PosText.sm.copyWith(color: t.fgMuted)),
            const SizedBox(height: Gap.xs),
            DropdownButtonFormField<String>(
              initialValue: _reasonCode,
              isExpanded: true,
              hint: const Text('— Pilih alasan —'),
              items: <DropdownMenuItem<String>>[
                for (final String code in ReasonCodes.voidReasons)
                  DropdownMenuItem<String>(
                    value: code,
                    child: Text(kVoidReasonLabels[code] ?? code),
                  ),
              ],
              onChanged: (String? value) => setState(() => _reasonCode = value),
            ),

            const SizedBox(height: Gap.md),
            Text(
              _reasonCode == ReasonCodes.other
                  ? 'Catatan (wajib, min. ${ReasonCodes.otherNotesMinLength} karakter)'
                  : 'Catatan (opsional)',
              style: PosText.sm.copyWith(color: t.fgMuted),
            ),
            const SizedBox(height: Gap.xs),
            TextField(
              controller: _notes,
              maxLines: 3,
              onChanged: (_) => setState(() {}),
              style: PosText.base,
              decoration: const InputDecoration(
                hintText: 'Contoh: pelanggan mengurangi pesanan sebelum dibayar',
              ),
            ),

            const SizedBox(height: Gap.xl),
            TouchButton(
              label: widget.submitLabel,
              icon: Icons.block,
              variant: TouchVariant.danger,
              onPressed: _complete
                  ? () => Navigator.of(context).pop(
                        VoidReasonResult(
                          reasonCode: _reasonCode!,
                          reasonNotes: _notes.text.trim(),
                        ),
                      )
                  : null,
            ),
            const SizedBox(height: Gap.sm),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Tidak jadi'),
            ),
          ],
        ),
      ),
    );
  }
}
