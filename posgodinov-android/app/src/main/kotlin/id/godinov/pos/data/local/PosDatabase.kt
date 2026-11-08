package id.godinov.pos.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory

/**
 * Full-database AES-256 encrypted Room store backed by SQLCipher 4 (`SupportOpenHelperFactory`).
 * The 256-bit database key is generated randomly per installation and sealed with `AndroidKeyStore`
 * AES-256-GCM inside [TerminalStorage].
 */
@Database(
    entities = [
        CategoryEntity::class,
        ProductEntity::class,
        ProductFtsEntity::class,
        StaffEntity::class,
        SyncMetaEntity::class,
        OutboxItemEntity::class,
        CartDraftEntity::class,
        CartDraftItemEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class PosDatabase : RoomDatabase() {
    abstract fun catalogDao(): CatalogDao

    abstract fun outboxDao(): OutboxDao

    abstract fun cartDraftDao(): CartDraftDao

    companion object {
        private const val DB_FILE_NAME = "godinov_pos_encrypted.db"

        @Volatile
        private var instance: PosDatabase? = null

        @Volatile
        private var nativeLoaded: Boolean = false

        fun getInstance(context: Context): PosDatabase {
            val existing = instance
            if (existing != null) return existing
            return synchronized(this) {
                val doubleChecked = instance
                if (doubleChecked != null) return@synchronized doubleChecked

                ensureSqlCipherLoaded()
                val appContext = context.applicationContext
                val keyBytes = TerminalStorage(appContext).getOrCreateDatabaseKeySync()
                val factory = SupportOpenHelperFactory(keyBytes)

                Room
                    .databaseBuilder(appContext, PosDatabase::class.java, DB_FILE_NAME)
                    .openHelperFactory(factory)
                    .build()
                    .also { instance = it }
            }
        }

        private fun ensureSqlCipherLoaded() {
            if (!nativeLoaded) {
                System.loadLibrary("sqlcipher")
                nativeLoaded = true
            }
        }
    }
}
