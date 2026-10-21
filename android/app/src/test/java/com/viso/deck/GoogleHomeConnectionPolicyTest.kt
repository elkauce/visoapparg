package com.viso.deck

import org.junit.Assert.*
import org.junit.Test

class GoogleHomeConnectionPolicyTest {
    private val granted = GoogleHomeConnectionPolicy.Permission.GRANTED
    private val denied = GoogleHomeConnectionPolicy.Permission.NOT_GRANTED
    private val unknown = GoogleHomeConnectionPolicy.Permission.UNKNOWN

    @Test fun aTransientPermissionOrHouseLookupFailureDoesNotRequestNewConsent() {
        for (result in listOf(
            GoogleHomeConnectionPolicy.verify(true, unknown, null),
            GoogleHomeConnectionPolicy.verify(true, granted, null)
        )) {
            assertFalse(result.authorized)
            assertTrue(result.verificationPending)
            assertFalse(result.requiresAuthorization)
        }
    }

    @Test fun onlyAnExplicitMissingGrantOrConfirmedEmptyHouseSetRequestsConsent() {
        for (result in listOf(
            GoogleHomeConnectionPolicy.verify(true, denied, null),
            GoogleHomeConnectionPolicy.verify(true, granted, 0)
        )) {
            assertFalse(result.authorized)
            assertFalse(result.verificationPending)
            assertTrue(result.requiresAuthorization)
        }
    }

    @Test fun aLiveGrantAndHouseAreRequiredBeforeReportingConnected() {
        val connected = GoogleHomeConnectionPolicy.verify(true, granted, 1)
        assertTrue(connected.authorized)
        assertFalse(connected.verificationPending)
        assertFalse(connected.requiresAuthorization)
        val unavailable = GoogleHomeConnectionPolicy.verify(false, granted, 1)
        assertFalse(unavailable.authorized)
        assertFalse(unavailable.verificationPending)
        assertFalse(unavailable.requiresAuthorization)
    }

    @Test fun incompleteDiscoveryCannotTurnExistingChoicesIntoNewUnverifiedSelections() {
        val previouslyChosen = listOf("desk-offline", "monitor")
        assertEquals(emptyList<String>(), GoogleHomeConnectionPolicy.newSelections(previouslyChosen, previouslyChosen))
        assertEquals(listOf("new-light"), GoogleHomeConnectionPolicy.newSelections(previouslyChosen + "new-light", previouslyChosen))
        GoogleHomePolicy.requireAuthorizedSelection(
            GoogleHomeConnectionPolicy.newSelections(previouslyChosen + "new-light", previouslyChosen),
            setOf("new-light")
        )
        assertThrows(IllegalArgumentException::class.java) {
            GoogleHomePolicy.requireAuthorizedSelection(
                GoogleHomeConnectionPolicy.newSelections(previouslyChosen + "not-granted", previouslyChosen),
                setOf("new-light")
            )
        }
        // A user can still explicitly remove all their saved choices.
        assertEquals(emptyList<String>(), GoogleHomeConnectionPolicy.newSelections(emptyList(), previouslyChosen))
    }
}
