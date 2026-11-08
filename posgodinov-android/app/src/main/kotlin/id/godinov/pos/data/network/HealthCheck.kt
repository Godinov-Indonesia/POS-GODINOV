package id.godinov.pos.data.network

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlin.time.TimeSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** [httpCode] is null when the server could not be reached at all. */
data class HealthCheckResult(
    val httpCode: Int?,
    val elapsedMs: Long,
) {
    val isReachable: Boolean get() = httpCode != null && httpCode < 500
}

suspend fun checkBackendHealth(baseUrl: String): HealthCheckResult =
    withContext(Dispatchers.IO) {
        val start = TimeSource.Monotonic.markNow()
        var connection: HttpURLConnection? = null
        try {
            val conn =
                (URL("$baseUrl/health").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 5000
                    readTimeout = 5000
                    instanceFollowRedirects = true
                }
            connection = conn
            val code = conn.responseCode
            HealthCheckResult(httpCode = code, elapsedMs = start.elapsedNow().inWholeMilliseconds)
        } catch (_: IOException) {
            HealthCheckResult(httpCode = null, elapsedMs = start.elapsedNow().inWholeMilliseconds)
        } finally {
            connection?.disconnect()
        }
    }
