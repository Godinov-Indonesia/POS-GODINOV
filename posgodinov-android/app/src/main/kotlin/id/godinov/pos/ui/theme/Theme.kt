package id.godinov.pos.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.unit.dp

// Deliberate 3-tier corner scale: 12dp controls, 16dp tactile inputs/CTAs, 24dp primary card deck.
val GodinovShapes =
    Shapes(
        small = RoundedCornerShape(8.dp),
        medium = RoundedCornerShape(12.dp),
        large = RoundedCornerShape(16.dp),
        extraLarge = RoundedCornerShape(24.dp),
    )

@Composable
fun GodinovPosTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) GodinovDarkColorScheme else GodinovLightColorScheme
    val extendedColors =
        if (darkTheme) {
            GodinovExtendedColors(
                primaryFixed = PrimaryContainerDark,
                onPrimaryFixed = OnPrimaryContainerDark,
                tertiaryFixed = TertiaryDark,
                placeholder = PlaceholderDark,
            )
        } else {
            GodinovExtendedColors(
                primaryFixed = PrimaryFixed,
                onPrimaryFixed = OnPrimaryFixed,
                tertiaryFixed = TertiaryFixed,
                placeholder = PlaceholderLight,
            )
        }

    CompositionLocalProvider(LocalGodinovColors provides extendedColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = GodinovTypography,
            shapes = GodinovShapes,
            content = content,
        )
    }
}
