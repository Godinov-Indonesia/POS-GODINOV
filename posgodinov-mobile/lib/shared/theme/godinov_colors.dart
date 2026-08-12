import 'dart:ui' show Color;

/// LAPIS 1 — PRIMITIF GODINOV PALETTE.
///
/// **Ini satu-satunya berkas di seluruh proyek yang boleh memuat nilai
/// heksadesimal.** Aturan mutlak [06 §1.1] / [09 §3.3]:
///
/// - Komponen **tidak pernah** merujuk kelas ini. Yang benar adalah
///   `context.tokens.accent` (Lapis 2 semantik), bukan `GodinovColors.blue600`.
/// - Aturan `no_raw_palette_outside_theme` di `import_lint.yaml` menolak setiap
///   impor berkas ini dari dalam `lib/features/**`.
///
/// Inilah yang membuat rebranding atau penyesuaian kontras menjadi perubahan
/// satu berkas, bukan perburuan literal di ratusan widget.
///
/// Pemetaan Lapis 1 → Lapis 2 ada di `godinov_tokens.dart` (dibuat pada M1).
abstract final class GodinovColors {
  // ── Primary / Brand ────────────────────────────────────────────────────────
  /// Deep Navy. Teks utama, latar StatusBar POS, sidebar Admin.
  static const Color navy950 = Color(0xFF0F172A);

  /// Permukaan gelap sekunder, hover sidebar.
  static const Color navy900 = Color(0xFF1E293B);

  /// Border pada permukaan gelap, teks sekunder di atas gelap.
  static const Color navy800 = Color(0xFF334155);

  // ── Accent / Action ────────────────────────────────────────────────────────
  /// Electric Blue. **Aksi utama** — Checkout, Submit, Primary Button.
  static const Color blue600 = Color(0xFF2563EB);

  /// Hover / active aksi utama.
  static const Color blue700 = Color(0xFF1D4ED8);

  /// Latar keadaan terpilih (tab aktif, baris terseleksi).
  static const Color blue50 = Color(0xFFEFF6FF);

  /// Aksen sekunder — info, tautan, ikon status sinkronisasi.
  static const Color cyan600 = Color(0xFF0284C7);

  // ── Success / Paid ─────────────────────────────────────────────────────────
  /// Emerald Green. Lunas, tombol BAYAR TUNAI, badge tersinkronisasi.
  static const Color emerald600 = Color(0xFF059669);

  /// Teks hijau di atas latar terang — satu-satunya varian yang lolos AA
  /// pada latar `slate50` ([06 §1.5]). Jangan memakai `emerald600` untuk teks.
  static const Color emerald700 = Color(0xFF047857);

  /// Latar badge "LUNAS".
  static const Color emerald50 = Color(0xFFECFDF5);

  // ── Warning / Alert ────────────────────────────────────────────────────────
  /// Stok minus, transaksi tertunda, jam perangkat melenceng.
  static const Color amber600 = Color(0xFFD97706);

  /// Teks amber di atas latar terang.
  static const Color amber700 = Color(0xFFB45309);

  /// Latar banner peringatan.
  static const Color amber50 = Color(0xFFFFFBEB);

  // ── Danger / Void ──────────────────────────────────────────────────────────
  /// Void, Hapus, Cancel, gagal sinkronisasi.
  static const Color red600 = Color(0xFFDC2626);

  /// Hover / teks merah di atas latar terang.
  static const Color red700 = Color(0xFFB91C1C);

  /// Latar dialog konfirmasi destruktif.
  static const Color red50 = Color(0xFFFEF2F2);

  // ── Neutral / Slate ────────────────────────────────────────────────────────
  /// Slate Background. Kanvas aplikasi (POS & Admin).
  static const Color slate50 = Color(0xFFF8FAFC);

  /// Kanvas panel sekunder, header tabel, area numpad.
  static const Color slate100 = Color(0xFFF1F5F9);

  /// **Border halus standar** seluruh permukaan.
  static const Color slate200 = Color(0xFFE2E8F0);

  /// Border input, pemisah kuat.
  static const Color slate300 = Color(0xFFCBD5E1);

  /// Teks tersier / placeholder.
  static const Color slate500 = Color(0xFF64748B);

  /// Teks sekunder (label, satuan, catatan).
  static const Color slate600 = Color(0xFF475569);

  // ── Surface ────────────────────────────────────────────────────────────────
  /// Permukaan kartu, tile produk, modal, baris keranjang.
  static const Color white = Color(0xFFFFFFFF);
}
