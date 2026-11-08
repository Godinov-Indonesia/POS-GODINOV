package id.godinov.pos.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Fts4
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,
    @ColumnInfo(name = "name")
    val name: String,
    @ColumnInfo(name = "description")
    val description: String,
)

@Entity(
    tableName = "products",
    indices = [
        Index(value = ["sku"]),
        Index(value = ["category_id"]),
    ],
)
data class ProductEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,
    @ColumnInfo(name = "name")
    val name: String,
    @ColumnInfo(name = "sku")
    val sku: String?,
    @ColumnInfo(name = "price_rupiah")
    val priceRupiah: Long,
    @ColumnInfo(name = "image_url")
    val imageUrl: String,
    @ColumnInfo(name = "category_id")
    val categoryId: String?,
)

/** Full-text search index synced automatically by Room triggers on [ProductEntity]. */
@Fts4(contentEntity = ProductEntity::class)
@Entity(tableName = "products_fts")
data class ProductFtsEntity(
    @ColumnInfo(name = "name")
    val name: String,
    @ColumnInfo(name = "sku")
    val sku: String?,
)

@Entity(tableName = "staffs")
data class StaffEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,
    @ColumnInfo(name = "staff_identifier")
    val staffIdentifier: String,
    @ColumnInfo(name = "name")
    val name: String,
    @ColumnInfo(name = "pin_hash")
    val pinHash: String,
    @ColumnInfo(name = "role")
    val role: String,
    @ColumnInfo(name = "permissions_csv")
    val permissionsCsv: String,
)

@Entity(tableName = "sync_meta")
data class SyncMetaEntity(
    @PrimaryKey
    @ColumnInfo(name = "singleton_id")
    val singletonId: Int = 1,
    @ColumnInfo(name = "version")
    val version: Long,
    @ColumnInfo(name = "synced_at_ms")
    val syncedAtEpochMs: Long,
    @ColumnInfo(name = "master_data_max_age_minutes")
    val masterDataMaxAgeMinutes: Int,
    @ColumnInfo(name = "require_supervisor_for_void")
    val requireSupervisorForVoid: Boolean,
    @ColumnInfo(name = "require_supervisor_for_return")
    val requireSupervisorForReturn: Boolean,
    @ColumnInfo(name = "blind_close_enabled")
    val blindCloseEnabled: Boolean,
)
