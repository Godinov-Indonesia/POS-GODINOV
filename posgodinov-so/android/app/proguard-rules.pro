# ── Drift / SQLite ────────────────────────────────────────────────────────────
-keep class com.tekartik.** { *; }
-keep class org.sqlite.** { *; }

# ── flutter_secure_storage ────────────────────────────────────────────────────
-keep class androidx.security.crypto.** { *; }

# ── mobile_scanner / Google MLKit Barcode ─────────────────────────────────────
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class dev.steenbakker.mobile_scanner.** { *; }
