package id.godinov.pos.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface CatalogDao {
    @Query("SELECT * FROM categories ORDER BY name ASC")
    fun observeCategories(): Flow<List<CategoryEntity>>

    @Query("SELECT COUNT(*) FROM categories")
    suspend fun countCategories(): Int

    @Query("SELECT COUNT(*) FROM products")
    suspend fun countProducts(): Int

    /** O(log N) barcode / SKU exact match using the `sku` index. */
    @Query("SELECT * FROM products WHERE sku = :barcodeOrSku LIMIT 1")
    suspend fun findByBarcode(barcodeOrSku: String): ProductEntity?

    /** Paginated product slice to keep heap footprint small on large outlet catalogs. */
    @Query(
        """
        SELECT * FROM products
        WHERE (:categoryId IS NULL OR category_id = :categoryId)
        ORDER BY name ASC
        LIMIT :limit OFFSET :offset
        """,
    )
    suspend fun getProductsPage(
        categoryId: String?,
        limit: Int,
        offset: Int,
    ): List<ProductEntity>

    /** Full-text prefix search across product `name` and `sku` via SQLite FTS4 + pagination. */
    @Query(
        """
        SELECT products.* FROM products
        JOIN products_fts ON products.rowid = products_fts.rowid
        WHERE products_fts MATCH :ftsMatchQuery
          AND (:categoryId IS NULL OR products.category_id = :categoryId)
        ORDER BY products.name ASC
        LIMIT :limit OFFSET :offset
        """,
    )
    suspend fun searchProductsFts(
        ftsMatchQuery: String,
        categoryId: String?,
        limit: Int,
        offset: Int,
    ): List<ProductEntity>

    @Query("SELECT * FROM staffs ORDER BY name ASC")
    suspend fun getAllStaffs(): List<StaffEntity>

    @Query("SELECT * FROM sync_meta WHERE singleton_id = 1 LIMIT 1")
    suspend fun getSyncMeta(): SyncMetaEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCategories(categories: List<CategoryEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProducts(products: List<ProductEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStaffs(staffs: List<StaffEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSyncMeta(meta: SyncMetaEntity)

    @Query("DELETE FROM products")
    suspend fun clearProducts()

    @Query("DELETE FROM categories")
    suspend fun clearCategories()

    @Query("DELETE FROM staffs")
    suspend fun clearStaffs()

    @Transaction
    suspend fun replaceMasterCatalog(
        categories: List<CategoryEntity>,
        products: List<ProductEntity>,
        staffs: List<StaffEntity>,
        meta: SyncMetaEntity,
    ) {
        clearProducts()
        clearCategories()
        clearStaffs()
        if (categories.isNotEmpty()) insertCategories(categories)
        if (products.isNotEmpty()) insertProducts(products)
        if (staffs.isNotEmpty()) insertStaffs(staffs)
        upsertSyncMeta(meta)
    }
}

/** Sanitizes user search text into safe FTS4 prefix tokens (for example `"es kopi"` -> `"es* kopi*"`). */
fun buildFtsPrefixQuery(rawQuery: String): String =
    rawQuery
        .trim()
        .split(Regex("\\s+"))
        .map { token -> token.replace(Regex("[^\\p{L}\\p{N}_-]"), "") }
        .filter { it.isNotEmpty() }
        .joinToString(separator = " ") { "$it*" }
