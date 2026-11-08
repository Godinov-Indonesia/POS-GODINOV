import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Kredensial penandatanganan dibaca dari `android/key.properties` yang
// **tidak pernah di-commit** (lihat .gitignore). Bila berkasnya tidak ada,
// build release tetap berjalan memakai kunci debug — berguna untuk
// `flutter run --release` saat pengembangan, tetapi APK-nya TIDAK layak edar.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "id.godinov.pos.posgodinov_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Dipakai perintah provisioning Device Owner:
        //   adb shell dpm set-device-owner id.godinov.pos/...GodinovDeviceAdminReceiver
        // Mengubahnya berarti mengubah prosedur teknisi ([09 §4.4]).
        applicationId = "id.godinov.pos"

        // minSdk 24 ditentukan `flutter_secure_storage` (EncryptedSharedPreferences)
        // dan oleh mayoritas handheld POS yang beredar ([09 §0.2]).
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }

            // Perangkat kasir kelas bawah punya penyimpanan terbatas; pengecilan
            // kode dan penyusutan resource memangkas APK secara berarti.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCK-01 — melepas plugin printer dari registrasi otomatis
// ══════════════════════════════════════════════════════════════════════════════
//
// `flutter_pos_printer_platform_image_3` meledak saat engine TANPA Activity
// dibongkar (`lateinit property bluetoothService has not been initialized`).
// Duduk perkaranya, dan mengapa pendaftaran manual di MainActivity aman untuk
// pencetakan foreground, ditulis lengkap di MainActivity.kt — di sini hanya
// mekanismenya.
//
// GeneratedPluginRegistrant.java DIBANGKITKAN Flutter tool dan ter-gitignore,
// jadi menyuntingnya langsung tidak bertahan semenit pun. Ia ditulis ulang
// SEBELUM Gradle jalan (Flutter Gradle Plugin sendiri tidak pernah
// menyentuhnya — sudah diperiksa pada Flutter 3.47.1), sehingga menyunting
// berkasnya pada `preBuild` selalu mengenai berkas yang baru dibangkitkan.
//
// Konsekuensi bila plugin ini nanti diperbaiki upstream: hapus tugas ini
// BESERTA `flutterEngine.plugins.add(...)` di MainActivity — meninggalkan salah
// satunya saja membuat printer hilang dari aplikasi utama.
val printerPluginClass =
    "com.sersoluciones.flutter_pos_printer_platform.FlutterPosPrinterPlatformPlugin"

val stripPrinterPluginAutoRegistration by tasks.registering {
    group = "posgodinov"
    description =
        "BLOCK-01: melepas $printerPluginClass dari GeneratedPluginRegistrant " +
            "agar engine headless workmanager tidak memuatnya."

    val registrant =
        file("src/main/java/io/flutter/plugins/GeneratedPluginRegistrant.java")

    // Berkasnya ditulis ulang oleh Flutter tool di luar sepengetahuan Gradle,
    // jadi cap UP-TO-DATE apa pun akan berbohong.
    outputs.upToDateWhen { false }

    doLast {
        if (!registrant.exists()) return@doLast

        val lines = registrant.readLines()
        val addIndex = lines.indexOfFirst { it.contains(".add(new $printerPluginClass(") }

        // Tidak ada = sudah dilepas pada build ini, atau dependensinya memang
        // sudah tidak dipakai. Keduanya bukan kesalahan.
        if (addIndex < 0) return@doLast

        // Bentuk yang dibangkitkan Flutter selalu blok lima baris:
        //     try {
        //       flutterEngine.getPlugins().add(new <FQN>());
        //     } catch (Exception e) {
        //       Log.e(TAG, "Error registering plugin ...", e);
        //     }
        var start = addIndex
        while (start > 0 && lines[start].trim() != "try {") start--
        var end = addIndex
        while (end < lines.size && lines[end].trim() != "}") end++

        // Gagal NYARING, bukan diam. Bila templat Flutter berubah bentuk dan
        // tugas ini melewatkannya tanpa suara, plugin kembali terdaftar otomatis
        // dan BLOCK-01 hidup lagi — kali ini tanpa satu baris pun yang terlihat
        // salah di repositori.
        if (lines[start].trim() != "try {" || end >= lines.size) {
            throw GradleException(
                "BLOCK-01: bentuk GeneratedPluginRegistrant.java tidak dikenali " +
                    "di sekitar baris ${addIndex + 1}. Templat Flutter kemungkinan " +
                    "berubah — sesuaikan tugas stripPrinterPluginAutoRegistration " +
                    "di android/app/build.gradle.kts.",
            )
        }

        val patched =
            lines.subList(0, start) +
                listOf(
                    "    // [POSGODINOV/BLOCK-01] Registrasi otomatis " +
                        "flutter_pos_printer_platform_image_3 dilepas oleh",
                    "    // stripPrinterPluginAutoRegistration " +
                        "(android/app/build.gradle.kts).",
                    "    // Plugin didaftarkan manual di " +
                        "MainActivity.configureFlutterEngine(), sehingga hanya",
                    "    // engine yang punya Activity yang memuatnya.",
                ) +
                lines.subList(end + 1, lines.size)

        registrant.writeText(patched.joinToString("\n") + "\n")
        logger.lifecycle(
            "[BLOCK-01] flutter_pos_printer_platform_image_3 dilepas dari " +
                "registrasi otomatis (baris ${start + 1}–${end + 1}).",
        )
    }
}

tasks.named("preBuild") {
    dependsOn(stripPrinterPluginAutoRegistration)
}
