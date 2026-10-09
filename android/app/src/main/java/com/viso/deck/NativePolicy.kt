package com.viso.deck

import java.net.URI

/** Validation kept independent of Android so security rules have meaningful JVM tests. */
internal object NativePolicy {
    private val packagePattern = Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+")
    private val lightPattern = Regex("light\\.[a-z0-9_]+")
    private val colorPattern = Regex("#[a-fA-F0-9]{6}")

    fun safeBrowserUrl(value: String): URI {
        require(value.length in 1..8192 && value.none { it.isWhitespace() || it.code < 32 })
        val uri = URI(value)
        require(uri.scheme?.lowercase() in setOf("https", "http"))
        require(!uri.host.isNullOrBlank() && uri.rawUserInfo == null)
        require(uri.port == -1 || uri.port in 1..65535)
        return uri
    }

    fun homeAssistantBase(value: String): String {
        val uri = safeBrowserUrl(value.trim())
        require(uri.scheme.equals("https", ignoreCase = true))
        require(uri.rawQuery == null && uri.rawFragment == null)
        require(uri.rawPath.isNullOrEmpty() || uri.rawPath == "/")
        return URI("https", null, uri.host, uri.port, null, null, null).toASCIIString()
    }

    fun validPackage(value: String): Boolean =
        value.length in 1..255 && packagePattern.matches(value)

    fun allowedPackage(value: String, allowed: Set<String>): Boolean =
        validPackage(value) && value in allowed

    fun validStorageKey(value: String): Boolean =
        value.length in 1..256 && value.none { it.code < 32 }

    fun validLightId(value: String): Boolean = value.length <= 255 && lightPattern.matches(value)

    fun rgb(value: String): List<Int> {
        require(colorPattern.matches(value))
        return listOf(value.substring(1, 3).toInt(16), value.substring(3, 5).toInt(16), value.substring(5, 7).toInt(16))
    }

    fun brightness(value: Double): Int {
        require(value.isFinite() && value in 0.0..100.0)
        return value.toInt()
    }

    /** Android reports a timestamped position, not a continuously advancing value. */
    fun mediaPosition(position: Long, updatedAt: Long, now: Long, speed: Float,
                      playing: Boolean, duration: Long): Long {
        if (position < 0) return 0 // PLAYBACK_POSITION_UNKNOWN is not an elapsed time.
        val advance = if (playing && speed.isFinite() && updatedAt > 0 && now > updatedAt) {
            (now.toDouble() - updatedAt.toDouble()) * speed.toDouble()
        } else 0.0
        val value = (position.toDouble() + advance).coerceIn(0.0, Long.MAX_VALUE.toDouble()).toLong()
        return if (duration > 0) minOf(value, duration) else value
    }
}
