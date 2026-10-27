package com.teaviso.app

import java.net.URI

internal object TeAvisoPolicy {
    fun browserUrl(value: String, localTest: Boolean = false): URI {
        require(value.length in 1..8192 && value.none { it.isWhitespace() || it.code < 32 })
        val uri = URI(value)
        require(!uri.host.isNullOrBlank() && uri.rawUserInfo == null)
        require(uri.scheme == "https" || (localTest && uri.scheme == "http" && uri.host in setOf("localhost", "127.0.0.1", "10.0.2.2")))
        require(uri.port == -1 || uri.port in 1..65535)
        return uri
    }
    fun authKey(value: String): Boolean = value.length in 1..256 &&
        value.none { it.code < 32 } &&
        (value.startsWith("__convexAuth") || value in setOf("teaviso:native-google-attempt", "teaviso:native-google-callback"))
    fun exportName(value: String, mime: String): Boolean =
        value.length in 1..120 && Regex("[A-Za-z0-9][A-Za-z0-9._-]*").matches(value) && !value.contains("..") &&
        ((mime == "image/png" && value.endsWith(".png")) || (mime == "image/svg+xml" && value.endsWith(".svg")))
}
