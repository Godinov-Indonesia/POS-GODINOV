#!/usr/bin/env bash
# Audit aturan pengikat lintas fase ([10 §0]).
#
# Menjalankan seluruh pemeriksaan yang tidak dapat ditangkap `flutter analyze`
# karena sifatnya arsitektural, bukan sintaksis.
#
# Pakai:  bash tool/audit.sh
# Keluar: 0 bila bersih, 1 bila ada pelanggaran.

set -uo pipefail
cd "$(dirname "$0")/.."

FAIL=0

check() {
  local label="$1"; shift
  local count
  count=$("$@" | wc -l | tr -d ' ')
  if [ "$count" -eq 0 ]; then
    printf '  ✅ %s\n' "$label"
  else
    printf '  ❌ %s — %s pelanggaran\n' "$label" "$count"
    "$@" | sed 's/^/       /'
    FAIL=1
  fi
}

echo "── Aturan 3: warna hanya dari Lapis 2 ──────────────────────────────────"
check "Tidak ada Color(0x…) di luar godinov_colors.dart" \
  bash -c "grep -rn 'Color(0x' lib/ | grep -v godinov_colors.dart || true"
check "features/ tidak mengimpor Lapis 1" \
  bash -c "grep -rln 'theme/godinov_colors.dart' lib/features/ 2>/dev/null || true"

echo "── Aturan 2: nominal hanya lewat MoneyText ─────────────────────────────"
check "Tidak ada literal 'Rp ' di luar money/UI yang sah" \
  bash -c "grep -rn \"'Rp \" lib/ | grep -vE 'money.dart|money_text.dart|payment_page.dart|open_shift_page.dart|close_shift_page.dart|escpos_receipt_builder.dart' || true"

echo "── Aturan 4: koleksi API hanya lewat Envelope ──────────────────────────"
check "Tidak ada 'as List' di luar Envelope & pengurai JSON" \
  bash -c "grep -rn 'as List' lib/ | grep -vE 'envelope.dart|master_data_dto.dart|held_cart_repository_impl.dart|sync_models.dart' || true"

echo "── Batas lapisan Clean Architecture ────────────────────────────────────"
check "domain/ tidak mengimpor Flutter, Drift, atau Dio" \
  bash -c "grep -rn \"^import 'package:\\(drift\\|dio\\|flutter\\)/\" lib/features/*/domain/ 2>/dev/null || true"
check "domain/ tidak mengimpor data/ maupun presentation/" \
  bash -c "grep -rn 'features/[a-z]*/\\(data\\|presentation\\)/' lib/features/*/domain/ 2>/dev/null || true"
check "presentation/ tidak memotong jalur ke data/" \
  bash -c "grep -rn 'features/[a-z]*/data/' lib/features/*/presentation/ 2>/dev/null || true"
check "core/ tidak mengimpor features/ (kecuali composition root)" \
  bash -c "grep -rn 'posgodinov_mobile/features/' lib/core/ | grep -v 'di/injection.dart' || true"
check "Tidak ada impor relatif" \
  bash -c "grep -rn \"^import '\\.\\.\\?/\" lib/ test/ || true"

echo "── Batasan produk yang wajib dipatuhi ([09 §9.5]) ──────────────────────"
check "Layar kasir & Kiosk tidak menyebut stok" \
  bash -c "grep -rniE '\\bstok\\b|\\bstock\\b|sold ?out' lib/features/register/ lib/features/kiosk/ | grep -v '//' || true"
check "Tidak ada tautan reset PIN" \
  bash -c "grep -rniE 'reset.?pin' lib/ | grep -v '//' || true"
check "Payload sync memakai kunci 'wastes', bukan 'product_wastes'" \
  bash -c "grep -rn \"'product_wastes'\" lib/ || true"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "✅ Audit bersih."
else
  echo "❌ Audit menemukan pelanggaran. Perbaiki sebelum melanjutkan."
fi
exit "$FAIL"
