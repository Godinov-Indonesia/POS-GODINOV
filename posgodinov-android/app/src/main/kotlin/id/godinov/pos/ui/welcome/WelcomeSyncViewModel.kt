package id.godinov.pos.ui.welcome

import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.godinov.pos.data.local.BoundTerminal
import id.godinov.pos.data.network.MasterDataSnapshot
import id.godinov.pos.data.network.MasterDataSyncResult
import id.godinov.pos.data.network.fetchMasterData
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

internal sealed interface WelcomeEvent {
    data class PersistSnapshot(
        val snapshot: MasterDataSnapshot,
    ) : WelcomeEvent

    data class ShowMessage(
        val message: String,
        val isError: Boolean = false,
    ) : WelcomeEvent
}

internal class WelcomeSyncViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(WelcomeSyncUiState())
    val uiState: StateFlow<WelcomeSyncUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<WelcomeEvent>(extraBufferCapacity = 4)
    val events: SharedFlow<WelcomeEvent> = _events.asSharedFlow()

    private var boundKey: String? = null
    private var greetingLoopJob: Job? = null
    private var isSyncInFlight = false
    var latestSnapshot: MasterDataSnapshot? = null
        private set

    fun startForTerminal(
        baseUrl: String,
        terminal: BoundTerminal,
    ) {
        val key = "${terminal.deviceToken}|${terminal.serialOutlet}"
        if (boundKey == key) return
        boundKey = key
        latestSnapshot = null
        _uiState.value =
            WelcomeSyncUiState(
                serialBusiness = terminal.serialBusiness,
                serialOutlet = terminal.serialOutlet,
                phase = WelcomePhase.SYNCING,
            )
        startGreetingLoop()
        executeSync(baseUrl, terminal.deviceToken)
    }

    fun advanceGreeting() {
        val greetings = welcomeGreetings(_uiState.value.serialOutlet)
        _uiState.update { state ->
            state.copy(greetingIndex = (state.greetingIndex + 1) % greetings.size)
        }
    }

    fun retrySync(
        baseUrl: String,
        deviceToken: String,
    ) {
        if (isSyncInFlight) return
        executeSync(baseUrl, deviceToken)
    }

    private fun startGreetingLoop() {
        greetingLoopJob?.cancel()
        greetingLoopJob =
            viewModelScope.launch {
                while (isActive) {
                    delay(GREETING_INTERVAL_MS)
                    advanceGreeting()
                }
            }
    }

    private fun executeSync(
        baseUrl: String,
        deviceToken: String,
    ) {
        if (isSyncInFlight) return
        isSyncInFlight = true
        _uiState.update { it.copy(phase = WelcomePhase.SYNCING, errorMessage = null) }

        viewModelScope.launch {
            val startedAt = SystemClock.elapsedRealtime()
            val result = fetchMasterData(baseUrl = baseUrl, deviceToken = deviceToken)
            val elapsed = SystemClock.elapsedRealtime() - startedAt
            if (result is MasterDataSyncResult.Success && elapsed < MIN_WELCOME_CHOREOGRAPHY_MS) {
                delay(MIN_WELCOME_CHOREOGRAPHY_MS - elapsed)
            }

            isSyncInFlight = false
            when (result) {
                is MasterDataSyncResult.Success -> {
                    latestSnapshot = result.snapshot
                    _events.tryEmit(WelcomeEvent.PersistSnapshot(result.snapshot))
                    _uiState.update {
                        it.copy(
                            phase = WelcomePhase.READY,
                            staffCount = result.snapshot.staffs.size,
                            categoryCount = result.snapshot.categoryCount,
                            productCount = result.snapshot.productCount,
                            errorMessage = null,
                        )
                    }
                }
                is MasterDataSyncResult.Rejected -> {
                    val msg =
                        result.serverMessage
                            ?: "Gagal mengunduh data master (HTTP ${result.httpCode}). Silakan coba lagi."
                    _uiState.update { it.copy(phase = WelcomePhase.FAILED, errorMessage = msg) }
                    _events.tryEmit(WelcomeEvent.ShowMessage(msg, isError = true))
                }
                MasterDataSyncResult.Unreachable -> {
                    val msg = "Tidak dapat terhubung ke server POS untuk mengunduh data master."
                    _uiState.update { it.copy(phase = WelcomePhase.FAILED, errorMessage = msg) }
                    _events.tryEmit(WelcomeEvent.ShowMessage(msg, isError = true))
                }
            }
        }
    }

    private companion object {
        const val GREETING_INTERVAL_MS = 2200L
        const val MIN_WELCOME_CHOREOGRAPHY_MS = 1800L
    }
}
