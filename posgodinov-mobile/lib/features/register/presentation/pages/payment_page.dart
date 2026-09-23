/// ═══════════════════════════════════════════════════════════════════════════
/// `PaymentDialog` DIHAPUS PADA M17.2 — JANGAN DIKEMBALIKAN
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Pembayaran **wajib berupa layar penuh**, bukan modal overlay (butir 11,
/// [11 §M17.2]). Penggantinya ada di:
///
///   `pages/payment/payment_flow.dart`        — perakit rute
///   `pages/payment/payment_method_page.dart` — P-06  pemilih metode
///   `pages/payment/payment_cash_page.dart`   — P-06a tunai
///   `pages/payment/payment_card_page.dart`   — P-06b kartu (butir 8)
///   `pages/payment/payment_split_page.dart`  — P-06c multi-tender
///
/// Tiga alasan yang membuat bentuk dialog tidak dapat dipertahankan:
///
///   1. **Tombol back menutup SELURUH pembayaran.** Kasir yang salah pilih
///      metode kehilangan langkahnya dan mengulang dari keranjang. Rute
///      terpisah membuat back mundur satu langkah.
///   2. **Dialog memaksa lebar terbatas**, sehingga keypad tidak pernah
///      mencapai 56 dp yang dituntut kelas "Kritis" ([06 §2.1]).
///   3. **Tidak ada tempat untuk daftar tender** pada pembayaran split.
///
/// Berkas ini sengaja dipertahankan sebagai penanda, bukan dihapus: berkas yang
/// lenyap tanpa jejak akan dibuat ulang oleh orang berikutnya yang mencari
/// "layar pembayaran" dan tidak menemukannya.
library;
