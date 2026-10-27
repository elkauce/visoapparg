package com.teaviso.app

data class TimbrePushEvent(val callId: String, val kind: String, val expiresAt: Long)

/** Data-only pushes contain routing ids, never address, SDP, media or capability. */
object TimbrePushPolicy {
    private val idPattern = Regex("^[A-Za-z0-9_-]{8,160}$")
    fun event(data: Map<String, String>, ownerId: String?, enabled: Boolean, now: Long): TimbrePushEvent? {
        if (!enabled || ownerId.isNullOrBlank() || data["type"] != "timbre_call" || data["ownerId"] != ownerId) return null
        val callId = data["callId"] ?: return null
        if (!idPattern.matches(callId)) return null
        val kind = data["kind"] ?: return null
        if (kind != "incoming" && kind != "cancel") return null
        val expiresAt = data["expiresAt"]?.toLongOrNull() ?: return null
        if (expiresAt <= now || expiresAt - now > 5 * 60_000) return null
        return TimbrePushEvent(callId, kind, expiresAt)
    }
}
