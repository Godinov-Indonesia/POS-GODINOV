package id.godinov.pos.ui.welcome

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import id.godinov.pos.R
import id.godinov.pos.ui.components.PosSnackbarHost
import id.godinov.pos.ui.icons.PosIcons
import id.godinov.pos.ui.theme.GodinovPosTheme
import kotlinx.coroutines.launch

@Composable
fun WelcomeSyncScreen(
    uiState: WelcomeSyncUiState,
    snackbarHostState: SnackbarHostState,
    onAdvanceGreeting: () -> Unit,
    onRetrySync: () -> Unit,
    onUnlockToCashier: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colorScheme = MaterialTheme.colorScheme
    val scope = rememberCoroutineScope()
    val dragOffsetPx = remember { Animatable(0f) }
    var isUnlocking by remember { mutableStateOf(false) }
    val greetings = remember(uiState.serialOutlet) { welcomeGreetings(uiState.serialOutlet) }
    val activeGreeting = greetings[uiState.greetingIndex % greetings.size]

    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxSize()
                .background(colorScheme.background)
                .systemBarsPadding()
                .imePadding(),
    ) {
        val isTablet = maxWidth >= 600.dp
        val isShort = maxHeight < 520.dp
        val viewportHeightPx = constraints.maxHeight.toFloat().coerceAtLeast(1f)
        val unlockThresholdPx = with(LocalDensity.current) { 110.dp.toPx() }

        fun completeUnlock() {
            if (isUnlocking || uiState.phase != WelcomePhase.READY) return
            isUnlocking = true
            scope.launch {
                dragOffsetPx.animateTo(
                    targetValue = -viewportHeightPx,
                    animationSpec = tween(durationMillis = 280),
                )
                onUnlockToCashier()
            }
        }

        val swipeModifier =
            if (uiState.phase == WelcomePhase.READY) {
                Modifier.pointerInput(Unit) {
                    detectVerticalDragGestures(
                        onVerticalDrag = { change, dragAmount ->
                            if (!isUnlocking) {
                                change.consume()
                                val next = (dragOffsetPx.value + dragAmount).coerceAtMost(0f)
                                scope.launch { dragOffsetPx.snapTo(next) }
                            }
                        },
                        onDragEnd = {
                            if (!isUnlocking) {
                                if (-dragOffsetPx.value >= unlockThresholdPx) {
                                    completeUnlock()
                                } else {
                                    scope.launch {
                                        dragOffsetPx.animateTo(
                                            targetValue = 0f,
                                            animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
                                        )
                                    }
                                }
                            }
                        },
                        onDragCancel = {
                            if (!isUnlocking) {
                                scope.launch { dragOffsetPx.animateTo(0f, spring()) }
                            }
                        },
                    )
                }
            } else {
                Modifier
            }

        Box(modifier = Modifier.fillMaxSize().then(swipeModifier)) {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(
                            horizontal = if (isTablet) 32.dp else 20.dp,
                            vertical = if (isShort) 16.dp else 28.dp,
                        )
                        .graphicsLayer {
                            translationY = dragOffsetPx.value
                            alpha = (1f + (dragOffsetPx.value / viewportHeightPx)).coerceIn(0.15f, 1f)
                        },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Image(
                        painter = painterResource(id = R.drawable.godinov_pos_logo),
                        contentDescription = "Godinov POS",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.height(if (isTablet) 88.dp else 68.dp),
                    )
                    if (uiState.serialBusiness.isNotBlank() || uiState.serialOutlet.isNotBlank()) {
                        Spacer(modifier = Modifier.height(12.dp))
                        OutletIdentityPill(
                            serialBusiness = uiState.serialBusiness,
                            serialOutlet = uiState.serialOutlet,
                        )
                    }
                }

                Spacer(modifier = Modifier.height(if (isShort) 16.dp else 32.dp))

                InteractiveGreetingHero(
                    greeting = activeGreeting,
                    isTablet = isTablet,
                    onTapGreeting = onAdvanceGreeting,
                )

                Spacer(modifier = Modifier.height(if (isShort) 16.dp else 32.dp))

                WelcomeSyncCard(
                    uiState = uiState,
                    isTablet = isTablet,
                    onRetrySync = onRetrySync,
                    onTriggerUnlock = ::completeUnlock,
                )
            }

            PosSnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp),
            )
        }
    }
}

@Composable
private fun InteractiveGreetingHero(
    greeting: String,
    isTablet: Boolean,
    onTapGreeting: () -> Unit,
) {
    val colorScheme = MaterialTheme.colorScheme
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    Surface(
        onClick = onTapGreeting,
        interactionSource = interactionSource,
        shape = MaterialTheme.shapes.extraLarge,
        color = colorScheme.background,
        border = if (isFocused) BorderStroke(2.dp, colorScheme.primary) else null,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            AnimatedContent(
                targetState = greeting,
                transitionSpec = {
                    (fadeIn(tween(420)) + slideInVertically(tween(420)) { it / 3 })
                        .togetherWith(fadeOut(tween(260)) + slideOutVertically(tween(260)) { -it / 3 })
                        .using(SizeTransform(clip = false))
                },
                label = "welcomeGreetingCycle",
            ) { currentText ->
                Text(
                    text = currentText,
                    style =
                        if (isTablet) {
                            MaterialTheme.typography.displayLarge
                        } else {
                            MaterialTheme.typography.displayMedium
                        },
                    color = colorScheme.onSurface,
                    textAlign = TextAlign.Center,
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Perangkat kasir berhasil ditautkan dengan outlet Anda.",
                style = MaterialTheme.typography.bodyLarge,
                color = colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun OutletIdentityPill(
    serialBusiness: String,
    serialOutlet: String,
) {
    val colorScheme = MaterialTheme.colorScheme
    Surface(
        shape = CircleShape,
        color = colorScheme.surfaceContainerLow,
        border = BorderStroke(1.dp, colorScheme.surfaceContainerHigh),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(
                imageVector = PosIcons.Storefront,
                contentDescription = null,
                tint = colorScheme.primary,
                modifier = Modifier.size(18.dp),
            )
            Text(
                text = serialBusiness.ifBlank { "Bisnis Terdaftar" },
                style = MaterialTheme.typography.titleSmall,
                color = colorScheme.onSurface,
            )
            Text(text = "•", style = MaterialTheme.typography.titleSmall, color = colorScheme.onSurfaceVariant)
            Icon(
                imageVector = PosIcons.LocationOn,
                contentDescription = null,
                tint = colorScheme.tertiary,
                modifier = Modifier.size(18.dp),
            )
            Text(
                text = serialOutlet.ifBlank { "Outlet Aktif" },
                style = MaterialTheme.typography.titleSmall,
                color = colorScheme.secondary,
            )
        }
    }
}

@Composable
private fun PreviewWelcomeScreen(uiState: WelcomeSyncUiState) {
    GodinovPosTheme {
        WelcomeSyncScreen(
            uiState = uiState,
            snackbarHostState = remember { SnackbarHostState() },
            onAdvanceGreeting = {},
            onRetrySync = {},
            onUnlockToCashier = {},
        )
    }
}

@Preview(widthDp = 1280, heightDp = 800, showBackground = true)
@Composable
private fun WelcomeTabletReadyPreview() {
    PreviewWelcomeScreen(
        WelcomeSyncUiState(
            serialBusiness = "BIZ-GODINOV-01",
            serialOutlet = "OUT-SUDIRMAN-01",
            phase = WelcomePhase.READY,
            greetingIndex = 1,
            staffCount = 4,
            categoryCount = 8,
            productCount = 62,
        ),
    )
}

@Preview(widthDp = 390, heightDp = 844, showBackground = true)
@Composable
private fun WelcomePhoneSyncingPreview() {
    PreviewWelcomeScreen(
        WelcomeSyncUiState(
            serialBusiness = "BIZ-GODINOV-01",
            serialOutlet = "OUT-SUDIRMAN-01",
            phase = WelcomePhase.SYNCING,
        ),
    )
}

@Preview(widthDp = 1280, heightDp = 800, showBackground = true)
@Composable
private fun WelcomeErrorPreview() {
    PreviewWelcomeScreen(
        WelcomeSyncUiState(
            serialBusiness = "BIZ-GODINOV-01",
            serialOutlet = "OUT-SUDIRMAN-01",
            phase = WelcomePhase.FAILED,
            errorMessage = "Tidak dapat terhubung ke server POS untuk mengunduh data master.",
        ),
    )
}
