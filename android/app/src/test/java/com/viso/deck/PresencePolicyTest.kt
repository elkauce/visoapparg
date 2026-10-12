package com.viso.deck

import org.junit.Assert.*
import org.junit.Test

class PresencePolicyTest {
    private fun meeting(text: String = "", allBusy: Boolean = false, now: Long = 1500,
        begin: Long = 1000, end: Long = 2000, allDay: Boolean = false,
        cancelled: Boolean = false, free: Boolean = false, declined: Boolean = false) =
        PresencePolicy.isScheduledMeeting(now, begin, end, allDay, cancelled, free, declined, text, allBusy)

    @Test fun recognizesMeetZoomAndMeetingWordsWithoutUploadingTheirContents() {
        assertTrue(meeting("https://meet.google.com/abc-defg-hij"))
        assertTrue(meeting("https://company.zoom.us/j/123"))
        assertTrue(meeting("Reunión del equipo"))
        assertTrue(meeting("Project MEETING"))
        assertFalse(meeting("Compra de comida"))
        assertTrue(meeting("Compra de comida", allBusy = true))
    }
    @Test fun onlyActiveTimedAcceptedBusyInstancesCount() {
        assertFalse(meeting("Meeting", now = 999))
        assertTrue(meeting("Meeting", now = 1000))
        assertFalse(meeting("Meeting", now = 2000))
        assertFalse(meeting("Meeting", begin = 2000, end = 1000))
        assertFalse(meeting("Meeting", allDay = true, allBusy = true))
        assertFalse(meeting("Meeting", cancelled = true, allBusy = true))
        assertFalse(meeting("Meeting", free = true, allBusy = true))
        assertFalse(meeting("Meeting", declined = true, allBusy = true))
    }
}
