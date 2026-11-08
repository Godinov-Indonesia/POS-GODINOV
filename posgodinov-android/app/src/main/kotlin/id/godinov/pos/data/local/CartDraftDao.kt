package id.godinov.pos.data.local

import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Relation
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

object CartDraftStatus {
    const val ACTIVE = "ACTIVE"
    const val HELD = "HELD"
}

@Entity(
    tableName = "cart_drafts",
    indices = [Index(value = ["status", "updated_at_ms"])],
)
data class CartDraftEntity(
    @PrimaryKey
    @ColumnInfo(name = "draft_id")
    val draftId: String,
    @ColumnInfo(name = "staff_id")
    val staffId: String,
    @ColumnInfo(name = "hold_label")
    val holdLabel: String,
    @ColumnInfo(name = "status")
    val status: String,
    @ColumnInfo(name = "updated_at_ms")
    val updatedAtEpochMs: Long,
)

@Entity(
    tableName = "cart_draft_items",
    primaryKeys = ["draft_id", "product_id"],
    foreignKeys = [
        ForeignKey(
            entity = CartDraftEntity::class,
            parentColumns = ["draft_id"],
            childColumns = ["draft_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index(value = ["draft_id"])],
)
data class CartDraftItemEntity(
    @ColumnInfo(name = "draft_id")
    val draftId: String,
    @ColumnInfo(name = "product_id")
    val productId: String,
    @ColumnInfo(name = "product_name")
    val productName: String,
    @ColumnInfo(name = "sku")
    val sku: String?,
    @ColumnInfo(name = "unit_price_rupiah")
    val unitPriceRupiah: Long,
    @ColumnInfo(name = "quantity")
    val quantity: Int,
    @ColumnInfo(name = "note")
    val note: String,
)

data class CartDraftWithItems(
    @Embedded
    val draft: CartDraftEntity,
    @Relation(
        parentColumn = "draft_id",
        entityColumn = "draft_id",
    )
    val items: List<CartDraftItemEntity>,
)

@Dao
interface CartDraftDao {
    @Transaction
    @Query("SELECT * FROM cart_drafts WHERE status = :activeStatus ORDER BY updated_at_ms DESC LIMIT 1")
    suspend fun getActiveDraft(activeStatus: String = CartDraftStatus.ACTIVE): CartDraftWithItems?

    @Transaction
    @Query("SELECT * FROM cart_drafts WHERE draft_id = :draftId LIMIT 1")
    suspend fun getDraftById(draftId: String): CartDraftWithItems?

    @Transaction
    @Query("SELECT * FROM cart_drafts WHERE status = :heldStatus ORDER BY updated_at_ms DESC")
    fun observeHeldDrafts(heldStatus: String = CartDraftStatus.HELD): Flow<List<CartDraftWithItems>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDraft(draft: CartDraftEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItems(items: List<CartDraftItemEntity>)

    @Query("DELETE FROM cart_draft_items WHERE draft_id = :draftId")
    suspend fun deleteItemsForDraft(draftId: String)

    @Query("DELETE FROM cart_drafts WHERE draft_id = :draftId")
    suspend fun deleteDraft(draftId: String)

    @Transaction
    suspend fun saveDraftSnapshot(
        draft: CartDraftEntity,
        items: List<CartDraftItemEntity>,
    ) {
        if (items.isEmpty()) {
            deleteDraft(draft.draftId)
            return
        }
        upsertDraft(draft)
        deleteItemsForDraft(draft.draftId)
        insertItems(items)
    }
}
