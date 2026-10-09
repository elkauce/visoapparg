package com.viso.deck

import org.junit.Assert.*
import org.junit.Test

class NativePolicyTest {
    private fun rejects(operation: () -> Unit) {
        try {
            operation()
            fail("Unsafe input was accepted")
        } catch (_: IllegalArgumentException) {
            // Expected policy rejection.
        } catch (_: java.net.URISyntaxException) {
            // Malformed URI rejected before Android can dispatch it.
        }
    }

    @Test fun browserLinksRejectExecutableSchemesCredentialsAndControlCharacters() {
        assertEquals("https", NativePolicy.safeBrowserUrl("https://visoapparg.vercel.app/deck").scheme)
        assertEquals("http", NativePolicy.safeBrowserUrl("http://192.168.1.5:8123/").scheme)
        listOf("javascript:alert(1)", "file:///data/data/com.viso.deck", "intent://launch", "https://user:password@example.com/", "https://example.com/\nnext", "https:///missing-host", "https://example.com:70000/").forEach {
            rejects { NativePolicy.safeBrowserUrl(it) }
        }
    }

    @Test fun homeAssistantRequiresHttpsAndAnUnambiguousOrigin() {
        assertEquals("https://example.com:8123", NativePolicy.homeAssistantBase(" https://example.com:8123/ "))
        listOf("http://example.com", "https://example.com/api/", "https://example.com?token=secret", "https://example.com#fragment", "https://user:password@example.com").forEach {
            rejects { NativePolicy.homeAssistantBase(it) }
        }
    }

    @Test fun appsRequireBothAValidPackageAndUserApproval() {
        val allowed = setOf("com.spotify.music", "com.example.reader")
        assertTrue(NativePolicy.allowedPackage("com.spotify.music", allowed))
        assertFalse(NativePolicy.allowedPackage("com.android.settings", allowed))
        assertFalse(NativePolicy.allowedPackage("com.spotify.music;am start", allowed))
        assertFalse(NativePolicy.allowedPackage("com..spotify.music", allowed))
        assertTrue(NativePolicy.validPackage("com.spotify.music"))
        assertFalse(NativePolicy.validPackage("com.spotify.music\u0000"))
        assertFalse(NativePolicy.validPackage("com." + "a".repeat(252)))
    }

    @Test fun lightActionsRejectPathInjectionInvalidRgbAndUnsafeBrightness() {
        assertTrue(NativePolicy.validLightId("light.office_rgb"))
        assertFalse(NativePolicy.validLightId("light.office/../../services"))
        assertFalse(NativePolicy.validLightId("switch.office"))
        assertEquals(listOf(18, 171, 239), NativePolicy.rgb("#12abef"))
        listOf("red", "#123", "#zz0000", "#ffffff00").forEach { rejects { NativePolicy.rgb(it) } }
        assertEquals(50, NativePolicy.brightness(50.0))
        listOf(-1.0, 100.1, Double.NaN, Double.POSITIVE_INFINITY).forEach { rejects { NativePolicy.brightness(it) } }
    }

    @Test fun authenticationStorageRejectsEmptyAndControlCharacterKeys() {
        assertTrue(NativePolicy.validStorageKey("__convexAuthJWT_viso"))
        assertFalse(NativePolicy.validStorageKey(""))
        assertFalse(NativePolicy.validStorageKey("token\u0000"))
        assertFalse(NativePolicy.validStorageKey("x".repeat(257)))
    }
}
