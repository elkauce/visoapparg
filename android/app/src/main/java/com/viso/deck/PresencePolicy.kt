package com.viso.deck

import java.text.Normalizer

internal object PresencePolicy {
    fun isScheduledMeeting(now: Long, begin: Long, end: Long, allDay: Boolean, cancelled: Boolean,
        free: Boolean, declined: Boolean, text: String, allBusy: Boolean): Boolean {
        if (begin > now || end <= now || end <= begin || allDay || cancelled || free || declined) return false
        if (allBusy) return true
        val clean = Normalizer.normalize(text.lowercase(java.util.Locale.ROOT), Normalizer.Form.NFD)
            .replace(Regex("\\p{M}"), "")
        return Regex("(?:https?://)?(?:meet\\.google\\.com/|[a-z0-9.-]*zoom\\.us/)|\\b(?:reunion|meeting)\\b").containsMatchIn(clean)
    }
}
