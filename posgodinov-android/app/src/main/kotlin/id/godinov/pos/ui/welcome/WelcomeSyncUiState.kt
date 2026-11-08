package id.godinov.pos.ui.welcome

enum class WelcomePhase {
    SYNCING,
    READY,
    FAILED,
}

data class WelcomeSyncUiState(
    val serialBusiness: String = "",
    val serialOutlet: String = "",
    val phase: WelcomePhase = WelcomePhase.SYNCING,
    val greetingIndex: Int = 0,
    val staffCount: Int = 0,
    val categoryCount: Int = 0,
    val productCount: Int = 0,
    val errorMessage: String? = null,
)

internal fun welcomeGreetings(serialOutlet: String): List<String> =
    listOf(
        "Halo",
        "Selamat Datang",
        "Siap Melayani",
        if (serialOutlet.isNotBlank()) "Outlet $serialOutlet" else "Godinov POS",
    )
