#!/usr/bin/env bash
#
# qa_runner_web.sh — orkestrasi UAT otomatis untuk Web PWA (posgodinov-fe).
#
# Menyalakan backend Go dan Next.js dev server di latar, menunggu keduanya
# BENAR-BENAR siap, menjalankan Playwright, lalu mematikan semua yang ia
# nyalakan — termasuk ketika tesnya gagal atau ketika ditekan Ctrl-C.
#
# Dijalankan dari root workspace:
#
#   ./qa_runner_web.sh                       # stack penuh
#   ./qa_runner_web.sh --skip-backend        # hanya FE (cukup untuk suite M15)
#   ./qa_runner_web.sh --seed                # isi ulang DB tes sebelum menguji
#   ./qa_runner_web.sh -- --headed           # argumen setelah `--` diteruskan
#   ./qa_runner_web.sh -- M15-blind-closing  # ke Playwright apa adanya
#
# ═══════════════════════════════════════════════════════════════════════════
# DATABASE TES TERPISAH — TIDAK PERNAH MENYENTUH `posgodinov`
# ═══════════════════════════════════════════════════════════════════════════
#
# `DB_NAME` bawaan skrip ini adalah `posgodinov_test`, dan `--seed` memanggil
# seeder dengan `-reset` yang MENGHAPUS isi database lebih dulu. Menjalankannya
# terhadap database pengembangan berarti kehilangan data yang sedang dipakai
# orang lain — karena itu namanya dipisah di sini, bukan diserahkan pada
# ingatan siapa pun yang menjalankannya.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# ─── PATH TOOLCHAIN (mesin ini: Windows + Git Bash) ─────────────────────────
#
# Toolchain terpasang di luar PATH default Git Bash. Sama persis dengan
# `test_run_v2.sh` — bila salah satu berpindah, keduanya harus ikut berubah.
export PATH="/c/Users/firman/scoop/shims:$PATH"                                   # go, pnpm, psql
export PATH="$(cygpath -u "$(go env GOPATH 2>/dev/null)" 2>/dev/null || echo /c/Users/firman/go)/bin:$PATH"  # migrate

# ─── Konfigurasi (semuanya dapat ditimpa lewat environment) ─────────────────
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-posgodinov}"
DB_PASSWORD="${DB_PASSWORD:-secret}"
DB_NAME="${DB_NAME:-posgodinov_test}"
DB_SSLMODE="${DB_SSLMODE:-disable}"

APP_PORT="${APP_PORT:-8080}"
FE_PORT="${FE_PORT:-3000}"

BACKEND_URL="http://localhost:${APP_PORT}"
FRONTEND_URL="http://localhost:${FE_PORT}"
DB_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=${DB_SSLMODE}"

# Berapa lama menunggu tiap layanan sebelum menyerah (detik).
BACKEND_READY_TIMEOUT="${BACKEND_READY_TIMEOUT:-90}"
FRONTEND_READY_TIMEOUT="${FRONTEND_READY_TIMEOUT:-180}"

SKIP_BACKEND=0
RUN_SEEDER=0
PLAYWRIGHT_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-backend) SKIP_BACKEND=1; shift ;;
    --seed)         RUN_SEEDER=1;   shift ;;
    --)             shift; PLAYWRIGHT_ARGS=("$@"); break ;;
    -h|--help)      sed -n '2,30p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)              echo "Opsi tidak dikenal: $1 (pakai -- untuk meneruskan ke Playwright)" >&2; exit 2 ;;
  esac
done

LOG_DIR="$ROOT/.qa-logs"
BUILD_DIR="$ROOT/.qa-build"
mkdir -p "$LOG_DIR" "$BUILD_DIR"

BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

say() { printf '\n\033[1;36m=> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

# ════════════════════════════════════════════════════════════════════════════
# PEMBERSIHAN
# ════════════════════════════════════════════════════════════════════════════
#
# ⚠️ Membunuh PID bash saja TIDAK CUKUP di Windows.
#
# `pnpm dev` dan `go run` keduanya menyalakan proses ANAK (node/next, lalu
# binary hasil kompilasi). Membunuh induknya meninggalkan anaknya hidup, port
# 3000 tetap terpakai, dan proses QA berikutnya menguji server milik proses
# sebelumnya — bentuk kegagalan yang paling membingungkan karena tesnya tetap
# hijau sambil menguji build yang salah.
#
# Karena itu pembersihan dilakukan dua lapis: bunuh pohon proses lewat
# `taskkill //T`, lalu bebaskan portnya lewat PID yang benar-benar sedang
# mendengarkan. Lapis kedua yang menjadi jaring pengaman.

TRACKED_PIDS=()

track() { TRACKED_PIDS+=("$1"); }

# PID Windows yang sedang LISTENING di sebuah port.
pids_on_port() {
  netstat -ano 2>/dev/null \
    | tr -d '\r' \
    | awk -v port=":$1" '$1 ~ /^TCP$/ && $2 ~ port"$" && $4 == "LISTENING" { print $5 }' \
    | sort -u
}

kill_port() {
  local port="$1" pid
  for pid in $(pids_on_port "$port"); do
    [[ -n "$pid" && "$pid" != "0" ]] || continue
    taskkill //F //T //PID "$pid" >/dev/null 2>&1 || true
  done
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM

  say "Membersihkan proses latar..."

  local pid
  for pid in "${TRACKED_PIDS[@]}"; do
    [[ -n "${pid:-}" ]] || continue
    # `ps -W` memetakan PID bash ke WINPID; tanpanya `taskkill` tidak menemukan
    # apa pun untuk proses yang dinyalakan dari Git Bash.
    local winpid
    winpid="$(ps -W 2>/dev/null | awk -v p="$pid" '$1 == p { print $4 }' | head -1)"
    [[ -n "$winpid" ]] && taskkill //F //T //PID "$winpid" >/dev/null 2>&1 || true
    kill "$pid" >/dev/null 2>&1 || true
  done

  # Jaring pengaman: apa pun yang masih memegang port, lepaskan.
  kill_port "$FE_PORT"
  [[ "$SKIP_BACKEND" -eq 0 ]] && kill_port "$APP_PORT"

  rm -rf "$BUILD_DIR"

  if [[ $status -eq 0 ]]; then
    printf '\n\033[1;32m=> UAT WEB SELESAI — SEMUA SKENARIO LULUS.\033[0m\n'
  else
    printf '\n\033[1;31m=> UAT WEB GAGAL (exit %s). Log: %s\033[0m\n' "$status" "$LOG_DIR"
  fi
  exit $status
}
trap cleanup EXIT INT TERM

# Menunggu URL menjawab. Bukan `sleep` sembarang: `sleep 10` gagal pada mesin
# lambat dan membuang waktu pada mesin cepat, dan keduanya salah.
wait_for_http() {
  local url="$1" label="$2" timeout="$3" log="$4"
  local waited=0

  printf '   menunggu %s (%s) ' "$label" "$url"
  while [[ $waited -lt $timeout ]]; do
    if curl -fsS -o /dev/null --max-time 3 "$url" 2>/dev/null; then
      printf ' siap dalam %ss\n' "$waited"
      return 0
    fi
    printf '.'
    sleep 1
    waited=$((waited + 1))
  done

  printf '\n'
  warn "$label tidak siap setelah ${timeout}s. 30 baris terakhir $log:"
  tail -30 "$log" >&2 || true
  return 1
}

# ════════════════════════════════════════════════════════════════════════════
# 1. BACKEND (Go) — database TES
# ════════════════════════════════════════════════════════════════════════════

if [[ "$SKIP_BACKEND" -eq 0 ]]; then
  say "Menyiapkan database tes: $DB_NAME"

  export PGPASSWORD="$DB_PASSWORD"
  if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc \
        "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | grep -q 1; then
    echo "   database belum ada — membuatnya"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
      -c "CREATE DATABASE \"$DB_NAME\"" >/dev/null \
      || die "Gagal membuat database $DB_NAME. Pastikan PostgreSQL berjalan."
  else
    echo "   database sudah ada"
  fi

  say "Migrasi database tes"
  # ⚠️ JANGAN `migrate ... up`.
  #
  # `000025_DO_NOT_RUN_YET_drop_deprecated_columns.up.sql` MENGHAPUS kolom v1
  # secara permanen (`shifts.expected_balance`, `shifts.discrepancy`,
  # `transactions.cancel_notes`) dan diberi pengaman `RAISE EXCEPTION`.
  # Gerbangnya bersifat bisnis (~6 minggu pasca rilis v2), bukan teknis — bukan
  # wewenang skrip QA untuk membukanya.
  #
  # Versi aman tertinggi dihitung dinamis agar tetap benar saat migrasi baru
  # ditambahkan. Sama persis dengan `test_run_v2.sh`.
  LATEST_SAFE="$(ls posgodinov-be/db/migrations/*.up.sql \
    | grep -v 'DO_NOT_RUN_YET' | tail -1 | xargs -n1 basename | cut -d_ -f1 | sed 's/^0*//')"
  echo "   migrate -> versi aman tertinggi: $LATEST_SAFE (000025 dilewati, by design)"
  ( cd posgodinov-be && migrate -path db/migrations -database "$DB_URL" goto "$LATEST_SAFE" )

  if [[ "$RUN_SEEDER" -eq 1 ]]; then
    say "Mengisi ulang dataset seed (-reset)"
    ( cd posgodinov-be \
        && DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_USER="$DB_USER" \
           DB_PASSWORD="$DB_PASSWORD" DB_NAME="$DB_NAME" DB_SSLMODE="$DB_SSLMODE" \
           go run ./cmd/seeder -reset )
  fi

  say "Menyalakan backend Go di $BACKEND_URL"
  # Dikompilasi lebih dulu, TIDAK dijalankan lewat `go run`.
  #
  # `go run` menjalankan binary sebagai proses anak dan meneruskan sinyal
  # dengan buruk di Windows: mematikan `go run` meninggalkan server hidup dan
  # port 8080 terkunci sampai reboot. Binary yang dijalankan langsung adalah
  # proses yang PID-nya kita pegang.
  ( cd posgodinov-be && go build -o "$BUILD_DIR/posgodinov-api.exe" ./cmd/api ) \
    || die "Backend gagal dikompilasi."

  DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_USER="$DB_USER" \
  DB_PASSWORD="$DB_PASSWORD" DB_NAME="$DB_NAME" DB_SSLMODE="$DB_SSLMODE" \
  APP_ENV="${APP_ENV:-local}" APP_PORT="$APP_PORT" \
  ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-$FRONTEND_URL}" \
    "$BUILD_DIR/posgodinov-api.exe" >"$BACKEND_LOG" 2>&1 &
  track $!

  wait_for_http "$BACKEND_URL/health" "backend" "$BACKEND_READY_TIMEOUT" "$BACKEND_LOG" \
    || die "Backend tidak pernah sehat."
else
  say "Backend DILEWATI (--skip-backend)"
  # Ini bukan jalan pintas yang berbahaya untuk suite M15: `UAT-V2-01` bermodus
  # **Offline**, dan spec-nya memutus seluruh lalu lintas ke backend lewat
  # `page.route(...).abort()`. Skenario Online (mis. `UAT-V2-02`, yang membaca
  # body `POST /v1/pos/sync`) memang menuntut backend hidup.
fi

# ════════════════════════════════════════════════════════════════════════════
# 2. FRONTEND (Next.js PWA)
# ════════════════════════════════════════════════════════════════════════════

say "Menyiapkan dependensi Web PWA"
( cd posgodinov-fe && pnpm install --prefer-offline )

# Browser Playwright tinggal di luar `node_modules`, jadi `pnpm install` tidak
# menjaminnya ada. Idempoten: unduhan dilewati bila sudah terpasang.
( cd posgodinov-fe && pnpm exec playwright install chromium )

say "Menyalakan Web PWA di $FRONTEND_URL"
# `NEXT_PUBLIC_API_BASE_URL` disetel eksplisit, tidak dibiarkan jatuh ke `.env`.
#
# Ia HARUS menunjuk ke `$BACKEND_URL` yang sama dengan yang diblokir spec lewat
# `PW_API_ORIGIN`. Keduanya kebetulan sama-sama bawaan `http://localhost:8080`,
# dan justru "kebetulan" itu bahayanya: begitu seseorang menjalankan skrip ini
# dengan `APP_PORT=9090`, aplikasi tetap memanggil 8080 dari `.env` sementara
# Playwright memblokir 9090. Modus Offline diam-diam berhenti berlaku, dan
# skenario yang seharusnya membuktikan kemandirian dari backend justru mulai
# bergantung padanya — tanpa satu pun tes berubah warna.
( cd posgodinov-fe \
    && PORT="$FE_PORT" NEXT_PUBLIC_API_BASE_URL="$BACKEND_URL" \
       pnpm dev >"$FRONTEND_LOG" 2>&1 ) &
track $!

# Ditunggu pada `/pos`, BUKAN pada `/`.
#
# `next dev` mengompilasi rute saat pertama diminta. Root yang menjawab 200
# tidak berarti `/pos` — yang jauh lebih berat — sudah dapat dilayani, dan tes
# pertama akan menanggung seluruh kompilasi itu di dalam timeout-nya sendiri.
wait_for_http "$FRONTEND_URL/pos" "web pwa" "$FRONTEND_READY_TIMEOUT" "$FRONTEND_LOG" \
  || die "Web PWA tidak pernah siap."

# ════════════════════════════════════════════════════════════════════════════
# 3. PLAYWRIGHT
# ════════════════════════════════════════════════════════════════════════════

say "Menjalankan skenario UAT (Playwright · chromium)"

# `PW_BASE_URL` menyelaraskan Playwright dengan port yang benar-benar dipakai,
# dan `reuseExistingServer` pada `playwright.config.ts` membuatnya memakai
# server yang BARU SAJA dinyalakan skrip ini alih-alih menyalakan yang kedua.
(
  cd posgodinov-fe \
    && PW_BASE_URL="$FRONTEND_URL" \
       PW_PORT="$FE_PORT" \
       PW_API_ORIGIN="$BACKEND_URL" \
       pnpm exec playwright test "${PLAYWRIGHT_ARGS[@]}"
)

# Laporan HTML selalu ditulis; disebutkan di sini supaya penguji tidak perlu
# mencarinya setelah suite merah.
echo
echo "   Laporan HTML : posgodinov-fe/playwright-report/index.html"
echo "   Log layanan  : $LOG_DIR"
