package id.godinov.pos.ui.activation

internal const val MAX_SERIAL_KEY_LENGTH = 24
internal const val MIN_SERIAL_KEY_LENGTH = 8
internal const val MAX_SERIAL_CODE_LENGTH = 32
internal const val MOCK_VALID_SERIAL_KEY = "KEY-9920-POS-XK88"

private val SerialAllowedChars = Regex("[^A-Z0-9-]")

internal fun sanitizeSerialKey(raw: String): String =
    raw.uppercase().replace(SerialAllowedChars, "").take(MAX_SERIAL_KEY_LENGTH)

internal fun sanitizeSerialCode(raw: String): String =
    raw.uppercase().replace(SerialAllowedChars, "").take(MAX_SERIAL_CODE_LENGTH)
