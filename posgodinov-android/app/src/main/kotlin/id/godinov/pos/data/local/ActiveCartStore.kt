package id.godinov.pos.data.local

import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class CartLineItem(
    val productId: String,
    val productName: String,
    val sku: String?,
    val unitPriceRupiah: Long,
    val quantity: Int,
    val note: String = "",
) {
    val lineTotalRupiah: Long
        get() = unitPriceRupiah * quantity
}

data class ActiveCartState(
    val draftId: String = UUID.randomUUID().toString(),
    val staffId: String = "",
    val holdLabel: String = "",
    val items: List<CartLineItem> = emptyList(),
) {
    val totalQuantity: Int
        get() = items.sumOf { it.quantity }

    val subtotalRupiah: Long
        get() = items.sumOf { it.lineTotalRupiah }
}

/**
 * Dual-tier active cart store:
 * 1. In-memory [StateFlow] mutates synchronously on the caller thread for zero-lag UI taps.
 * 2. Debounced background flush writes an encrypted Room `ACTIVE` draft for crash recovery and Hold Order.
 */
class ActiveCartStore(
    private val cartDraftDao: CartDraftDao,
    private val ioScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
) {
    private val _state = MutableStateFlow(ActiveCartState())
    val state: StateFlow<ActiveCartState> = _state.asStateFlow()

    private var flushJob: Job? = null

    fun observeHeldOrders(): Flow<List<CartDraftWithItems>> = cartDraftDao.observeHeldDrafts()

    /** Restores any crash-interrupted `ACTIVE` cart draft from encrypted Room on shift resume. */
    suspend fun restoreActiveDraft(staffId: String) {
        val saved = withContext(Dispatchers.IO) { cartDraftDao.getActiveDraft() }
        if (saved != null && saved.items.isNotEmpty()) {
            _state.value = saved.toInMemoryState(fallbackStaffId = staffId)
        } else {
            _state.update { it.copy(staffId = staffId) }
        }
    }

    /** Instant in-memory add/increment; disk flush happens asynchronously off the UI thread. */
    fun addProduct(
        product: ProductEntity,
        quantityDelta: Int = 1,
    ) {
        if (quantityDelta <= 0) return
        _state.update { current ->
            val index = current.items.indexOfFirst { it.productId == product.id }
            val updatedItems =
                if (index >= 0) {
                    current.items.toMutableList().apply {
                        val existing = this[index]
                        this[index] = existing.copy(quantity = existing.quantity + quantityDelta)
                    }
                } else {
                    current.items +
                        CartLineItem(
                            productId = product.id,
                            productName = product.name,
                            sku = product.sku,
                            unitPriceRupiah = product.priceRupiah,
                            quantity = quantityDelta,
                        )
                }
            current.copy(items = updatedItems)
        }
        scheduleDraftFlush()
    }

    /** Instant in-memory quantity update; removes line when `newQuantity <= 0`. */
    fun setItemQuantity(
        productId: String,
        newQuantity: Int,
    ) {
        _state.update { current ->
            val updatedItems =
                if (newQuantity <= 0) {
                    current.items.filterNot { it.productId == productId }
                } else {
                    current.items.map { item ->
                        if (item.productId == productId) item.copy(quantity = newQuantity) else item
                    }
                }
            current.copy(items = updatedItems)
        }
        scheduleDraftFlush()
    }

    fun updateItemNote(
        productId: String,
        note: String,
    ) {
        _state.update { current ->
            current.copy(
                items =
                    current.items.map { item ->
                        if (item.productId == productId) item.copy(note = note) else item
                    },
            )
        }
        scheduleDraftFlush()
    }

    /** Parks the current non-empty cart as a `HELD` order in Room and opens a fresh active cart. */
    suspend fun holdCurrentOrder(label: String): Boolean {
        flushJob?.cancel()
        val snapshot = _state.value
        if (snapshot.items.isEmpty()) return false
        val safeLabel = label.trim().ifEmpty { "Pesanan Ditahan" }
        withContext(Dispatchers.IO) {
            persistSnapshot(snapshot.copy(holdLabel = safeLabel), status = CartDraftStatus.HELD)
        }
        _state.value = ActiveCartState(staffId = snapshot.staffId)
        return true
    }

    /** Recalls a `HELD` order back into the fast in-memory active cart. */
    suspend fun resumeHeldOrder(draftId: String): Boolean {
        flushJob?.cancel()
        val current = _state.value
        val target = withContext(Dispatchers.IO) { cartDraftDao.getDraftById(draftId) } ?: return false
        withContext(Dispatchers.IO) {
            if (current.items.isNotEmpty() && current.draftId != draftId) {
                val autoLabel = current.holdLabel.ifEmpty { "Pesanan Sebelumnya" }
                persistSnapshot(current.copy(holdLabel = autoLabel), status = CartDraftStatus.HELD)
            }
            val activated = target.draft.copy(status = CartDraftStatus.ACTIVE, updatedAtEpochMs = System.currentTimeMillis())
            cartDraftDao.upsertDraft(activated)
        }
        _state.value = target.toInMemoryState(fallbackStaffId = current.staffId)
        return true
    }

    /** Clears active cart after checkout or explicit void and deletes its Room draft. */
    suspend fun clearActiveCart() {
        flushJob?.cancel()
        val previous = _state.value
        _state.value = ActiveCartState(staffId = previous.staffId)
        withContext(Dispatchers.IO) {
            cartDraftDao.deleteDraft(previous.draftId)
        }
    }

    private fun scheduleDraftFlush() {
        val snapshot = _state.value
        flushJob?.cancel()
        flushJob =
            ioScope.launch {
                delay(DRAFT_FLUSH_DEBOUNCE_MS)
                persistSnapshot(snapshot, status = CartDraftStatus.ACTIVE)
            }
    }

    private suspend fun persistSnapshot(
        snapshot: ActiveCartState,
        status: String,
    ) {
        val draft =
            CartDraftEntity(
                draftId = snapshot.draftId,
                staffId = snapshot.staffId,
                holdLabel = snapshot.holdLabel,
                status = status,
                updatedAtEpochMs = System.currentTimeMillis(),
            )
        val entities =
            snapshot.items.map { item ->
                CartDraftItemEntity(
                    draftId = snapshot.draftId,
                    productId = item.productId,
                    productName = item.productName,
                    sku = item.sku,
                    unitPriceRupiah = item.unitPriceRupiah,
                    quantity = item.quantity,
                    note = item.note,
                )
            }
        cartDraftDao.saveDraftSnapshot(draft, entities)
    }

    private companion object {
        const val DRAFT_FLUSH_DEBOUNCE_MS = 120L
    }
}

private fun CartDraftWithItems.toInMemoryState(fallbackStaffId: String): ActiveCartState =
    ActiveCartState(
        draftId = draft.draftId,
        staffId = draft.staffId.ifBlank { fallbackStaffId },
        holdLabel = draft.holdLabel,
        items =
            items.map { row ->
                CartLineItem(
                    productId = row.productId,
                    productName = row.productName,
                    sku = row.sku,
                    unitPriceRupiah = row.unitPriceRupiah,
                    quantity = row.quantity,
                    note = row.note,
                )
            },
    )
