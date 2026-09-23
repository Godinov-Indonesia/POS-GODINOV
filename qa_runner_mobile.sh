#!/usr/bin/env bash
#
# qa_runner_mobile.sh — Runner UAT Mobile (Maestro)
#
# Membangun APK debug POSGODINOV, memasangnya ke emulator/perangkat yang SEDANG
# MENYALA, lalu menjalankan alur Maestro.
#
# Dijalankan dari root workspace. Berhenti di ledakan pertama (set -e).
#
#   ./qa_runner_mobile.sh                              # seluruh alur .maestro/
#   ./qa_runner_mobile.sh .maestro/M13-void-threshold.yaml
#   SKIP_BUILD=1 ./qa_runner_mobile.sh                 # pakai APK yang sudah ada
#   DEVICE=emulator-5554 ./qa_runner_mobile.sh         # pilih perangkat eksplisit
#   MAESTRO_ARGS="--format junit" ./qa_runner_mobile.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE="$ROOT/posgodinov-mobile"

# --- PATH TOOLCHAIN (mesin ini: Windows + Git Bash) ---
# Sama seperti test_run_v2.sh: toolchain terpasang di luar PATH default Git Bash.
export PATH="/c/Users/firman/dev/flutter/bin:$PATH"                       # flutter, dart
export PATH="/c/Users/firman/AppData/Local/Android/Sdk/platform-tools:$PATH"  # adb
export PATH="$HOME/.maestro/bin:$PATH"                                    # maestro

# Maestro berjalan di atas JVM dan menolak start tanpa JAVA_HOME. Mesin ini
# tidak punya JDK mandiri — yang ada adalah JBR bawaan Android Studio, JDK yang
# sama yang dipakai Gradle (`flutter doctor -v`). Memakai JDK yang berbeda
# antara build dan pengujian hanya menambah satu variabel yang tidak perlu.
if [ -z "${JAVA_HOME:-}" ]; then
  for candidate in \
    "/c/Program Files/Android/Android Studio/jbr" \
    "/c/Program Files/Android/Android Studio Preview/jbr"; do
    if [ -x "$candidate/bin/java" ]; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi
[ -n "${JAVA_HOME:-}" ] && export PATH="$JAVA_HOME/bin:$PATH"

APP_ID="id.godinov.pos"
APK="$MOBILE/build/app/outputs/flutter-apk/app-debug.apk"
FLOW="${1:-.maestro/M13-void-threshold.yaml}"

# ══════════════════════════════════════════════════════════════════════════════
# 0. Pemeriksaan awal
# ══════════════════════════════════════════════════════════════════════════════
#
# Diperiksa SEBELUM build. Build APK debug memakan menit; gagal karena `maestro`
# tidak terpasang setelah menunggu build selesai adalah menit yang terbuang
# tanpa satu pun informasi baru.
echo "=> Memeriksa toolchain..."
for bin in flutter adb maestro; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "   [GAGAL] '$bin' tidak ada di PATH."
    case "$bin" in
      maestro)
        echo "           Pasang: curl -Ls https://get.maestro.mobile.dev | bash"
        echo "           lalu buka ulang terminal (maestro masuk ke ~/.maestro/bin)."
        ;;
      adb)
        echo "           Sesuaikan ANDROID_HOME / platform-tools di bagian PATH skrip ini."
        ;;
      flutter)
        echo "           Sesuaikan lokasi Flutter SDK di bagian PATH skrip ini."
        ;;
    esac
    exit 1
  fi
done
echo "   flutter : $(command -v flutter)"
echo "   adb     : $(command -v adb)"
echo "   maestro : $(command -v maestro)"

if [ ! -f "$MOBILE/$FLOW" ]; then
  echo "   [GAGAL] Alur tidak ditemukan: $MOBILE/$FLOW"
  exit 1
fi

# ══════════════════════════════════════════════════════════════════════════════
# 1. Emulator harus sudah menyala
# ══════════════════════════════════════════════════════════════════════════════
#
# Skrip ini TIDAK menyalakan emulator sendiri. Memilih AVD mana yang dipakai
# adalah keputusan penguji — alur M13 menuntut tata letak TABLET (panel
# keranjang di kanan), dan menyalakan AVD ponsel secara otomatis akan membuat
# alurnya gagal dengan alasan yang menyesatkan.
echo "=> Mencari perangkat..."
adb start-server >/dev/null 2>&1 || true

if [ -n "${DEVICE:-}" ]; then
  SERIAL="$DEVICE"
else
  # Kolom pertama dari baris yang berstatus tepat "device" (bukan "offline"
  # maupun "unauthorized").
  READY="$(adb devices | awk '$2 == "device" { print $1 }')"
  COUNT="$(printf '%s\n' "$READY" | grep -c . || true)"

  if [ "$COUNT" -gt 1 ]; then
    # Menebak DIAM-DIAM adalah jebakan yang sesungguhnya. Alur M13 menuntut
    # tata letak TABLET; memilih ponsel yang kebetulan terdaftar lebih dulu
    # akan gagal saat mencari "KERANJANG" — pesan yang menunjuk ke Maestro,
    # padahal salahnya ada pada pemilihan perangkat.
    echo "   [GAGAL] Ada $COUNT perangkat siap. Tentukan salah satu:"
    for s in $READY; do
      printf '           DEVICE=%-16s %s  (%s)\n' \
        "$s" \
        "$(adb -s "$s" shell getprop ro.product.model 2>/dev/null | tr -d '\r')" \
        "$(adb -s "$s" shell wm size 2>/dev/null | tr -d '\r' | sed 's/Physical size: //')"
    done
    echo "           Contoh: DEVICE=<serial> ./qa_runner_mobile.sh"
    exit 1
  fi

  SERIAL="$READY"
fi

if [ -z "$SERIAL" ]; then
  echo "   [GAGAL] Tidak ada perangkat/emulator yang siap."
  echo "           Nyalakan emulator tablet lebih dulu, lalu ulangi."
  echo "           Daftar AVD: emulator -list-avds"
  adb devices
  exit 1
fi
echo "   Perangkat: $SERIAL  ($(adb -s "$SERIAL" shell getprop ro.product.model 2>/dev/null | tr -d '\r'))"

# ══════════════════════════════════════════════════════════════════════════════
# 2. Build APK debug
# ══════════════════════════════════════════════════════════════════════════════
cd "$MOBILE"

if [ "${SKIP_BUILD:-0}" = "1" ]; then
  echo "=> [SKIP] Build APK (SKIP_BUILD=1)."
  [ -f "$APK" ] || { echo "   [GAGAL] APK belum ada: $APK"; exit 1; }
else
  echo "=> Membangun APK debug..."
  flutter pub get
  flutter build apk --debug
fi
[ -f "$APK" ] || { echo "   [GAGAL] APK tidak terbentuk: $APK"; exit 1; }

# ══════════════════════════════════════════════════════════════════════════════
# 3. Pasang ke perangkat
# ══════════════════════════════════════════════════════════════════════════════
#
# `adb install -r`, bukan `flutter install`: `flutter install` dapat memicu build
# ulang dan tidak menerima serial perangkat semudah ini. `-r` mempertahankan
# data aplikasi — token binding perangkat dan sesi kasir tetap hidup, dan alur
# M13 justru mengandalkan itu (lihat catatan `clearState` di file YAML-nya).
echo "=> Memasang APK ke $SERIAL..."
adb -s "$SERIAL" install -r "$APK"

# ══════════════════════════════════════════════════════════════════════════════
# 3b. Menyalakan pohon semantik Flutter
# ══════════════════════════════════════════════════════════════════════════════
#
# Maestro membaca pohon AKSESIBILITAS Android. Flutter menggambar seluruh
# layarnya ke satu Surface dan baru membangun pohon semantik ketika
# `AccessibilityManager.isEnabled()` bernilai true — yaitu ketika ADA layanan
# aksesibilitas yang terikat.
#
# Pada emulator polos tidak ada satu pun, dan akibatnya bukan kegagalan yang
# jujur: Maestro tetap menerima hierarki berisi 4 node milik status bar, lalu
# melaporkan "Element not found" untuk teks yang JELAS terlihat di tangkapan
# layar. Setiap menit yang dihabiskan menuduh selector salah adalah menit yang
# terbuang.
#
# Dipilih **Accessibility Menu**, bukan TalkBack: TalkBack menyalakan
# explore-by-touch, yang mengubah arti setiap ketukan dan justru merusak
# Maestro. Accessibility Menu cukup untuk membuat `isEnabled()` true tanpa
# menyentuh penanganan sentuhan.
#
# Setelan ini SENGAJA dibiarkan menyala setelah tes selesai: emulator ini
# perangkat QA, dan mematikannya berarti eksekusi berikutnya gagal lagi dengan
# gejala yang sama membingungkannya.
A11Y_SERVICE="com.android.systemui.accessibility.accessibilitymenu/.AccessibilityMenuService"

echo "=> Memastikan pohon semantik Flutter terbaca Maestro..."
if [ "$(adb -s "$SERIAL" shell settings get secure accessibility_enabled | tr -d '\r')" = "1" ] &&
   [ -n "$(adb -s "$SERIAL" shell settings get secure enabled_accessibility_services | tr -d '\r' | grep -v '^null$')" ]; then
  echo "   Sudah aktif."
elif adb -s "$SERIAL" shell pm list packages 2>/dev/null | grep -q "accessibilitymenu"; then
  adb -s "$SERIAL" shell settings put secure enabled_accessibility_services "$A11Y_SERVICE"
  adb -s "$SERIAL" shell settings put secure accessibility_enabled 1
  echo "   Diaktifkan: $A11Y_SERVICE"
else
  echo "   [PERINGATAN] Tidak ada layanan aksesibilitas yang dapat diaktifkan."
  echo "                Maestro kemungkinan besar tidak akan melihat widget Flutter"
  echo "                mana pun, dan kegagalannya akan tampak seperti selector salah."
fi

# ══════════════════════════════════════════════════════════════════════════════
# 4. Jalankan Maestro
# ══════════════════════════════════════════════════════════════════════════════
#
echo "=> Menjalankan Maestro: $FLOW"
echo "   appId: $APP_ID"
maestro --device "$SERIAL" test ${MAESTRO_ARGS:-} "$FLOW"

# Maestro menulis SELURUH artefaknya — tangkapan layar `takeScreenshot`, log,
# logcat perangkat, dan dump hierarki aksesibilitas — ke direktori runnya
# sendiri, BUKAN relatif terhadap direktori kerja. Path di dalam berkas alur
# hanya menjadi sub-folder di dalamnya.
#
# Dump hierarki itu artefak yang paling berharga saat sebuah selector gagal:
# ia memperlihatkan persis teks yang dilihat Maestro, termasuk penggabungan
# semantik Flutter yang membuat "Espresso" menjadi "E\nEspresso\nRp 18.000".
LATEST_RUN="$(ls -dt "$HOME/.maestro/tests/"*/ 2>/dev/null | head -1)"
echo "=> UAT MOBILE SELESAI."
echo "   Artefak (tangkapan layar, logcat, hierarki): ${LATEST_RUN:-$HOME/.maestro/tests/}"
