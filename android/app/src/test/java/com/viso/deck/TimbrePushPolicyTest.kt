package com.viso.deck

import org.junit.Assert.*
import org.junit.Test

class TimbrePushPolicyTest {
    private val now = 1_000_000L
    private fun message() = mapOf("type" to "timbre_call", "kind" to "incoming", "ownerId" to "owner123",
        "callId" to "call123456", "expiresAt" to (now + 30_000).toString())
    @Test fun routesOnlyToOptedInCurrentOwner() {
        assertNotNull(TimbrePushPolicy.event(message(), "owner123", true, now))
        assertNull(TimbrePushPolicy.event(message(), "other", true, now))
        assertNull(TimbrePushPolicy.event(message(), "owner123", false, now))
        assertNull(TimbrePushPolicy.event(message(), null, true, now))
    }
    @Test fun rejectsExpiredMalformedAndOverlongMessages() {
        assertNull(TimbrePushPolicy.event(message() + ("expiresAt" to now.toString()), "owner123", true, now))
        assertNull(TimbrePushPolicy.event(message() + ("expiresAt" to (now + 600_000).toString()), "owner123", true, now))
        assertNull(TimbrePushPolicy.event(message() + ("callId" to "https://outside.test"), "owner123", true, now))
        assertNull(TimbrePushPolicy.event(message() + ("kind" to "accept"), "owner123", true, now))
        assertEquals("cancel", TimbrePushPolicy.event(message() + ("kind" to "cancel"), "owner123", true, now)?.kind)
    }
}
