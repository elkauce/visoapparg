package com.viso.deck

import java.util.concurrent.CancellationException

/** Linked-provider refresh is optional; device listing and permissions remain mandatory. */
internal object GoogleHomeDiscoveryPolicy {
    suspend fun refreshIfAvailable(refresh: suspend () -> Unit): Boolean {
        return try { refresh(); true }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { false }
    }
}
