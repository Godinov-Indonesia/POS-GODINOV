import java.io.StringReader
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProps = Properties()
val keystoreContent =
    providers
        .fileContents(rootProject.layout.projectDirectory.file("key.properties"))
        .asText
        .orNull
if (keystoreContent != null) {
    keystoreProps.load(StringReader(keystoreContent))
}

val storeFilePath =
    providers.environmentVariable("ANDROID_KEYSTORE_PATH").orNull?.takeIf { it.isNotBlank() }
        ?: keystoreProps.getProperty("storeFile")?.takeIf { it.isNotBlank() }
val storePasswordVal =
    providers.environmentVariable("ANDROID_STORE_PASSWORD").orNull?.takeIf { it.isNotBlank() }
        ?: keystoreProps.getProperty("storePassword")?.takeIf { it.isNotBlank() }
val keyAliasVal =
    providers.environmentVariable("ANDROID_KEY_ALIAS").orNull?.takeIf { it.isNotBlank() }
        ?: keystoreProps.getProperty("keyAlias")?.takeIf { it.isNotBlank() }
val keyPasswordVal =
    providers.environmentVariable("ANDROID_KEY_PASSWORD").orNull?.takeIf { it.isNotBlank() }
        ?: keystoreProps.getProperty("keyPassword")?.takeIf { it.isNotBlank() }

val releaseKeystoreFile = storeFilePath?.let { rootProject.file(it) }
val hasReleaseKeystore =
    releaseKeystoreFile != null &&
        releaseKeystoreFile.exists() &&
        storePasswordVal != null &&
        keyAliasVal != null &&
        keyPasswordVal != null

android {
    namespace = "id.godinov.posgodinov_so"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "id.godinov.so"
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = releaseKeystoreFile
                storePassword = storePasswordVal
                keyAlias = keyAliasVal
                keyPassword = keyPasswordVal
            }
        }
    }

    buildTypes {
        release {
            signingConfig =
                if (hasReleaseKeystore) {
                    signingConfigs.getByName("release")
                } else {
                    signingConfigs.getByName("debug")
                }
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
