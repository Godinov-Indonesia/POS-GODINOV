#!/usr/bin/env bash
#
# build_manuals.sh — membangun Manual Book PDF beserta seluruh tangkapan layarnya.
#
# Urutannya mengikat: UAT dijalankan LEBIH DULU supaya tangkapan layar yang
# masuk manual adalah tangkapan layar aplikasi yang baru saja LULUS pengujian.
# Membalik urutannya berarti menerbitkan manual bergambar layar yang belum tentu
# benar — dan gambar itulah yang paling dipercaya pembaca.
#
#   ./build_manuals.sh                    # UAT + pemanen gambar + PDF
#   ./build_manuals.sh --skip-uat         # lewati UAT, tetap panen gambar
#   ./build_manuals.sh --only-pdf         # hanya bangun ulang PDF
#   ./build_manuals.sh --skip-mobile      # lewati seluruh langkah mobile
#   ./build_manuals.sh --skip-web         # lewati seluruh langkah web
#   DEVICE=emulator-5556 ./build_manuals.sh
#
# ══════════════════════════════════════════════════════════════════════════════
# DUA JENIS LANGKAH, DAN MENGAPA DIPISAH
# ══════════════════════════════════════════════════════════════════════════════
#
#   UAT      — membuktikan aturan bisnis. Gagal = rilis ditahan.
#   Pemanen  — hanya memotret layar. Gagal = manual berlubang, rilis jalan terus.
#
# Keduanya dijalankan berurutan tetapi tidak pernah dicampur dalam satu berkas
# uji: suite yang mengurus dua hal sekaligus akan dilonggarkan asersinya oleh
# orang yang sebenarnya hanya ingin memperbaiki gambar.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

ASSETS="$ROOT/docs/manuals/assets"
MAESTRO_TESTS="$HOME/.maestro/tests"

SKIP_WEB_UAT=0
SKIP_MOBILE_UAT=0
SKIP_WEB_SHOTS=0
SKIP_MOBILE_SHOTS=0
GENERATOR_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --skip-uat)    SKIP_WEB_UAT=1; SKIP_MOBILE_UAT=1 ;;
    --only-pdf)    SKIP_WEB_UAT=1; SKIP_MOBILE_UAT=1; SKIP_WEB_SHOTS=1; SKIP_MOBILE_SHOTS=1 ;;
    --skip-web)    SKIP_WEB_UAT=1; SKIP_WEB_SHOTS=1 ;;
    --skip-mobile) SKIP_MOBILE_UAT=1; SKIP_MOBILE_SHOTS=1 ;;
    --strict|--keep-html) GENERATOR_ARGS+=("$arg") ;;
    *) echo "[GAGAL] Argumen tidak dikenal: $arg"; exit 1 ;;
  esac
done

mkdir -p "$ASSETS"

banner() { printf '\n\033[1;36m=> %s\033[0m\n' "$1"; }

# ══════════════════════════════════════════════════════════════════════════════
# Pemanenan berkas Maestro
# ══════════════════════════════════════════════════════════════════════════════
#
# Maestro menulis `takeScreenshot` relatif terhadap DIREKTORI RUN-nya sendiri
# (`~/.maestro/tests/<stempel-waktu>/…`) dan MENOLAK path yang keluar dari
# folder itu — penolakannya menggagalkan seluruh alur, bukan sekadar gambarnya.
# Karena itu berkas ditulis ke sub-folder `manual/`, lalu disalin ke sini.
#
# Berkasnya dicari lewat `find` berdasarkan NAMA, bukan disusun dari potongan
# path: susunan direktori keluaran Maestro sudah pernah berubah antar versi, dan
# pencarian berdasarkan nama tetap benar ketika susunannya bergeser.
harvest() {
  local src="$1" dest="$2" run_dir="$3" found
  found="$(find "$run_dir" -name "${src}.png" -type f 2>/dev/null | head -1 || true)"
  if [ -n "$found" ]; then
    cp "$found" "$ASSETS/${dest}.png"
    printf '   ✓ %-26s <- %s\n' "${dest}.png" "${src}.png"
  else
    printf '   ⚠ %-26s TIDAK DITEMUKAN (manual memakai kotak penanda)\n' "${dest}.png"
  fi
}

latest_maestro_run() {
  ls -dt "$MAESTRO_TESTS"/*/ 2>/dev/null | head -1 || true
}

# ══════════════════════════════════════════════════════════════════════════════
# 1. UAT Web — menghasilkan assets/blind-closing-web.png
# ══════════════════════════════════════════════════════════════════════════════
#
# `--skip-backend` bukan pilihan sembarangan: port 8080 pada mesin ini dipegang
# Docker, dan bentuk polos `qa_runner_web.sh` akan mematikannya pada `cleanup()`.
# Suite M15 bermodus offline sepenuhnya, sehingga backend memang tidak dipakai.
if [ "$SKIP_WEB_UAT" = "0" ]; then
  banner "UAT Web (Playwright · M15) — tangkapan layar Tutup Shift"
  ./qa_runner_web.sh --skip-backend
else
  banner "[LEWATI] UAT Web"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 2. Pemanen gambar Web — 5 layar Pemilik
# ══════════════════════════════════════════════════════════════════════════════
#
# Playwright menulis LANGSUNG ke docs/manuals/assets/ (path diturunkan dari
# `project.testDir` di dalam spec), jadi tidak ada pemanenan di sini.
#
# Spec-nya menyalakan `next dev` sendiri bila belum ada yang menyalakannya —
# `webServer.reuseExistingServer` pada playwright.config.ts yang mengurusnya.
if [ "$SKIP_WEB_SHOTS" = "0" ]; then
  banner "Pemanen gambar Web (Playwright) — 5 layar Pemilik"
  ( cd "$ROOT/posgodinov-fe" && PW_INCLUDE_MANUAL=1 pnpm exec playwright test manual-screenshots.spec.ts --reporter=list )
else
  banner "[LEWATI] Pemanen gambar Web"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 3. UAT Mobile — menghasilkan assets/void-sheet-mobile.png
# ══════════════════════════════════════════════════════════════════════════════
if [ "$SKIP_MOBILE_UAT" = "0" ]; then
  banner "UAT Mobile (Maestro · M13) — tangkapan layar Void Sheet"
  ./qa_runner_mobile.sh

  banner "Memanen gambar M13"
  RUN_DIR="$(latest_maestro_run)"
  if [ -z "$RUN_DIR" ]; then
    echo "   [PERINGATAN] Tidak ada direktori hasil Maestro di $MAESTRO_TESTS"
  else
    harvest 'void-sheet-mobile' 'void-sheet-mobile' "$RUN_DIR"
  fi
else
  banner "[LEWATI] UAT Mobile"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 4. Pemanen gambar Mobile — 3 layar kasir
# ══════════════════════════════════════════════════════════════════════════════
#
# Dijalankan lewat `qa_runner_mobile.sh` dengan argumen alur, BUKAN dengan
# memanggil `maestro` langsung: runner itulah yang memasang JAVA_HOME, memilih
# perangkat, dan menyalakan pohon semantik Flutter. Memanggil `maestro` di sini
# berarti menyalin ketiga hal itu dan membiarkan salinannya menyimpang.
#
# `SKIP_BUILD=1` — APK-nya sudah dibangun dan dipasang pada langkah 3.
#
# ⚠️ Nama berkas Maestro SENGAJA berbeda dari nama di Markdown. Alur Maestro
#    menamainya menurut LAYAR (`open-shift-mobile`), manual menamainya menurut
#    URUTAN BAB (`mobile-01-buka-shift`). Pemetaannya dinyatakan di sini, di satu
#    tempat, supaya ketidakcocokan terlihat sebagai satu baris yang salah alih-
#    alih sebagai gambar yang diam-diam tidak pernah terbarui.
if [ "$SKIP_MOBILE_SHOTS" = "0" ]; then
  banner "Pemanen gambar Mobile (Maestro) — 3 layar kasir"
  SKIP_BUILD=1 ./qa_runner_mobile.sh .maestro/manual-screenshots.yaml

  banner "Memanen gambar manual mobile"
  RUN_DIR="$(latest_maestro_run)"
  if [ -z "$RUN_DIR" ]; then
    echo "   [PERINGATAN] Tidak ada direktori hasil Maestro di $MAESTRO_TESTS"
  else
    harvest 'open-shift-mobile'  'mobile-01-buka-shift'  "$RUN_DIR"
    harvest 'bottom-bar-mobile'  'mobile-02-bottom-bar'  "$RUN_DIR"
    harvest 'close-shift-mobile' 'mobile-04-blind-closing' "$RUN_DIR"
  fi
else
  banner "[LEWATI] Pemanen gambar Mobile"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 5. Bangun PDF
# ══════════════════════════════════════════════════════════════════════════════
banner "Membangun PDF Manual Book"
node docs/manuals/generate_pdf.js ${GENERATOR_ARGS[@]+"${GENERATOR_ARGS[@]}"}

printf '\n\033[1;32m=> MANUAL BOOK SELESAI.\033[0m\n'
printf '   docs/manuals/cashier-manual-mobile.pdf\n'
printf '   docs/manuals/owner-manual-web.pdf\n\n'
