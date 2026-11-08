package id.godinov.pos.data.network

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONException
import org.json.JSONObject

sealed interface DeviceBindResult {
    data class Success(
        val deviceToken: String,
        val serverMessage: String?,
    ) : DeviceBindResult

    data class Rejected(
        val httpCode: Int,
        val serverMessage: String?,
    ) : DeviceBindResult

    data object Unreachable : DeviceBindResult
}

sealed interface KeyVerifyResult {
    data class Success(
        val serverMessage: String?,
    ) : KeyVerifyResult

    data class Rejected(
        val httpCode: Int,
        val serverMessage: String?,
    ) : KeyVerifyResult

    data object Unreachable : KeyVerifyResult
}

/** Verifies a mobile POS activation credential key via `POST /v1/auth/pos-mobile/verify`. */
suspend fun verifyPosMobileKey(
    baseUrl: String,
    serialKey: String,
): KeyVerifyResult =
    withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null
        try {
            val payload =
                JSONObject()
                    .put("key", serialKey)
                    .toString()
                    .toByteArray(Charsets.UTF_8)

            val conn =
                (URL("$baseUrl/v1/auth/pos-mobile/verify").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 8000
                    readTimeout = 8000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    setRequestProperty("Accept", "application/json")
                    setFixedLengthStreamingMode(payload.size)
                }
            connection = conn
            conn.outputStream.use { it.write(payload) }

            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val rawBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = parseJsonOrNull(rawBody)
            val message = json?.optString("message")?.takeIf { it.isNotBlank() }

            if (code in 200..299) {
                KeyVerifyResult.Success(serverMessage = message)
            } else {
                KeyVerifyResult.Rejected(httpCode = code, serverMessage = message)
            }
        } catch (_: IOException) {
            KeyVerifyResult.Unreachable
        } finally {
            connection?.disconnect()
        }
    }

/** Binds this POS terminal to an outlet via `POST /v1/auth/device/bind`. */
suspend fun bindDevice(
    baseUrl: String,
    serialBusiness: String,
    serialOutlet: String,
    password: String,
): DeviceBindResult =
    withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null
        try {
            val payload =
                JSONObject()
                    .put("serial_business", serialBusiness)
                    .put("serial_outlet", serialOutlet)
                    .put("password", password)
                    .toString()
                    .toByteArray(Charsets.UTF_8)

            val conn =
                (URL("$baseUrl/v1/auth/device/bind").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 8000
                    readTimeout = 8000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    setRequestProperty("Accept", "application/json")
                    setFixedLengthStreamingMode(payload.size)
                }
            connection = conn
            conn.outputStream.use { it.write(payload) }

            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val rawBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = parseJsonOrNull(rawBody)
            val message = json?.optString("message")?.takeIf { it.isNotBlank() }

            if (code in 200..299) {
                val token = json?.optJSONObject("data")?.optString("device_token").orEmpty()
                if (token.isNotBlank()) {
                    DeviceBindResult.Success(deviceToken = token, serverMessage = message)
                } else {
                    DeviceBindResult.Rejected(httpCode = code, serverMessage = message)
                }
            } else {
                DeviceBindResult.Rejected(httpCode = code, serverMessage = message)
            }
        } catch (_: IOException) {
            DeviceBindResult.Unreachable
        } finally {
            connection?.disconnect()
        }
    }

private fun parseJsonOrNull(raw: String): JSONObject? =
    if (raw.isBlank()) {
        null
    } else {
        try {
            JSONObject(raw)
        } catch (_: JSONException) {
            null
        }
    }
