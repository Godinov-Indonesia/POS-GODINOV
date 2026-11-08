package id.godinov.pos.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// Material 3 Tonal Palette for Godinov POS
// Light surface (#F7F9FB / #FFFFFF) is default for bright retail counters with overhead lighting.
val PrimaryLight = Color(0xFF004AC6)
val OnPrimaryLight = Color(0xFFFFFFFF)
val PrimaryContainerLight = Color(0xFF2563EB)
val OnPrimaryContainerLight = Color(0xFFEEEFFF)
val PrimaryFixed = Color(0xFFDBE1FF)
val OnPrimaryFixed = Color(0xFF00174B)

val SecondaryLight = Color(0xFF545F73)
val OnSecondaryLight = Color(0xFFFFFFFF)
val SecondaryContainerLight = Color(0xFFD5E0F8)
val OnSecondaryContainerLight = Color(0xFF111C2D)

val TertiaryLight = Color(0xFF006058)
val OnTertiaryLight = Color(0xFFFFFFFF)
val TertiaryContainerLight = Color(0xFF007B71)
val OnTertiaryContainerLight = Color(0xFFB3FFF3)
val TertiaryFixed = Color(0xFF89F5E7)

val ErrorLight = Color(0xFFBA1A1A)
val OnErrorLight = Color(0xFFFFFFFF)
val ErrorContainerLight = Color(0xFFFFDAD6)
val OnErrorContainerLight = Color(0xFF93000A)

val BackgroundLight = Color(0xFFF7F9FB)
val OnBackgroundLight = Color(0xFF191C1E)
val SurfaceLight = Color(0xFFF7F9FB)
val OnSurfaceLight = Color(0xFF191C1E)
val SurfaceVariantLight = Color(0xFFE0E3E5)
val OnSurfaceVariantLight = Color(0xFF434655)

val SurfaceContainerLowestLight = Color(0xFFFFFFFF)
val SurfaceContainerLowLight = Color(0xFFF2F4F6)
val SurfaceContainerLight = Color(0xFFECEEF0)
val SurfaceContainerHighLight = Color(0xFFE6E8EA)
val SurfaceContainerHighestLight = Color(0xFFE0E3E5)

val OutlineLight = Color(0xFF737686)
val OutlineVariantLight = Color(0xFFC3C6D7)
val PlaceholderLight = Color(0xFF686C7C) // 5.22:1 contrast on #FFFFFF (WCAG AA)

val InverseSurfaceLight = Color(0xFF2D3133)
val InverseOnSurfaceLight = Color(0xFFEFF1F3)
val InversePrimaryLight = Color(0xFFB4C5FF)

// Dark Color Scheme for low-light environments
val PrimaryDark = Color(0xFFB4C5FF)
val OnPrimaryDark = Color(0xFF002A78)
val PrimaryContainerDark = Color(0xFF003EA8)
val OnPrimaryContainerDark = Color(0xFFDBE1FF)

val SecondaryDark = Color(0xFFBCC7DE)
val OnSecondaryDark = Color(0xFF263143)
val SecondaryContainerDark = Color(0xFF3C475A)
val OnSecondaryContainerDark = Color(0xFFD8E3FB)

val TertiaryDark = Color(0xFF6BD8CB)
val OnTertiaryDark = Color(0xFF003732)
val TertiaryContainerDark = Color(0xFF005049)
val OnTertiaryContainerDark = Color(0xFF89F5E7)

val ErrorDark = Color(0xFFFFB4AB)
val OnErrorDark = Color(0xFF690005)
val ErrorContainerDark = Color(0xFF93000A)
val OnErrorContainerDark = Color(0xFFFFDAD6)

val BackgroundDark = Color(0xFF111315)
val OnBackgroundDark = Color(0xFFE2E2E5)
val SurfaceDark = Color(0xFF111315)
val OnSurfaceDark = Color(0xFFE2E2E5)
val SurfaceVariantDark = Color(0xFF434655)
val OnSurfaceVariantDark = Color(0xFFC3C6D7)

val SurfaceContainerLowestDark = Color(0xFF0C0E10)
val SurfaceContainerLowDark = Color(0xFF191C1E)
val SurfaceContainerDark = Color(0xFF1D2022)
val SurfaceContainerHighDark = Color(0xFF282A2D)
val SurfaceContainerHighestDark = Color(0xFF323538)

val OutlineDark = Color(0xFF8D90A0)
val OutlineVariantDark = Color(0xFF434655)
val PlaceholderDark = Color(0xFF9AA0B0)

val GodinovLightColorScheme =
    lightColorScheme(
        primary = PrimaryLight,
        onPrimary = OnPrimaryLight,
        primaryContainer = PrimaryContainerLight,
        onPrimaryContainer = OnPrimaryContainerLight,
        inversePrimary = InversePrimaryLight,
        secondary = SecondaryLight,
        onSecondary = OnSecondaryLight,
        secondaryContainer = SecondaryContainerLight,
        onSecondaryContainer = OnSecondaryContainerLight,
        tertiary = TertiaryLight,
        onTertiary = OnTertiaryLight,
        tertiaryContainer = TertiaryContainerLight,
        onTertiaryContainer = OnTertiaryContainerLight,
        background = BackgroundLight,
        onBackground = OnBackgroundLight,
        surface = SurfaceLight,
        onSurface = OnSurfaceLight,
        surfaceVariant = SurfaceVariantLight,
        onSurfaceVariant = OnSurfaceVariantLight,
        surfaceTint = PrimaryLight,
        inverseSurface = InverseSurfaceLight,
        inverseOnSurface = InverseOnSurfaceLight,
        error = ErrorLight,
        onError = OnErrorLight,
        errorContainer = ErrorContainerLight,
        onErrorContainer = OnErrorContainerLight,
        outline = OutlineLight,
        outlineVariant = OutlineVariantLight,
        surfaceContainerLowest = SurfaceContainerLowestLight,
        surfaceContainerLow = SurfaceContainerLowLight,
        surfaceContainer = SurfaceContainerLight,
        surfaceContainerHigh = SurfaceContainerHighLight,
        surfaceContainerHighest = SurfaceContainerHighestLight,
    )

val GodinovDarkColorScheme =
    darkColorScheme(
        primary = PrimaryDark,
        onPrimary = OnPrimaryDark,
        primaryContainer = PrimaryContainerDark,
        onPrimaryContainer = OnPrimaryContainerDark,
        inversePrimary = PrimaryLight,
        secondary = SecondaryDark,
        onSecondary = OnSecondaryDark,
        secondaryContainer = SecondaryContainerDark,
        onSecondaryContainer = OnSecondaryContainerDark,
        tertiary = TertiaryDark,
        onTertiary = OnTertiaryDark,
        tertiaryContainer = TertiaryContainerDark,
        onTertiaryContainer = OnTertiaryContainerDark,
        background = BackgroundDark,
        onBackground = OnBackgroundDark,
        surface = SurfaceDark,
        onSurface = OnSurfaceDark,
        surfaceVariant = SurfaceVariantDark,
        onSurfaceVariant = OnSurfaceVariantDark,
        surfaceTint = PrimaryDark,
        inverseSurface = InverseOnSurfaceLight,
        inverseOnSurface = InverseSurfaceLight,
        error = ErrorDark,
        onError = OnErrorDark,
        errorContainer = ErrorContainerDark,
        onErrorContainer = OnErrorContainerDark,
        outline = OutlineDark,
        outlineVariant = OutlineVariantDark,
        surfaceContainerLowest = SurfaceContainerLowestDark,
        surfaceContainerLow = SurfaceContainerLowDark,
        surfaceContainer = SurfaceContainerDark,
        surfaceContainerHigh = SurfaceContainerHighDark,
        surfaceContainerHighest = SurfaceContainerHighestDark,
    )

@Immutable
data class GodinovExtendedColors(
    val primaryFixed: Color,
    val onPrimaryFixed: Color,
    val tertiaryFixed: Color,
    val placeholder: Color,
)

val LocalGodinovColors =
    staticCompositionLocalOf {
        GodinovExtendedColors(
            primaryFixed = PrimaryFixed,
            onPrimaryFixed = OnPrimaryFixed,
            tertiaryFixed = TertiaryFixed,
            placeholder = PlaceholderLight,
        )
    }
