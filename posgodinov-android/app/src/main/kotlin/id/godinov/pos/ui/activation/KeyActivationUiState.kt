package id.godinov.pos.ui.activation

enum class ActivationStep {
    SERIAL_KEY,
    DEVICE_BINDING,
}

data class KeyActivationUiState(
    val step: ActivationStep = ActivationStep.SERIAL_KEY,
    val serialKey: String = "",
    val serialKeyError: String? = null,
    val isVerifyingKey: Boolean = false,
    val serialBusiness: String = "",
    val serialOutlet: String = "",
    val businessPassword: String = "",
    val isPasswordVisible: Boolean = false,
    val bindingError: String? = null,
    val isBindingDevice: Boolean = false,
    val isPinging: Boolean = false,
)
