package id.godinov.pos.data.local

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import id.godinov.pos.BuildConfig
import id.godinov.pos.data.network.OutboxPushResult
import id.godinov.pos.data.network.pushOutboxBatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/**
 * Crash-resilient WorkManager worker that drains encrypted [OutboxItemEntity] batches to
 * `POST /v1/pos/sync` whenever network connectivity is available.
 */
class OutboxSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result =
        withContext(Dispatchers.IO) {
            val storage = TerminalStorage(applicationContext)
            val terminal = storage.loadState().terminal ?: return@withContext Result.success()
            val outboxDao = PosDatabase.getInstance(applicationContext).outboxDao()

            outboxDao.recoverInterruptedSyncing(System.currentTimeMillis())

            var shouldRetryLater = false
            while (true) {
                val batch = outboxDao.getPendingBatch(limit = BATCH_SIZE)
                if (batch.isEmpty()) break

                val batchIds = batch.map { it.id }
                val startedMs = System.currentTimeMillis()
                outboxDao.markSyncing(batchIds, startedMs)

                val bodyJson = buildSyncUpV2Body(batch)
                when (val push = pushOutboxBatch(BuildConfig.API_BASE_URL, terminal.deviceToken, bodyJson)) {
                    is OutboxPushResult.Success -> {
                        val nowMs = System.currentTimeMillis()
                        val failedPairs = HashSet<String>(push.errors.size)
                        val retryableIds = ArrayList<Long>()

                        for (err in push.errors) {
                            val normalizedType = normalizeServerEntityType(err.entity)
                            failedPairs.add("$normalizedType|${err.id}")
                            if (err.retryable) {
                                batch
                                    .firstOrNull { it.entityType == normalizedType && it.entityId == err.id }
                                    ?.let { retryableIds.add(it.id) }
                            } else {
                                outboxDao.markPermanentFailure(
                                    entityType = normalizedType,
                                    entityId = err.id,
                                    errorCode = err.code,
                                    errorMessage = err.message,
                                    nowMs = nowMs,
                                )
                            }
                        }

                        if (retryableIds.isNotEmpty()) {
                            outboxDao.markRetryableFailure(retryableIds, "Menunggu percobaan ulang server.", nowMs)
                            shouldRetryLater = true
                        }

                        val syncedIds =
                            batch
                                .filterNot { failedPairs.contains("${it.entityType}|${it.entityId}") }
                                .map { it.id }
                        if (syncedIds.isNotEmpty()) {
                            outboxDao.deleteByIds(syncedIds)
                        }
                        if (shouldRetryLater) break
                    }

                    is OutboxPushResult.Rejected -> {
                        val nowMs = System.currentTimeMillis()
                        outboxDao.markRetryableFailure(batchIds, push.serverMessage, nowMs)
                        return@withContext if (push.retryable) Result.retry() else Result.failure()
                    }

                    OutboxPushResult.Unreachable -> {
                        outboxDao.markRetryableFailure(batchIds, "Jaringan belum tersedia.", System.currentTimeMillis())
                        return@withContext Result.retry()
                    }
                }
            }

            if (shouldRetryLater) Result.retry() else Result.success()
        }

    private fun buildSyncUpV2Body(batch: List<OutboxItemEntity>): String {
        val shifts = JSONArray()
        val transactions = JSONArray()
        val wastes = JSONArray()
        val returns = JSONArray()
        val voidLogs = JSONArray()
        val securityEvents = JSONArray()
        var maxMasterVersion = 0L

        for (item in batch) {
            if (item.masterDataVersion > maxMasterVersion) {
                maxMasterVersion = item.masterDataVersion
            }
            val parsed = parseJsonPayload(item.payloadJson) ?: continue
            when (item.entityType) {
                OutboxEntityType.SHIFT -> shifts.put(parsed)
                OutboxEntityType.TRANSACTION -> transactions.put(parsed)
                OutboxEntityType.WASTE -> wastes.put(parsed)
                OutboxEntityType.RETURN -> returns.put(parsed)
                OutboxEntityType.VOID_LOG -> voidLogs.put(parsed)
                OutboxEntityType.SECURITY_EVENT -> securityEvents.put(parsed)
            }
        }

        return JSONObject()
            .apply {
                put("shifts", shifts)
                put("transactions", transactions)
                put("wastes", wastes)
                put("returns", returns)
                put("void_logs", voidLogs)
                put("security_events", securityEvents)
                if (maxMasterVersion > 0L) {
                    put("master_data_version", maxMasterVersion)
                }
            }.toString()
    }

    private fun parseJsonPayload(raw: String): JSONObject? =
        try {
            JSONObject(raw)
        } catch (_: JSONException) {
            null
        }

    private fun normalizeServerEntityType(raw: String): String =
        when (raw.trim().uppercase()) {
            "SHIFT", "SHIFTS" -> OutboxEntityType.SHIFT
            "TRANSACTION", "TRANSACTIONS" -> OutboxEntityType.TRANSACTION
            "WASTE", "WASTES" -> OutboxEntityType.WASTE
            "RETURN", "RETURNS" -> OutboxEntityType.RETURN
            "VOID_LOG", "VOID_LOGS" -> OutboxEntityType.VOID_LOG
            "SECURITY_EVENT", "SECURITY_EVENTS" -> OutboxEntityType.SECURITY_EVENT
            else -> raw.trim().uppercase()
        }

    companion object {
        private const val BATCH_SIZE = 50
        private const val UNIQUE_ONE_TIME_WORK = "godinov_pos_outbox_immediate_sync"
        private const val UNIQUE_PERIODIC_WORK = "godinov_pos_outbox_periodic_sync"

        private fun connectedConstraints(): Constraints =
            Constraints
                .Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

        /** Writes an entity into encrypted Room first, then triggers connected WorkManager sync. */
        suspend fun enqueueAndSchedule(
            context: Context,
            entityType: String,
            entityId: String,
            payloadJson: String,
            masterDataVersion: Long,
        ) {
            val nowMs = System.currentTimeMillis()
            withContext(Dispatchers.IO) {
                PosDatabase
                    .getInstance(context)
                    .outboxDao()
                    .enqueue(
                        OutboxItemEntity(
                            entityType = entityType,
                            entityId = entityId,
                            payloadJson = payloadJson,
                            masterDataVersion = masterDataVersion,
                            createdAtEpochMs = nowMs,
                            updatedAtEpochMs = nowMs,
                        ),
                    )
            }
            triggerImmediateSync(context)
        }

        fun triggerImmediateSync(context: Context) {
            val request =
                OneTimeWorkRequestBuilder<OutboxSyncWorker>()
                    .setConstraints(connectedConstraints())
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15L, TimeUnit.SECONDS)
                    .build()
            WorkManager
                .getInstance(context.applicationContext)
                .enqueueUniqueWork(UNIQUE_ONE_TIME_WORK, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
        }

        fun ensurePeriodicSyncScheduled(context: Context) {
            val request =
                PeriodicWorkRequestBuilder<OutboxSyncWorker>(15L, TimeUnit.MINUTES)
                    .setConstraints(connectedConstraints())
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30L, TimeUnit.SECONDS)
                    .build()
            WorkManager
                .getInstance(context.applicationContext)
                .enqueueUniquePeriodicWork(UNIQUE_PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
}
