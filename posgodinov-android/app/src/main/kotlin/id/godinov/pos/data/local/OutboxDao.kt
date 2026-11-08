package id.godinov.pos.data.local

import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

object OutboxEntityType {
    const val SHIFT = "SHIFT"
    const val TRANSACTION = "TRANSACTION"
    const val WASTE = "WASTE"
    const val RETURN = "RETURN"
    const val VOID_LOG = "VOID_LOG"
    const val SECURITY_EVENT = "SECURITY_EVENT"
}

object OutboxStatus {
    const val PENDING = "PENDING"
    const val SYNCING = "SYNCING"
    const val FAILED_PERMANENT = "FAILED_PERMANENT"
}

@Entity(
    tableName = "outbox_queue",
    indices = [
        Index(value = ["status", "created_at_ms"]),
        Index(value = ["entity_type", "entity_id"], unique = true),
    ],
)
data class OutboxItemEntity(
    @PrimaryKey(autoGenerate = true)
    @ColumnInfo(name = "id")
    val id: Long = 0L,
    @ColumnInfo(name = "entity_type")
    val entityType: String,
    @ColumnInfo(name = "entity_id")
    val entityId: String,
    @ColumnInfo(name = "payload_json")
    val payloadJson: String,
    @ColumnInfo(name = "master_data_version")
    val masterDataVersion: Long,
    @ColumnInfo(name = "status")
    val status: String = OutboxStatus.PENDING,
    @ColumnInfo(name = "attempt_count")
    val attemptCount: Int = 0,
    @ColumnInfo(name = "last_error_code")
    val lastErrorCode: String? = null,
    @ColumnInfo(name = "last_error_message")
    val lastErrorMessage: String? = null,
    @ColumnInfo(name = "created_at_ms")
    val createdAtEpochMs: Long,
    @ColumnInfo(name = "updated_at_ms")
    val updatedAtEpochMs: Long,
)

@Dao
interface OutboxDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun enqueue(item: OutboxItemEntity): Long

    @Query("SELECT COUNT(*) FROM outbox_queue WHERE status != :excludedStatus")
    fun observeUnsyncedCount(excludedStatus: String = OutboxStatus.FAILED_PERMANENT): Flow<Int>

    @Query(
        """
        UPDATE outbox_queue
        SET status = :pendingStatus, updated_at_ms = :nowMs
        WHERE status = :syncingStatus
        """,
    )
    suspend fun recoverInterruptedSyncing(
        nowMs: Long,
        syncingStatus: String = OutboxStatus.SYNCING,
        pendingStatus: String = OutboxStatus.PENDING,
    )

    @Query(
        """
        SELECT * FROM outbox_queue
        WHERE status = :pendingStatus
        ORDER BY created_at_ms ASC
        LIMIT :limit
        """,
    )
    suspend fun getPendingBatch(
        limit: Int,
        pendingStatus: String = OutboxStatus.PENDING,
    ): List<OutboxItemEntity>

    @Query("UPDATE outbox_queue SET status = :syncingStatus, updated_at_ms = :nowMs WHERE id IN (:ids)")
    suspend fun markSyncing(
        ids: List<Long>,
        nowMs: Long,
        syncingStatus: String = OutboxStatus.SYNCING,
    )

    @Query("DELETE FROM outbox_queue WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<Long>)

    @Query(
        """
        UPDATE outbox_queue
        SET status = :pendingStatus,
            attempt_count = attempt_count + 1,
            last_error_message = :errorMessage,
            updated_at_ms = :nowMs
        WHERE id IN (:ids)
        """,
    )
    suspend fun markRetryableFailure(
        ids: List<Long>,
        errorMessage: String?,
        nowMs: Long,
        pendingStatus: String = OutboxStatus.PENDING,
    )

    @Query(
        """
        UPDATE outbox_queue
        SET status = :failedStatus,
            attempt_count = attempt_count + 1,
            last_error_code = :errorCode,
            last_error_message = :errorMessage,
            updated_at_ms = :nowMs
        WHERE entity_type = :entityType AND entity_id = :entityId
        """,
    )
    suspend fun markPermanentFailure(
        entityType: String,
        entityId: String,
        errorCode: String,
        errorMessage: String,
        nowMs: Long,
        failedStatus: String = OutboxStatus.FAILED_PERMANENT,
    )
}
