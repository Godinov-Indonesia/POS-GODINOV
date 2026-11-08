import java.io.StringReader
import java.util.Properties
import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.TaskAction
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

@CacheableTask
abstract class GenerateBuildConfigTask : DefaultTask() {
    @get:Input abstract val namespace: Property<String>
    @get:Input abstract val apiBaseUrl: Property<String>
    @get:Input abstract val debug: Property<Boolean>
    @get:Input abstract val buildType: Property<String>
    @get:Input abstract val versionCode: Property<Int>
    @get:Input abstract val versionName: Property<String>
    @get:OutputDirectory abstract val outputDir: DirectoryProperty

    @TaskAction
    fun generate() {
        val pkg = namespace.get()
        val dir = outputDir.get().asFile.resolve(pkg.replace('.', '/'))
        dir.mkdirs()
        dir.resolve("BuildConfig.kt").writeText(
            """
            package $pkg

            object BuildConfig {
                const val DEBUG: Boolean = ${debug.get()}
                const val BUILD_TYPE: String = "${buildType.get()}"
                const val VERSION_CODE: Int = ${versionCode.get()}
                const val VERSION_NAME: String = "${versionName.get()}"
                const val API_BASE_URL: String = "${apiBaseUrl.get()}"
            }
            """.trimIndent() + "\n",
        )
    }
}

fun loadProperties(fileName: String): Properties {
    val props = Properties()
    val content =
        providers
            .fileContents(rootProject.layout.projectDirectory.file(fileName))
            .asText
            .orNull
    if (content != null) {
        props.load(StringReader(content))
    }
    return props
}

val localProps = loadProperties("local.properties")
val keystoreProps = loadProperties("key.properties")

val resolvedApiBaseUrl: String =
    (
        providers
            .gradleProperty("API_BASE_URL")
            .orElse(providers.environmentVariable("API_BASE_URL"))
            .orNull
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: localProps.getProperty("api.base.url")?.trim()?.takeIf { it.isNotEmpty() }
            ?: "https://api-pos.godinov.web.id"
    ).trimEnd('/')

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

val appVersionCode = 1
val appVersionName = "1.0.0"

android {
    namespace = "id.godinov.pos"
    compileSdk = 36
    ndkVersion = "28.2.13676358"

    buildFeatures {
        compose = true
    }

    defaultConfig {
        applicationId = "id.godinov.pos"
        minSdk = 24
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersionName
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

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

androidComponents {
    onVariants { variant ->
        val capitalizedName = variant.name.replaceFirstChar { it.uppercase() }
        val genTask =
            tasks.register<GenerateBuildConfigTask>("generate${capitalizedName}BuildConfigKt") {
                namespace.set(variant.namespace)
                apiBaseUrl.set(resolvedApiBaseUrl)
                debug.set(variant.buildType == "debug")
                buildType.set(variant.buildType ?: "")
                versionCode.set(appVersionCode)
                versionName.set(appVersionName)
            }
        variant.sources.kotlin?.addGeneratedSourceDirectory(
            genTask,
            GenerateBuildConfigTask::outputDir,
        )
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

ksp {
    arg("room.generateKotlin", "true")
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.androidx.sqlite.ktx)
    implementation(libs.sqlcipher.android)
    implementation(libs.androidx.work.runtime.ktx)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
