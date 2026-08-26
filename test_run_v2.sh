#!/usr/bin/env bash
#
# test_run_v2.sh — "The Great Build"
# Validasi kompilasi massal POSGODINOV v2 (backend Go + web PWA + mobile Flutter).
#
# Dijalankan dari root workspace. Berhenti di ledakan pertama (set -e).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# --- PATH TOOLCHAIN (mesin ini: Windows + Git Bash) ---
# Toolchain terpasang di luar PATH default Git Bash, jadi dipasang eksplisit.
export PATH="/c/Users/firman/scoop/shims:$PATH"          # go, pnpm, psql
export PATH="/c/Users/firman/dev/flutter/bin:$PATH"      # flutter, dart
export PATH="$(cygpath -u "$(go env GOPATH 2>/dev/null)" 2>/dev/null || echo /c/Users/firman/go)/bin:$PATH"  # migrate

# Kredensial DB lokal mesin ini (native PostgreSQL 18.6, bukan docker-compose).
# pg_hba = trust, tapi password tetap diisi agar cocok dengan .env.example backend.
DB_URL="postgres://posgodinov:secret@localhost:5432/posgodinov?sslmode=disable"

# --- SETUP REPO ---
echo "=> Mengamankan branch dev-v2..."
git fetch origin
git checkout dev-v2
git pull origin dev-v2

# --- BACKEND (Go) ---
echo "=> Membangun Backend..."
cd "$ROOT/posgodinov-be"
go mod tidy
go vet ./...
go test ./...
# JANGAN pakai `migrate ... up` di sini.
#
# 000025_DO_NOT_RUN_YET_drop_deprecated_columns.up.sql sengaja diberi pengaman:
# ia RAISE EXCEPTION kecuali penanda `pos_contract_v1_retired` disetel, dan ia
# menghapus kolom v1 SECARA PERMANEN (shifts.expected_balance, shifts.discrepancy,
# transactions.cancel_notes). Gerbangnya bersifat bisnis (~6 minggu pasca rilis v2),
# bukan teknis — jadi bukan wewenang skrip build untuk membukanya.
#
# Maka: migrasi ke versi aman TERTINGGI yang bukan DO_NOT_RUN_YET, dihitung
# dinamis agar tetap benar saat migrasi baru ditambahkan.
LATEST_SAFE=$(ls db/migrations/*.up.sql | grep -v "DO_NOT_RUN_YET" | tail -1 | xargs -n1 basename | cut -d_ -f1 | sed "s/^0*//")
echo "   migrate -> versi aman tertinggi: $LATEST_SAFE (000025 dilewati, by design)"
migrate -path db/migrations -database "$DB_URL" goto "$LATEST_SAFE"
cd "$ROOT"

# --- WEB PWA (Node/pnpm) ---
echo "=> Membangun Web PWA..."
cd "$ROOT/posgodinov-fe"
pnpm install
pnpm typecheck
pnpm lint
# `pnpm test` sengaja di-guard: repo ini belum punya script test maupun file test.
# Guard jujur > script no-op yang palsu-hijau.
if node -e "process.exit(require('./package.json').scripts.test?0:1)" 2>/dev/null; then
  pnpm test
else
  echo "   [SKIP] pnpm test — belum ada script \"test\" di package.json (0 file test)."
fi
cd "$ROOT"

# --- MOBILE (Flutter) ---
echo "=> Membangun Mobile..."
cd "$ROOT/posgodinov-mobile"
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter analyze
dart run import_lint
flutter test
cd "$ROOT"

echo "=> BUILD MASSAL SUKSES 100%!"
