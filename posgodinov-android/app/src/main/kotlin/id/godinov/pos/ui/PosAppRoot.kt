package id.godinov.pos.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import id.godinov.pos.data.local.ActiveShiftSession
import id.godinov.pos.data.local.BoundTerminal
import id.godinov.pos.data.local.OutboxSyncWorker
import id.godinov.pos.data.local.TerminalStorage
import id.godinov.pos.data.network.MasterDataSnapshot
import id.godinov.pos.ui.activation.KeyActivationRoute
import id.godinov.pos.ui.cashier.CashierLoginRoute
import id.godinov.pos.ui.welcome.WelcomeSyncRoute
import kotlinx.coroutines.launch

private enum class RootDestination {
    LOADING,
    ACTIVATION,
    WELCOME_SYNC,
    CASHIER_LOGIN,
}

/**
 * Coordinates top-level terminal lifecycle with strict one-time onboarding per APK installation:
 * - Activation Key runs once (`isKeyActivated` committed permanently).
 * - Device Binding runs once (`BoundTerminal` committed permanently).
 * - Welcome + initial Master Sync runs once (`isWelcomeCompleted` committed permanently).
 * - Every subsequent app launch opens directly at [CashierLoginRoute].
 */
@Composable
fun PosAppRoot(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val storage = remember(context) { TerminalStorage(context) }
    val scope = rememberCoroutineScope()

    var destination by remember { mutableStateOf(RootDestination.LOADING) }
    var isKeyActivated by remember { mutableStateOf(false) }
    var boundTerminal by remember { mutableStateOf<BoundTerminal?>(null) }
    var masterSnapshot by remember { mutableStateOf<MasterDataSnapshot?>(null) }
    var activeShift by remember { mutableStateOf<ActiveShiftSession?>(null) }
    var pendingFeedback by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(storage) {
        val saved = storage.loadState()
        isKeyActivated = saved.isKeyActivated
        boundTerminal = saved.terminal
        masterSnapshot = saved.masterData
        activeShift = saved.activeShift
        if (saved.terminal != null) {
            OutboxSyncWorker.ensurePeriodicSyncScheduled(context)
        }
        destination =
            when {
                saved.terminal == null -> RootDestination.ACTIVATION
                !saved.isWelcomeCompleted || saved.masterData == null -> RootDestination.WELCOME_SYNC
                else -> RootDestination.CASHIER_LOGIN
            }
    }

    AnimatedContent(
        targetState = destination,
        transitionSpec = { fadeIn(tween(260)) togetherWith fadeOut(tween(200)) },
        label = "posRootNavigation",
        modifier = modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
    ) { current ->
        when (current) {
            RootDestination.LOADING -> {
                Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background))
            }

            RootDestination.ACTIVATION -> {
                KeyActivationRoute(
                    isKeyAlreadyActivated = isKeyActivated,
                    onKeyActivated = {
                        storage.saveKeyActivated()
                        isKeyActivated = true
                    },
                    onDeviceBound = { token, business, outlet, feedbackMessage ->
                        val terminal =
                            BoundTerminal(
                                deviceToken = token,
                                serialBusiness = business,
                                serialOutlet = outlet,
                            )
                        storage.saveBoundTerminal(terminal)
                        OutboxSyncWorker.ensurePeriodicSyncScheduled(context)
                        isKeyActivated = true
                        boundTerminal = terminal
                        masterSnapshot = null
                        activeShift = null
                        pendingFeedback = feedbackMessage
                        destination = RootDestination.WELCOME_SYNC
                    },
                )
            }

            RootDestination.WELCOME_SYNC -> {
                val terminal = boundTerminal
                if (terminal != null) {
                    WelcomeSyncRoute(
                        terminal = terminal,
                        initialFeedbackMessage = pendingFeedback,
                        onFeedbackConsumed = { pendingFeedback = null },
                        onMasterDataSaved = { snapshot ->
                            storage.saveMasterData(snapshot)
                            masterSnapshot = snapshot.slimForMemory()
                        },
                        onUnlockToCashier = { snapshot ->
                            if (snapshot != null) {
                                masterSnapshot = snapshot.slimForMemory()
                            }
                            scope.launch {
                                storage.saveWelcomeCompleted()
                                pendingFeedback =
                                    "Aktivasi dan pengikatan perangkat tersimpan permanen. Silakan login kasir."
                                destination = RootDestination.CASHIER_LOGIN
                            }
                        },
                    )
                }
            }

            RootDestination.CASHIER_LOGIN -> {
                val terminal = boundTerminal
                if (terminal != null) {
                    CashierLoginRoute(
                        terminal = terminal,
                        initialMasterData = masterSnapshot,
                        initialShift = activeShift,
                        initialFeedbackMessage = pendingFeedback,
                        onFeedbackConsumed = { pendingFeedback = null },
                        onPersistMasterData = { snapshot ->
                            storage.saveMasterData(snapshot)
                            masterSnapshot = snapshot.slimForMemory()
                        },
                        onPersistShift = { shift ->
                            activeShift = shift
                            storage.saveActiveShift(shift)
                        },
                    )
                }
            }
        }
    }
}
