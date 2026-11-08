# ── Drift / SQLite ────────────────────────────────────────────────────────────
-keep class com.tekartik.** { *; }
-keep class org.sqlite.** { *; }

# ── flutter_secure_storage ────────────────────────────────────────────────────
-keep class androidx.security.crypto.** { *; }

# ── WorkManager ───────────────────────────────────────────────────────────────
# Titik masuk isolate latar dipanggil lewat refleksi; tanpa aturan ini,
# sinkronisasi latar berhenti bekerja HANYA di build release ([09 §6.4]).
-keep class dev.fluttercommunity.workmanager.** { *; }
-keep class androidx.work.** { *; }

# ── Device Admin / Kiosk ──────────────────────────────────────────────────────
# Receiver dirujuk manifest lewat nama; R8 tidak melihat pemanggilnya.
-keep class id.godinov.pos.posgodinov_mobile.kiosk.** { *; }

# ── Printer ───────────────────────────────────────────────────────────────────
-keep class com.sunmi.** { *; }
-keep class woyou.aidlservice.** { *; }

# Flutter sendiri sudah menyediakan aturannya lewat plugin Gradle.
