package com.viso.deck

import java.util.concurrent.CancellationException
import kotlin.coroutines.Continuation
import kotlin.coroutines.EmptyCoroutineContext
import kotlin.coroutines.startCoroutine
import org.junit.Assert.*
import org.junit.Test

class GoogleHomeDiscoveryPolicyTest {
    private fun <T> immediate(block: suspend () -> T): T {
        var outcome: Result<T>? = null
        block.startCoroutine(object : Continuation<T> {
            override val context = EmptyCoroutineContext
            override fun resumeWith(result: Result<T>) { outcome = result }
        })
        return requireNotNull(outcome).getOrThrow()
    }

    @Test fun failedProviderRefreshStillAllowsReadingAuthorizedDevices() {
        var listed = false
        immediate {
            assertFalse(GoogleHomeDiscoveryPolicy.refreshIfAvailable { throw IllegalStateException("provider unavailable") })
            listed = true
        }
        assertTrue(listed)
    }

    @Test fun cancellationStopsBeforeAnyFurtherDeviceRead() {
        var listed = false
        assertThrows(CancellationException::class.java) {
            immediate {
                GoogleHomeDiscoveryPolicy.refreshIfAvailable { throw CancellationException("account changed") }
                listed = true
            }
        }
        assertFalse(listed)
    }

    @Test fun successfulRefreshRunsOnlyOnce() {
        var calls = 0
        assertTrue(immediate { GoogleHomeDiscoveryPolicy.refreshIfAvailable { calls++ } })
        assertEquals(1, calls)
    }
}
