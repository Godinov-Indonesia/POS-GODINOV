package id.godinov.pos.data.network

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.roundToLong
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

data class PosStaffMember(
    val id: String,
    val staffIdentifier: String,
    val name: String,
    val pinHash: String,
    val role: String,
    val permissions: List<String>,
)

data class PosMasterCategory(
    val id: String,
    val name: String,
    val description: String,
)

data class PosMasterProduct(
    val id: String,
    val name: String,
    val sku: String?,
    val priceRupiah: Long,
    val imageUrl: String,
    val categoryId: String?,
)

data class PosSyncConfig(
    val masterDataMaxAgeMinutes: Int,
    val requireSupervisorForVoid: Boolean,
    val requireSupervisorForReturn: Boolean,
    val blindCloseEnabled: Boolean,
)

data class MasterDataSnapshot(
    val version: Long,
    val staffs: List<PosStaffMember>,
    val categories: List<PosMasterCategory>,
    val products: List<PosMasterProduct>,
    val categoryCount: Int,
    val productCount: Int,
    val config: PosSyncConfig,
    val syncedAtEpochMs: Long,
) {
    /** Releases transient catalog lists from heap once persisted into Room + FTS4. */
    fun slimForMemory(): MasterDataSnapshot =
        if (categories.isEmpty() && products.isEmpty()) {
            this
        } else {
            copy(categories = emptyList(), products = emptyList())
        }
}

sealed interface MasterDataSyncResult {
    data class Success(
        val snapshot: MasterDataSnapshot,
        val serverMessage: String?,
    ) : MasterDataSyncResult

    data class Rejected(
        val httpCode: Int,
        val serverMessage: String?,
    ) : MasterDataSyncResult

    data object Unreachable : MasterDataSyncResult
}

/** Downloads outlet master data via `GET /v1/pos/sync/master-data` using the bound device JWT. */
suspend fun fetchMasterData(
    baseUrl: String,
    deviceToken: String,
): MasterDataSyncResult =
    withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null
        try {
            val conn =
                (URL("$baseUrl/v1/pos/sync/master-data").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 10000
                    readTimeout = 15000
                    setRequestProperty("Accept", "application/json")
                    setRequestProperty("Authorization", "Bearer $deviceToken")
                }
            connection = conn

            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val rawBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val root = parseObjectOrNull(rawBody)
            val message = root?.optString("message")?.takeIf { it.isNotBlank() }

            if (code in 200..299) {
                val dataObj = root?.optJSONObject("data")
                val snapshot = dataObj?.let { parseMasterDataObject(it, System.currentTimeMillis()) }
                if (snapshot != null) {
                    MasterDataSyncResult.Success(snapshot = snapshot, serverMessage = message)
                } else {
                    MasterDataSyncResult.Rejected(httpCode = code, serverMessage = message)
                }
            } else {
                MasterDataSyncResult.Rejected(httpCode = code, serverMessage = message)
            }
        } catch (_: IOException) {
            MasterDataSyncResult.Unreachable
        } finally {
            connection?.disconnect()
        }
    }

private fun parseMasterDataObject(
    dataObj: JSONObject,
    syncedAtEpochMs: Long,
): MasterDataSnapshot {
    val staffs = buildStaffList(dataObj.optJSONArray("staffs"))
    val categories = buildCategoryList(dataObj.optJSONArray("categories"))
    val products = buildProductList(dataObj.optJSONArray("products"))
    val configObj = dataObj.optJSONObject("config")
    val config =
        PosSyncConfig(
            masterDataMaxAgeMinutes = configObj?.optInt("master_data_max_age_minutes", 720) ?: 720,
            requireSupervisorForVoid = configObj?.optBoolean("require_supervisor_for_void", true) ?: true,
            requireSupervisorForReturn = configObj?.optBoolean("require_supervisor_for_return", true) ?: true,
            blindCloseEnabled = configObj?.optBoolean("blind_close_enabled", true) ?: true,
        )

    return MasterDataSnapshot(
        version = dataObj.optLong("version", 0L),
        staffs = staffs,
        categories = categories,
        products = products,
        categoryCount = categories.size,
        productCount = products.size,
        config = config,
        syncedAtEpochMs = syncedAtEpochMs,
    )
}

private fun buildStaffList(array: JSONArray?): List<PosStaffMember> {
    if (array == null || array.length() == 0) return emptyList()
    val result = ArrayList<PosStaffMember>(array.length())
    for (i in 0 until array.length()) {
        val item = array.optJSONObject(i) ?: continue
        val id = item.optString("id")
        val name = item.optString("name")
        if (id.isBlank() || name.isBlank()) continue
        result.add(
            PosStaffMember(
                id = id,
                staffIdentifier = item.optString("staff_identifier"),
                name = name,
                pinHash = item.optString("pin_hash"),
                role = item.optString("role", "CASHIER").ifBlank { "CASHIER" },
                permissions = buildStringList(item.optJSONArray("permissions")),
            ),
        )
    }
    return result
}

private fun buildCategoryList(array: JSONArray?): List<PosMasterCategory> {
    if (array == null || array.length() == 0) return emptyList()
    val result = ArrayList<PosMasterCategory>(array.length())
    for (i in 0 until array.length()) {
        val item = array.optJSONObject(i) ?: continue
        val id = item.optString("id")
        val name = item.optString("name")
        if (id.isBlank() || name.isBlank()) continue
        result.add(
            PosMasterCategory(
                id = id,
                name = name,
                description = item.optString("description"),
            ),
        )
    }
    return result
}

private fun buildProductList(array: JSONArray?): List<PosMasterProduct> {
    if (array == null || array.length() == 0) return emptyList()
    val result = ArrayList<PosMasterProduct>(array.length())
    for (i in 0 until array.length()) {
        val item = array.optJSONObject(i) ?: continue
        val id = item.optString("id")
        val name = item.optString("name")
        if (id.isBlank() || name.isBlank()) continue
        val rawPrice = item.optDouble("price", 0.0)
        val priceRupiah = if (rawPrice.isFinite() && rawPrice > 0.0) rawPrice.roundToLong() else 0L
        val sku = item.optString("sku").takeIf { it.isNotBlank() && !item.isNull("sku") }
        val categoryId = item.optString("category_id").takeIf { it.isNotBlank() && !item.isNull("category_id") }
        result.add(
            PosMasterProduct(
                id = id,
                name = name,
                sku = sku,
                priceRupiah = priceRupiah,
                imageUrl = item.optString("image_url"),
                categoryId = categoryId,
            ),
        )
    }
    return result
}

private fun buildStringList(array: JSONArray?): List<String> {
    if (array == null || array.length() == 0) return emptyList()
    val list = ArrayList<String>(array.length())
    for (i in 0 until array.length()) {
        val value = array.optString(i)
        if (value.isNotBlank()) list.add(value)
    }
    return list
}

private fun parseObjectOrNull(raw: String): JSONObject? =
    if (raw.isBlank()) {
        null
    } else {
        try {
            JSONObject(raw)
        } catch (_: JSONException) {
            null
        }
    }
