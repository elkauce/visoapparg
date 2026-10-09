package com.viso.deck

import org.junit.Assert.*
import org.junit.Test

class GoogleHomePolicyTest {
    @Test fun commandsFromThePreviousAccountCannotContinueAfterSwitchOrLogout() {
        val scope = GoogleHomeOwnerScope()
        scope.activate("viso-owner-one")
        val old = scope.begin("viso-owner-one")
        assertTrue(scope.isCurrent(old))
        scope.activate("viso-owner-two")
        assertFalse(scope.isCurrent(old))
        val current = scope.begin("viso-owner-two")
        scope.activate(null)
        assertFalse(scope.isCurrent(current))
        assertThrows(IllegalStateException::class.java) { scope.begin("viso-owner-two") }
    }

    @Test fun aNewerStatusOrConfigurationSupersedesQueuedColors() {
        val scope = GoogleHomeOwnerScope()
        scope.activate("viso-owner")
        val earlier = scope.begin("viso-owner")
        val newer = scope.begin("viso-owner")
        assertFalse(scope.isCurrent(earlier))
        assertTrue(scope.isCurrent(newer))
        assertFalse(scope.activate("viso-owner"))
        assertTrue(scope.isCurrent(newer))
        scope.invalidate()
        assertFalse(scope.isCurrent(newer))
    }

    @Test fun selectedLightsMustBeARealAuthorizedColorSubset() {
        GoogleHomePolicy.requireAuthorizedSelection(listOf("selected-rgb"), setOf("selected-rgb", "unselected-rgb"))
        assertThrows(IllegalArgumentException::class.java) {
            GoogleHomePolicy.requireAuthorizedSelection(listOf("white-only"), setOf("selected-rgb", "unselected-rgb"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            GoogleHomePolicy.requireAuthorizedSelection(listOf("revoked-light"), emptySet())
        }
        assertEquals(listOf("a", "b"), GoogleHomePolicy.selected(listOf("b", "a", "b")))
    }

    @Test fun colorPreferencesHaveExactlyTheSixStatusesAndRealHexValues() {
        assertEquals("#00FF00", GoogleHomePolicy.colors(GoogleHomePolicy.defaultColors + ("libre" to "#00ff00"))["libre"])
        assertThrows(IllegalArgumentException::class.java) { GoogleHomePolicy.colors(GoogleHomePolicy.defaultColors - "ausente") }
        assertThrows(IllegalArgumentException::class.java) { GoogleHomePolicy.colors(GoogleHomePolicy.defaultColors + ("inventado" to "#123456")) }
        assertThrows(IllegalArgumentException::class.java) { GoogleHomePolicy.colors(GoogleHomePolicy.defaultColors + ("libre" to "rgb(0,1,2)")) }
    }
}
