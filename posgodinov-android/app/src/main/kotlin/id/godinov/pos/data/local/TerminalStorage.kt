package id.godinov.pos.data.local

import android.annotation.SuppressLint
import android.content.Context
import id.godinov.pos.data.crypto.AppStorageCipher
import id.godinov.pos.data.network.MasterDataSnapshot
import id.godinov.pos.data.network.PosStaffMember
import id.godinov.pos.data.network.PosSyncConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class BoundTerminal(
    val deviceToken: String,
    val serialBusiness: String,
    val serialOutlet: String,
)

data class ActiveShiftSession(
    val staffId: String,
    val staffName: String,
    val staffRole: String,
    val openingCashRupiah: Long,
    val openedAtEpochMs: Long,
)

data class StoredTerminalState(
    val isKeyActivated: Boolean,
    val terminal: BoundTerminal?,
    val isWelcomeCompleted: Boolean,
    val masterData: MasterDataSnapshot?,
    val activeShift: ActiveShiftSession?,
)

/**
 * Persists one-time terminal activation, permanent device binding, shift state, and the wrapped
 * SQLCipher key inside app-private storage (`MODE_PRIVATE`, `allowBackup = false`).
 * Every value is encrypted with `AndroidKeyStore` AES-256-GCM (AAD bound to preference key) and
 * committed synchronously (`commit()`) on [Dispatchers.IO].
 */
@SuppressLint("ApplySharedPref")
class TerminalStorage(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences(ENCRYPTED_PREFS_NAME, Context.MODE_PRIVATE)

    suspend fun loadState(): StoredTerminalState =
        withContext(Dispatchers.IO) {
            migrateLegacyPlaintextIfNeeded()

            val token = readEncryptedString(KEY_DEVICE_TOKEN)?.takeIf { it.isNotBlank() }
            val business = readEncryptedString(KEY_SERIAL_BUSINESS).orEmpty()
            val outlet = readEncryptedString(KEY_SERIAL_OUTLET).orEmpty()
            val terminal =
                if (token != null) {
                    BoundTerminal(deviceToken = token, serialBusiness = business, serialOutlet = outlet)
                } else {
                    null
                }

            val keyActivated = readEncryptedBoolean(KEY_IS_ACTIVATED) || terminal != null
            val welcomeCompleted = readEncryptedBoolean(KEY_WELCOME_COMPLETED)
            val activeShift = readActiveShift()
            val masterData = if (terminal != null) loadMasterSummaryFromRoom() else null

            StoredTerminalState(
                isKeyActivated = keyActivated,
                terminal = terminal,
                isWelcomeCompleted = welcomeCompleted,
                masterData = masterData,
                activeShift = activeShift,
            )
        }

    suspend fun saveKeyActivated() {
        withContext(Dispatchers.IO) {
            prefs
                .edit()
                .putString(KEY_IS_ACTIVATED, AppStorageCipher.encryptString(KEY_IS_ACTIVATED, "1"))
                .putString(
                    KEY_ACTIVATED_AT,
                    AppStorageCipher.encryptString(KEY_ACTIVATED_AT, System.currentTimeMillis().toString()),
                ).commit()
        }
    }

    suspend fun saveBoundTerminal(terminal: BoundTerminal) {
        withContext(Dispatchers.IO) {
            prefs
                .edit()
                .putString(KEY_IS_ACTIVATED, AppStorageCipher.encryptString(KEY_IS_ACTIVATED, "1"))
                .putString(KEY_DEVICE_TOKEN, AppStorageCipher.encryptString(KEY_DEVICE_TOKEN, terminal.deviceToken))
                .putString(
                    KEY_SERIAL_BUSINESS,
                    AppStorageCipher.encryptString(KEY_SERIAL_BUSINESS, terminal.serialBusiness),
                ).putString(
                    KEY_SERIAL_OUTLET,
                    AppStorageCipher.encryptString(KEY_SERIAL_OUTLET, terminal.serialOutlet),
                ).putString(
                    KEY_BOUND_AT,
                    AppStorageCipher.encryptString(KEY_BOUND_AT, System.currentTimeMillis().toString()),
                ).commit()
        }
    }

    suspend fun saveWelcomeCompleted() {
        withContext(Dispatchers.IO) {
            prefs
                .edit()
                .putString(KEY_WELCOME_COMPLETED, AppStorageCipher.encryptString(KEY_WELCOME_COMPLETED, "1"))
                .commit()
        }
    }

    suspend fun saveMasterData(snapshot: MasterDataSnapshot) {
        withContext(Dispatchers.IO) {
            val catalogDao = PosDatabase.getInstance(appContext).catalogDao()
            val categoryEntities =
                snapshot.categories.map {
                    CategoryEntity(id = it.id, name = it.name, description = it.description)
                }
            val productEntities =
                snapshot.products.map {
                    ProductEntity(
                        id = it.id,
                        name = it.name,
                        sku = it.sku,
                        priceRupiah = it.priceRupiah,
                        imageUrl = it.imageUrl,
                        categoryId = it.categoryId,
                    )
                }
            val staffEntities =
                snapshot.staffs.map {
                    StaffEntity(
                        id = it.id,
                        staffIdentifier = it.staffIdentifier,
                        name = it.name,
                        pinHash = it.pinHash,
                        role = it.role,
                        permissionsCsv = it.permissions.joinToString(separator = ","),
                    )
                }
            val meta =
                SyncMetaEntity(
                    version = snapshot.version,
                    syncedAtEpochMs = snapshot.syncedAtEpochMs,
                    masterDataMaxAgeMinutes = snapshot.config.masterDataMaxAgeMinutes,
                    requireSupervisorForVoid = snapshot.config.requireSupervisorForVoid,
                    requireSupervisorForReturn = snapshot.config.requireSupervisorForReturn,
                    blindCloseEnabled = snapshot.config.blindCloseEnabled,
                )
            catalogDao.replaceMasterCatalog(categoryEntities, productEntities, staffEntities, meta)
        }
    }

    suspend fun saveActiveShift(shift: ActiveShiftSession?) {
        withContext(Dispatchers.IO) {
            val editor = prefs.edit()
            if (shift == null) {
                editor
                    .remove(KEY_SHIFT_STAFF_ID)
                    .remove(KEY_SHIFT_STAFF_NAME)
                    .remove(KEY_SHIFT_STAFF_ROLE)
                    .remove(KEY_SHIFT_OPENING_CASH)
                    .remove(KEY_SHIFT_OPENED_AT)
            } else {
                editor
                    .putString(KEY_SHIFT_STAFF_ID, AppStorageCipher.encryptString(KEY_SHIFT_STAFF_ID, shift.staffId))
                    .putString(
                        KEY_SHIFT_STAFF_NAME,
                        AppStorageCipher.encryptString(KEY_SHIFT_STAFF_NAME, shift.staffName),
                    ).putString(
                        KEY_SHIFT_STAFF_ROLE,
                        AppStorageCipher.encryptString(KEY_SHIFT_STAFF_ROLE, shift.staffRole),
                    ).putString(
                        KEY_SHIFT_OPENING_CASH,
                        AppStorageCipher.encryptString(KEY_SHIFT_OPENING_CASH, shift.openingCashRupiah.toString()),
                    ).putString(
                        KEY_SHIFT_OPENED_AT,
                        AppStorageCipher.encryptString(KEY_SHIFT_OPENED_AT, shift.openedAtEpochMs.toString()),
                    )
            }
            editor.commit()
        }
    }

    /** Returns the unwrapped 256-bit SQLCipher key, creating and sealing it on first call. */
    internal fun getOrCreateDatabaseKeySync(): ByteArray =
        synchronized(dbKeyLock) {
            val wrapped = prefs.getString(KEY_DB_WRAPPED_SECRET, null)
            val existing = wrapped?.let { AppStorageCipher.decryptBytes(KEY_DB_WRAPPED_SECRET, it) }
            if (existing != null && existing.size == 32) return@synchronized existing

            val generated = AppStorageCipher.generateRandomKeyBytes(32)
            val sealed = AppStorageCipher.encryptBytes(KEY_DB_WRAPPED_SECRET, generated)
            prefs.edit().putString(KEY_DB_WRAPPED_SECRET, sealed).commit()
            generated
        }

    private suspend fun loadMasterSummaryFromRoom(): MasterDataSnapshot? {
        val catalogDao = PosDatabase.getInstance(appContext).catalogDao()
        val meta = catalogDao.getSyncMeta() ?: return null
        val staffs =
            catalogDao.getAllStaffs().map { row ->
                PosStaffMember(
                    id = row.id,
                    staffIdentifier = row.staffIdentifier,
                    name = row.name,
                    pinHash = row.pinHash,
                    role = row.role,
                    permissions = row.permissionsCsv.split(',').filter { it.isNotBlank() },
                )
            }
        return MasterDataSnapshot(
            version = meta.version,
            staffs = staffs,
            categories = emptyList(),
            products = emptyList(),
            categoryCount = catalogDao.countCategories(),
            productCount = catalogDao.countProducts(),
            config =
                PosSyncConfig(
                    masterDataMaxAgeMinutes = meta.masterDataMaxAgeMinutes,
                    requireSupervisorForVoid = meta.requireSupervisorForVoid,
                    requireSupervisorForReturn = meta.requireSupervisorForReturn,
                    blindCloseEnabled = meta.blindCloseEnabled,
                ),
            syncedAtEpochMs = meta.syncedAtEpochMs,
        )
    }

    private fun readActiveShift(): ActiveShiftSession? {
        val staffId = readEncryptedString(KEY_SHIFT_STAFF_ID)?.takeIf { it.isNotBlank() } ?: return null
        return ActiveShiftSession(
            staffId = staffId,
            staffName = readEncryptedString(KEY_SHIFT_STAFF_NAME).orEmpty(),
            staffRole = readEncryptedString(KEY_SHIFT_STAFF_ROLE).orEmpty(),
            openingCashRupiah = readEncryptedLong(KEY_SHIFT_OPENING_CASH),
            openedAtEpochMs = readEncryptedLong(KEY_SHIFT_OPENED_AT),
        )
    }

    private fun migrateLegacyPlaintextIfNeeded() {
        val legacy = appContext.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
        if (legacy.all.isEmpty()) return

        val editor = prefs.edit()
        if (legacy.getBoolean(KEY_IS_ACTIVATED, false)) {
            editor.putString(KEY_IS_ACTIVATED, AppStorageCipher.encryptString(KEY_IS_ACTIVATED, "1"))
        }
        legacy.getString(KEY_DEVICE_TOKEN, null)?.takeIf { it.isNotBlank() }?.let { token ->
            editor.putString(KEY_DEVICE_TOKEN, AppStorageCipher.encryptString(KEY_DEVICE_TOKEN, token))
            editor.putString(KEY_IS_ACTIVATED, AppStorageCipher.encryptString(KEY_IS_ACTIVATED, "1"))
        }
        legacy.getString(KEY_SERIAL_BUSINESS, null)?.let { biz ->
            editor.putString(KEY_SERIAL_BUSINESS, AppStorageCipher.encryptString(KEY_SERIAL_BUSINESS, biz))
        }
        legacy.getString(KEY_SERIAL_OUTLET, null)?.let { out ->
            editor.putString(KEY_SERIAL_OUTLET, AppStorageCipher.encryptString(KEY_SERIAL_OUTLET, out))
        }
        if (legacy.getBoolean(KEY_WELCOME_COMPLETED, false)) {
            editor.putString(KEY_WELCOME_COMPLETED, AppStorageCipher.encryptString(KEY_WELCOME_COMPLETED, "1"))
        }
        editor.commit()
        legacy.edit().clear().commit()
        appContext.deleteSharedPreferences(LEGACY_PREFS_NAME)
    }

    private fun readEncryptedString(key: String): String? =
        prefs.getString(key, null)?.let { AppStorageCipher.decryptString(key, it) }

    private fun readEncryptedBoolean(key: String): Boolean = readEncryptedString(key) == "1"

    private fun readEncryptedLong(key: String): Long = readEncryptedString(key)?.toLongOrNull() ?: 0L

    private companion object {
        val dbKeyLock = Any()
        const val LEGACY_PREFS_NAME = "godinov_pos_terminal"
        const val ENCRYPTED_PREFS_NAME = "godinov_pos_terminal_v2"
        const val KEY_DB_WRAPPED_SECRET = "db_sqlcipher_key_v1"
        const val KEY_IS_ACTIVATED = "key_activated"
        const val KEY_ACTIVATED_AT = "key_activated_at_ms"
        const val KEY_DEVICE_TOKEN = "device_token"
        const val KEY_SERIAL_BUSINESS = "serial_business"
        const val KEY_SERIAL_OUTLET = "serial_outlet"
        const val KEY_BOUND_AT = "device_bound_at_ms"
        const val KEY_WELCOME_COMPLETED = "welcome_completed"
        const val KEY_SHIFT_STAFF_ID = "shift_staff_id"
        const val KEY_SHIFT_STAFF_NAME = "shift_staff_name"
        const val KEY_SHIFT_STAFF_ROLE = "shift_staff_role"
        const val KEY_SHIFT_OPENING_CASH = "shift_opening_cash"
        const val KEY_SHIFT_OPENED_AT = "shift_opened_at_ms"
    }
}
