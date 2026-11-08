package id.godinov.pos.ui.icons

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/** Material Symbols 24dp vector icons scoped strictly to POS domain actions. */
object PosIcons {
    val Domain: ImageVector by lazy { buildDomainIcon() }
    val Storefront: ImageVector by lazy { buildStorefrontIcon() }
    val Visibility: ImageVector by lazy { buildVisibilityIcon() }
    val VisibilityOff: ImageVector by lazy { buildVisibilityOffIcon() }
    val VerifiedUser: ImageVector by lazy { buildVerifiedUserIcon() }
    val Devices: ImageVector by lazy { buildDevicesIcon() }

    val ArrowBack: ImageVector by lazy {
        materialIcon("ArrowBack") {
            moveTo(20.0f, 11.0f)
            horizontalLineTo(7.83f)
            lineToRelative(5.59f, -5.59f)
            lineTo(12.0f, 4.0f)
            lineToRelative(-8.0f, 8.0f)
            lineToRelative(8.0f, 8.0f)
            lineToRelative(1.41f, -1.41f)
            lineTo(7.83f, 13.0f)
            horizontalLineTo(20.0f)
            verticalLineToRelative(-2.0f)
            close()
        }
    }

    val VpnKey: ImageVector by lazy {
        materialIcon("VpnKey") {
            moveTo(12.65f, 10.0f)
            curveTo(11.83f, 7.67f, 9.61f, 6.0f, 7.0f, 6.0f)
            curveTo(3.69f, 6.0f, 1.0f, 8.69f, 1.0f, 12.0f)
            reflectiveCurveToRelative(2.69f, 6.0f, 6.0f, 6.0f)
            curveToRelative(2.61f, 0.0f, 4.83f, -1.67f, 5.65f, -4.0f)
            horizontalLineTo(17.0f)
            verticalLineToRelative(4.0f)
            horizontalLineToRelative(4.0f)
            verticalLineToRelative(-4.0f)
            horizontalLineToRelative(2.0f)
            verticalLineToRelative(-4.0f)
            horizontalLineTo(12.65f)
            close()
            moveTo(7.0f, 14.0f)
            curveToRelative(-1.1f, 0.0f, -2.0f, -0.9f, -2.0f, -2.0f)
            reflectiveCurveToRelative(0.9f, -2.0f, 2.0f, -2.0f)
            reflectiveCurveToRelative(2.0f, 0.9f, 2.0f, 2.0f)
            reflectiveCurveToRelative(-0.9f, 2.0f, -2.0f, 2.0f)
            close()
        }
    }

    val Key: ImageVector by lazy {
        materialIcon("Key") {
            moveTo(21.0f, 10.0f)
            horizontalLineToRelative(-8.35f)
            curveTo(11.83f, 7.67f, 9.61f, 6.0f, 7.0f, 6.0f)
            curveToRelative(-3.31f, 0.0f, -6.0f, 2.69f, -6.0f, 6.0f)
            reflectiveCurveToRelative(2.69f, 6.0f, 6.0f, 6.0f)
            curveToRelative(2.61f, 0.0f, 4.83f, -1.67f, 5.65f, -4.0f)
            horizontalLineTo(13.0f)
            lineToRelative(2.0f, 2.0f)
            lineToRelative(2.0f, -2.0f)
            lineToRelative(2.0f, 2.0f)
            lineToRelative(4.0f, -4.04f)
            lineTo(21.0f, 10.0f)
            close()
            moveTo(7.0f, 15.0f)
            curveToRelative(-1.65f, 0.0f, -3.0f, -1.35f, -3.0f, -3.0f)
            reflectiveCurveToRelative(1.35f, -3.0f, 3.0f, -3.0f)
            reflectiveCurveToRelative(3.0f, 1.35f, 3.0f, 3.0f)
            reflectiveCurveToRelative(-1.35f, 3.0f, -3.0f, 3.0f)
            close()
        }
    }

    val Link: ImageVector by lazy {
        materialIcon("Link") {
            moveTo(3.9f, 12.0f)
            curveToRelative(0.0f, -1.71f, 1.39f, -3.1f, 3.1f, -3.1f)
            horizontalLineToRelative(4.0f)
            verticalLineTo(7.0f)
            horizontalLineTo(7.0f)
            curveToRelative(-2.76f, 0.0f, -5.0f, 2.24f, -5.0f, 5.0f)
            reflectiveCurveToRelative(2.24f, 5.0f, 5.0f, 5.0f)
            horizontalLineToRelative(4.0f)
            verticalLineToRelative(-1.9f)
            horizontalLineTo(7.0f)
            curveToRelative(-1.71f, 0.0f, -3.1f, -1.39f, -3.1f, -3.1f)
            close()
            moveTo(8.0f, 13.0f)
            horizontalLineToRelative(8.0f)
            verticalLineToRelative(-2.0f)
            horizontalLineTo(8.0f)
            verticalLineToRelative(2.0f)
            close()
            moveTo(17.0f, 7.0f)
            horizontalLineToRelative(-4.0f)
            verticalLineToRelative(1.9f)
            horizontalLineToRelative(4.0f)
            curveToRelative(1.71f, 0.0f, 3.1f, 1.39f, 3.1f, 3.1f)
            reflectiveCurveToRelative(-1.39f, 3.1f, -3.1f, 3.1f)
            horizontalLineToRelative(-4.0f)
            verticalLineTo(17.0f)
            horizontalLineToRelative(4.0f)
            curveToRelative(2.76f, 0.0f, 5.0f, -2.24f, 5.0f, -5.0f)
            reflectiveCurveToRelative(-2.24f, -5.0f, -5.0f, -5.0f)
            close()
        }
    }

    val Help: ImageVector by lazy {
        materialIcon("Help") {
            moveTo(11.0f, 18.0f)
            horizontalLineToRelative(2.0f)
            verticalLineToRelative(-2.0f)
            horizontalLineToRelative(-2.0f)
            verticalLineToRelative(2.0f)
            close()
            moveTo(12.0f, 2.0f)
            curveTo(6.48f, 2.0f, 2.0f, 6.48f, 2.0f, 12.0f)
            reflectiveCurveToRelative(4.48f, 10.0f, 10.0f, 10.0f)
            reflectiveCurveToRelative(10.0f, -4.48f, 10.0f, -10.0f)
            reflectiveCurveTo(17.52f, 2.0f, 12.0f, 2.0f)
            close()
            moveTo(12.0f, 20.0f)
            curveToRelative(-4.41f, 0.0f, -8.0f, -3.59f, -8.0f, -8.0f)
            reflectiveCurveToRelative(3.59f, -8.0f, 8.0f, -8.0f)
            reflectiveCurveToRelative(8.0f, 3.59f, 8.0f, 8.0f)
            reflectiveCurveToRelative(-3.59f, 8.0f, -8.0f, 8.0f)
            close()
            moveTo(12.0f, 6.0f)
            curveToRelative(-2.21f, 0.0f, -4.0f, 1.79f, -4.0f, 4.0f)
            horizontalLineToRelative(2.0f)
            curveToRelative(0.0f, -1.1f, 0.9f, -2.0f, 2.0f, -2.0f)
            reflectiveCurveToRelative(2.0f, 0.9f, 2.0f, 2.0f)
            curveToRelative(0.0f, 2.0f, -3.0f, 1.75f, -3.0f, 5.0f)
            horizontalLineToRelative(2.0f)
            curveToRelative(0.0f, -2.25f, 3.0f, -2.5f, 3.0f, -5.0f)
            curveToRelative(0.0f, -2.21f, -1.79f, -4.0f, -4.0f, -4.0f)
            close()
        }
    }

    val Sensors: ImageVector by lazy {
        materialIcon("Sensors") {
            moveTo(7.76f, 16.24f)
            curveTo(6.67f, 15.16f, 6.0f, 13.66f, 6.0f, 12.0f)
            reflectiveCurveToRelative(0.67f, -3.16f, 1.76f, -4.24f)
            lineToRelative(1.42f, 1.42f)
            curveTo(8.45f, 9.9f, 8.0f, 10.9f, 8.0f, 12.0f)
            curveToRelative(0.0f, 1.1f, 0.45f, 2.1f, 1.17f, 2.83f)
            lineTo(7.76f, 16.24f)
            close()
            moveTo(16.24f, 16.24f)
            lineToRelative(-1.41f, -1.41f)
            curveTo(15.55f, 14.1f, 16.0f, 13.1f, 16.0f, 12.0f)
            curveToRelative(0.0f, -1.1f, -0.45f, -2.1f, -1.17f, -2.83f)
            lineToRelative(1.41f, -1.41f)
            curveTo(17.33f, 8.84f, 18.0f, 10.34f, 18.0f, 12.0f)
            reflectiveCurveTo(17.33f, 15.16f, 16.24f, 16.24f)
            close()
            moveTo(12.0f, 10.0f)
            curveToRelative(-1.1f, 0.0f, -2.0f, 0.9f, -2.0f, 2.0f)
            reflectiveCurveToRelative(0.9f, 2.0f, 2.0f, 2.0f)
            reflectiveCurveToRelative(2.0f, -0.9f, 2.0f, -2.0f)
            reflectiveCurveToRelative(-0.9f, -2.0f, -2.0f, -2.0f)
            close()
            moveTo(4.93f, 19.07f)
            curveTo(3.12f, 17.26f, 2.0f, 14.76f, 2.0f, 12.0f)
            reflectiveCurveToRelative(1.12f, -5.26f, 2.93f, -7.07f)
            lineToRelative(1.41f, 1.41f)
            curveTo(4.9f, 7.79f, 4.0f, 9.79f, 4.0f, 12.0f)
            reflectiveCurveToRelative(0.9f, 4.21f, 2.34f, 5.66f)
            lineTo(4.93f, 19.07f)
            close()
            moveTo(19.07f, 19.07f)
            lineToRelative(-1.41f, -1.41f)
            curveTo(19.1f, 16.21f, 20.0f, 14.21f, 20.0f, 12.0f)
            reflectiveCurveToRelative(-0.9f, -4.21f, -2.34f, -5.66f)
            lineToRelative(1.41f, -1.41f)
            curveTo(20.88f, 6.74f, 22.0f, 9.24f, 22.0f, 12.0f)
            reflectiveCurveTo(20.88f, 17.26f, 19.07f, 19.07f)
            close()
        }
    }

    val Close: ImageVector by lazy {
        materialIcon("Close") {
            moveTo(19.0f, 6.41f)
            lineTo(17.59f, 5.0f)
            lineTo(12.0f, 10.59f)
            lineTo(6.41f, 5.0f)
            lineTo(5.0f, 6.41f)
            lineTo(10.59f, 12.0f)
            lineTo(5.0f, 17.59f)
            lineTo(6.41f, 19.0f)
            lineTo(12.0f, 13.41f)
            lineTo(17.59f, 19.0f)
            lineTo(19.0f, 17.59f)
            lineTo(13.41f, 12.0f)
            lineTo(19.0f, 6.41f)
            close()
        }
    }

    val ContentPaste: ImageVector by lazy {
        materialIcon("ContentPaste") {
            moveTo(19.0f, 2.0f)
            horizontalLineToRelative(-4.18f)
            curveTo(14.4f, 0.84f, 13.3f, 0.0f, 12.0f, 0.0f)
            reflectiveCurveTo(9.6f, 0.84f, 9.18f, 2.0f)
            horizontalLineTo(5.0f)
            curveTo(3.9f, 2.0f, 3.0f, 2.9f, 3.0f, 4.0f)
            verticalLineToRelative(16.0f)
            curveToRelative(0.0f, 1.1f, 0.9f, 2.0f, 2.0f, 2.0f)
            horizontalLineToRelative(14.0f)
            curveToRelative(1.1f, 0.0f, 2.0f, -0.9f, 2.0f, -2.0f)
            verticalLineTo(4.0f)
            curveTo(21.0f, 2.9f, 20.1f, 2.0f, 19.0f, 2.0f)
            close()
            moveTo(12.0f, 2.0f)
            curveToRelative(0.55f, 0.0f, 1.0f, 0.45f, 1.0f, 1.0f)
            reflectiveCurveToRelative(-0.45f, 1.0f, -1.0f, 1.0f)
            reflectiveCurveToRelative(-1.0f, -0.45f, -1.0f, -1.0f)
            reflectiveCurveTo(11.45f, 2.0f, 12.0f, 2.0f)
            close()
            moveTo(19.0f, 20.0f)
            horizontalLineTo(5.0f)
            verticalLineTo(4.0f)
            horizontalLineToRelative(2.0f)
            verticalLineToRelative(3.0f)
            horizontalLineToRelative(10.0f)
            verticalLineTo(4.0f)
            horizontalLineToRelative(2.0f)
            verticalLineToRelative(16.0f)
            close()
        }
    }

    val Database: ImageVector by lazy { buildDatabaseIcon() }
    val CloudOff: ImageVector by lazy { buildCloudOffIcon() }
    val CheckCircle: ImageVector by lazy { buildCheckCircleIcon() }
    val Warning: ImageVector by lazy { buildWarningIcon() }
}

internal fun materialIcon(
    name: String,
    block: PathBuilder.() -> Unit,
): ImageVector =
    ImageVector.Builder(
        name = name,
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    ).apply {
        path(
            fill = SolidColor(Color.Black),
            pathFillType = PathFillType.NonZero,
            pathBuilder = block,
        )
    }.build()
