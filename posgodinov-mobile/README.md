# posgodinov-mobile

Aplikasi kasir **offline-first** untuk Tablet Android 10" (*landscape*) dan Handheld POS
(Sunmi / iMin), termasuk mode Kiosk pesan mandiri.

- **Arsitektur:** [../docs/09-flutter-mobile-architecture.md](../docs/09-flutter-mobile-architecture.md)
- **Rencana kerja:** [../docs/10-flutter-implementation-plan.md](../docs/10-flutter-implementation-plan.md)
- **Kontrak backend:** [../docs/03-api-specifications.md](../docs/03-api-specifications.md)

---

## Menjalankan

Folder native Android **sudah ter-generate** dan proyeknya build normal —
`flutter create` tidak perlu dijalankan lagi. Kedua koreksi wajib pasca-scaffold
juga sudah diterapkan dan diverifikasi:

- `applicationId = "id.godinov.pos"` di `android/app/build.gradle.kts` — nilai
  ini masuk ke perintah *provisioning* Device Owner yang dipakai teknisi di
  lapangan ([09 §4.4]).
- `android:allowBackup="false"` di `AndroidManifest.xml` — basis data lokal
  memuat `pin_hash` bcrypt seluruh kasir outlet ([03 §2.2]); membiarkan Android
  Auto Backup menyalinnya ke Google Drive memindahkan permukaan serangan ke luar
  kendali outlet.

```bash
flutter pub get
flutter devices               # pastikan emulator atau tablet terbaca
flutter run -d <device-id>
```

Bawaannya menunjuk `http://10.0.2.2:8080` (alias emulator Android untuk
`localhost` mesin host). Untuk perangkat fisik, arahkan ke IP LAN:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8080
```

`API_BASE_URL` dibaca lewat `String.fromEnvironment` — **compile-time**, jadi
hot reload tidak mengubahnya.

Backend dan data seed harus sudah hidup lebih dulu; tanpa itu layar Pemasangan
Perangkat tidak bisa dilewati. Langkah lengkapnya beserta kredensial, akses
database, dan daftar bug yang diketahui ada di
[README utama](../README.md#-menjalankan-di-lokal).

### Verifikasi kualitas

```bash
flutter analyze            # harus 0 issue
dart run import_lint       # harus 0 pelanggaran
```
---

## Struktur

```text
lib/
├── core/        # config · network · database · storage · crypto · printer · kiosk · sync · error · di · utils
├── features/    # device · auth · shift · register · history · waste · sync · kiosk
│                #   tiap fitur: data/ · domain/ · presentation/
└── shared/      # theme · widgets · extensions
```

Aturan ketergantungan ditegakkan `import_lint.yaml`, bukan disepakati lisan:

```text
presentation ──────► domain ◄────── data
     │                                │
     └──────────────► core ◄──────────┘
```

`domain/` adalah **Dart murni** — tidak boleh mengimpor Flutter, Drift, maupun Dio.

## Empat aturan yang mengikat seluruh kode

1. **Uang = `int` sen.** `double` tidak pernah menyentuh uang ([09 §3.5]).
2. **Nominal hanya lewat `MoneyText`** — monospace + `tabularFigures`.
3. **`Color(0xFF…)` hanya di `shared/theme/godinov_colors.dart`.** Widget memakai
   `context.tokens.*`.
4. **Koleksi API selalu lewat `Envelope.list()`** — backend mengirim `null`, bukan `[]`
   ([03 §2.2]).
