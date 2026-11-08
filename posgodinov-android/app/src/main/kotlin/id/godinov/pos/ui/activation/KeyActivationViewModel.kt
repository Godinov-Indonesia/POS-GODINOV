package id.godinov.pos.ui.activation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.godinov.pos.data.network.DeviceBindResult
import id.godinov.pos.data.network.HealthCheckResult
import id.godinov.pos.data.network.KeyVerifyResult
import id.godinov.pos.data.network.bindDevice
import id.godinov.pos.data.network.checkBackendHealth
import id.godinov.pos.data.network.verifyPosMobileKey
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal sealed interface ActivationEvent {
    data class ShowMessage(
        val message: String,
        val isError: Boolean = false,
    ) : ActivationEvent

    data object KeyActivated : ActivationEvent

    data class DeviceBound(
        val deviceToken: String,
        val serialBusiness: String,
        val serialOutlet: String,
        val feedbackMessage: String,
    ) : ActivationEvent
}

internal class KeyActivationViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(KeyActivationUiState())
    val uiState: StateFlow<KeyActivationUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<ActivationEvent>(extraBufferCapacity = 4)
    val events: SharedFlow<ActivationEvent> = _events.asSharedFlow()

    fun syncPersistedKeyActivation(isKeyAlreadyActivated: Boolean) {
        if (isKeyAlreadyActivated && _uiState.value.step == ActivationStep.SERIAL_KEY) {
            _uiState.update { it.copy(step = ActivationStep.DEVICE_BINDING, serialKeyError = null) }
        }
    }

    fun onSerialKeyChange(raw: String) {
        val sanitized = sanitizeSerialKey(raw)
        _uiState.update { state ->
            state.copy(
                serialKey = sanitized,
                serialKeyError =
                    if (state.serialKeyError != null && sanitized.length >= MIN_SERIAL_KEY_LENGTH) {
                        null
                    } else {
                        state.serialKeyError
                    },
            )
        }
    }

    fun onClearSerialKey() {
        _uiState.update { it.copy(serialKey = "", serialKeyError = null) }
    }

    fun onPasteSerialKey(rawClipboardText: String?) {
        val sanitized = rawClipboardText?.let(::sanitizeSerialKey).orEmpty()
        if (sanitized.isNotEmpty()) {
            _uiState.update { it.copy(serialKey = sanitized, serialKeyError = null) }
            emitMessage("Serial key berhasil ditempel dari papan klip.")
        } else {
            emitMessage("Papan klip kosong atau tidak berisi karakter valid.", isError = true)
        }
    }

    fun onSerialBusinessChange(raw: String) {
        val sanitized = sanitizeSerialCode(raw)
        _uiState.update { it.copy(serialBusiness = sanitized, bindingError = null) }
    }

    fun onSerialOutletChange(raw: String) {
        val sanitized = sanitizeSerialCode(raw)
        _uiState.update { it.copy(serialOutlet = sanitized, bindingError = null) }
    }

    fun onBusinessPasswordChange(updated: String) {
        _uiState.update { it.copy(businessPassword = updated, bindingError = null) }
    }

    fun onTogglePasswordVisibility() {
        _uiState.update { it.copy(isPasswordVisible = !it.isPasswordVisible) }
    }

    fun pingServer(baseUrl: String) {
        if (_uiState.value.isPinging) return
        viewModelScope.launch {
            _uiState.update { it.copy(isPinging = true) }
            val health = checkBackendHealth(baseUrl)
            _uiState.update { it.copy(isPinging = false) }
            emitMessage(health.toUiMessage(), isError = !health.isReachable)
        }
    }

    fun submitSerialKey(baseUrl: String) {
        val current = _uiState.value
        if (current.isVerifyingKey || current.step == ActivationStep.DEVICE_BINDING) return
        val key = current.serialKey.trim()
        if (key.length < MIN_SERIAL_KEY_LENGTH) {
            val msg = "Masukkan Serial Key valid (minimal $MIN_SERIAL_KEY_LENGTH karakter)."
            _uiState.update { it.copy(serialKeyError = msg) }
            emitMessage(msg, isError = true)
            return
        }

        _uiState.update { it.copy(serialKeyError = null, isVerifyingKey = true) }
        viewModelScope.launch {
            when (val res = verifyPosMobileKey(baseUrl, key)) {
                is KeyVerifyResult.Success -> {
                    _events.emit(ActivationEvent.KeyActivated)
                    _uiState.update {
                        it.copy(
                            isVerifyingKey = false,
                            step = ActivationStep.DEVICE_BINDING,
                            bindingError = null,
                        )
                    }
                    emitMessage(
                        res.serverMessage
                            ?: "Kunci aktivasi terverifikasi dan dikunci permanen. Silakan tautkan perangkat.",
                    )
                }
                is KeyVerifyResult.Rejected -> {
                    val msg = res.serverMessage ?: "Serial Key kredensial tidak valid."
                    _uiState.update { it.copy(isVerifyingKey = false, serialKeyError = msg) }
                    emitMessage(msg, isError = true)
                }
                KeyVerifyResult.Unreachable -> {
                    val msg = "Gagal memverifikasi kunci: tidak dapat terhubung ke server POS."
                    _uiState.update { it.copy(isVerifyingKey = false, serialKeyError = msg) }
                    emitMessage(msg, isError = true)
                }
            }
        }
    }

    fun submitDeviceBinding(baseUrl: String) {
        val current = _uiState.value
        if (current.isBindingDevice) return

        val business = current.serialBusiness.trim()
        val outlet = current.serialOutlet.trim()
        val password = current.businessPassword

        if (business.isEmpty() || outlet.isEmpty() || password.isBlank()) {
            val msg = "Serial Business, Serial Outlet, dan Password Business wajib diisi."
            _uiState.update { it.copy(bindingError = msg) }
            emitMessage(msg, isError = true)
            return
        }

        _uiState.update { it.copy(bindingError = null, isBindingDevice = true) }
        viewModelScope.launch {
            when (val result = bindDevice(baseUrl, business, outlet, password)) {
                is DeviceBindResult.Success -> {
                    _uiState.update { it.copy(isBindingDevice = false, businessPassword = "") }
                    val feedback =
                        result.serverMessage
                            ?: "Perangkat berhasil ditautkan permanen ke outlet $outlet."
                    _events.emit(
                        ActivationEvent.DeviceBound(
                            deviceToken = result.deviceToken,
                            serialBusiness = business,
                            serialOutlet = outlet,
                            feedbackMessage = feedback,
                        ),
                    )
                }
                is DeviceBindResult.Rejected -> {
                    val msg =
                        result.serverMessage
                            ?: "Gagal menautkan perangkat (HTTP ${result.httpCode}). Periksa kredensial bisnis."
                    _uiState.update { it.copy(isBindingDevice = false, bindingError = msg) }
                    emitMessage(msg, isError = true)
                }
                DeviceBindResult.Unreachable -> {
                    val msg = "Gagal menautkan perangkat: tidak dapat terhubung ke server POS."
                    _uiState.update { it.copy(isBindingDevice = false, bindingError = msg) }
                    emitMessage(msg, isError = true)
                }
            }
        }
    }

    private fun emitMessage(
        message: String,
        isError: Boolean = false,
    ) {
        _events.tryEmit(ActivationEvent.ShowMessage(message = message, isError = isError))
    }
}

private fun HealthCheckResult.toUiMessage(): String =
    when (httpCode) {
        null -> "Server tidak terjangkau. Periksa koneksi internet perangkat."
        in 200..299 -> "Terhubung ke server POS (${elapsedMs} mdtk)."
        else -> "Server POS merespons HTTP $httpCode (${elapsedMs} mdtk)."
    }
