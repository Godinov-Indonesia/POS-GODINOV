# posgodinov-mobile

Aplikasi kasir **offline-first** untuk Tablet Android 10" (*landscape*) dan Handheld POS
(Sunmi / iMin), termasuk mode Kiosk pesan mandiri.

- **Arsitektur:** [../docs/09-flutter-mobile-architecture.md](../docs/09-flutter-mobile-architecture.md)
- **Rencana kerja:** [../docs/10-flutter-implementation-plan.md](../docs/10-flutter-implementation-plan.md)
- **Kontrak backend:** [../docs/03-api-specifications.md](../docs/03-api-specifications.md)

---

## ⚠️ Status: M0 sebagian — folder native belum ada

Proyek ini **belum di-generate oleh `flutter create`**. Yang sudah ada baru sisi Dart:
`pubspec.yaml`, konfigurasi analisis, dan seluruh pohon `lib/`.

Flutter SDK tidak terpasang saat scaffold dibuat (`~/development/flutter` kosong, meski
`.zshrc` sudah mengekspor path itu). Karena itu `flutter create`, `flutter pub get`, dan
`flutter analyze` **belum pernah dijalankan** — tidak ada `android/`, `.metadata`, maupun
`pubspec.lock`.

### Melengkapi M0

```bash
# 1. Pasang Flutter SDK (sesuai PATH yang sudah ada di .zshrc)
git clone -b stable --depth 1 https://github.com/flutter/flutter.git ~/development/flutter
flutter --version          # verifikasi ≥ 3.24

# 2. Generate folder platform Android KE DALAM proyek yang sudah ada.
#    `--platforms=android` hanya MENAMBAH android/ — lib/ tidak disentuh.
cd posgodinov-mobile
flutter create --platforms=android --org id.godinov.pos --project-name posgodinov_mobile .

# 3. Kunci dependensi & verifikasi
flutter pub get
flutter analyze            # harus 0 issue
dart run import_lint       # harus 0 pelanggaran
```

> Setelah langkah 2, periksa `lib/main.dart`. Bila tertimpa template *counter app*,
> kembalikan ke placeholder — isinya hanya pemeriksa palet, aman ditulis ulang.

### Dua koreksi wajib setelah `flutter create`

1. **`applicationId`.** Perintah di atas menghasilkan `id.godinov.pos.posgodinov_mobile`,
   sedangkan [09 §4.4] mensyaratkan **`id.godinov.pos`** — nilai itu masuk ke perintah
   *provisioning* Device Owner yang dipakai teknisi di lapangan. Samakan di
   `android/app/build.gradle.kts`, path paket Kotlin, dan dokumen 09.
2. **`android:allowBackup="false"`** di `AndroidManifest.xml`. Basis data lokal memuat
   `pin_hash` bcrypt seluruh kasir outlet ([03 §2.2]); membiarkan Android Auto Backup
   menyalinnya ke Google Drive memindahkan permukaan serangan ke luar kendali outlet.

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
