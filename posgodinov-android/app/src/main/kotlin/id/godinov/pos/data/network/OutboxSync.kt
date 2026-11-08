package id.godinov.pos.data.network

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

data class OutboxEntityError(
    val entity: String,
    val id: String,
    val code: String,
    val message: String,
    val retryable: Boolean,
)

sealed interface OutboxPushResult {
    data class Success(
        val errors: List<OutboxEntityError>,
        val serverMasterVersion: Long,
    ) : OutboxPushResult

    data class Rejected(
        val httpCode: Int,
        val retryable: Boolean,
        val serverMessage: String?,
    ) : OutboxPushResult

    data object Unreachable : OutboxPushResult
}

/** Sends a v2 outbox batch to `POST /v1/pos/sync` authenticated with the bound device JWT. */
suspend fun pushOutboxBatch(
    baseUrl: String,
    deviceToken: String,
    requestBodyJson: String,
): OutboxPushResult =
    withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null
        try {
            val payloadBytes = requestBodyJson.toByteArray(Charsets.UTF_8)
            val conn =
                (URL("$baseUrl/v1/pos/sync").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 10000
                    readTimeout = 20000
                    doOutput = true
                    setFixedLengthStreamingMode(payloadBytes.size)
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    setRequestProperty("Accept", "application/json")
                    setRequestProperty("Authorization", "Bearer $deviceToken")
                    setRequestProperty("X-POS-Contract-Version", "2")
                }
            connection = conn
            conn.outputStream.use { it.write(payloadBytes) }

            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val rawBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val root = parseJsonOrNull(rawBody)
            val message = root?.optString("message")?.takeIf { it.isNotBlank() }

            if (code in 200..299) {
                val dataObj = root?.optJSONObject("data") ?: root
                val errors = parseEntityErrors(dataObj?.optJSONArray("errors"))
                val masterVersion = dataObj?.optLong("master_data_version", 0L) ?: 0L
                OutboxPushResult.Success(errors = errors, serverMasterVersion = masterVersion)
            } else {
                val retryable = code == 408 || code == 429 || code in 500..599
                OutboxPushResult.Rejected(httpCode = code, retryable = retryable, serverMessage = message)
            }
        } catch (_: IOException) {
            OutboxPushResult.Unreachable
        } finally {
            connection?.disconnect()
        }
    }

private fun parseEntityErrors(array: JSONArray?): List<OutboxEntityError> {
    if (array == null || array.length() == 0) return emptyList()
    val result = ArrayList<OutboxEntityError>(array.length())
    for (i in 0 until array.length()) {
        val obj = array.optJSONObject(i) ?: continue
        val entity = obj.optString("entity")
        val id = obj.optString("id")
        if (id.isBlank()) continue
        result.add(
            OutboxEntityError(
                entity = entity,
                id = id,
                code = obj.optString("code", "SYNC_REJECTED"),
                message = obj.optString("message", "Ditolak server POS."),
                retryable = obj.optBoolean("retryable", false),
            ),
        )
    }
    return result
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
