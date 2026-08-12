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
