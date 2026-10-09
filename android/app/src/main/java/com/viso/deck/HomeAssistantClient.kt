package com.viso.deck

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject
import java.net.URL
import javax.net.ssl.HttpsURLConnection

internal class HomeAssistantClient(private val vault: SecureVault) {
    @Volatile private var verifiedAt = 0L
    @Volatile private var verificationFailed = false
    @Volatile private var lastMessage = "Configurá una instancia HTTPS y un token desde Android."

    private fun configuration(): JSONObject? = vault.get("integration:ha:configuration")?.let { JSONObject(it) }
    private fun endpoint() = configuration()?.optString("url")?.takeIf { it.isNotBlank() }
    private fun token() = configuration()?.optString("token")?.takeIf { it.isNotBlank() }
    fun configured(): Boolean = !endpoint().isNullOrBlank() && !token().isNullOrBlank()

    fun status(): JSObject {
        val hasConfiguration = configured()
        val recentVerification = verifiedAt != 0L && System.currentTimeMillis() - verifiedAt < 60_000L
        return JSObject().put("configured", hasConfiguration)
            .put("status", if (!hasConfiguration || verificationFailed) "disconnected" else if (recentVerification) "connected" else "pending")
            .put("message", if (hasConfiguration && !recentVerification && !verificationFailed) "Configurado; conexión pendiente de verificar." else lastMessage)
    }

    fun verify(): JSObject {
        if (!configured()) return status()
        try {
            request("GET", "/api/")
            verifiedAt = System.currentTimeMillis()
            verificationFailed = false
            lastMessage = "Conexión HTTPS y autorización verificadas con Home Assistant."
        } catch (error: Exception) {
            verifiedAt = 0L
            verificationFailed = true
            lastMessage = "No se pudo verificar Home Assistant. Revisá red, certificado HTTPS y autorización."
            return JSObject().put("configured", true).put("status", "disconnected").put("message", lastMessage)
        }
        return status()
    }

    fun configure(url: String, credential: String): JSObject {
        val base = NativePolicy.homeAssistantBase(url)
        require(credential.length in 1..16384 && credential.none { it.code < 32 })
        request("GET", "/api/", baseOverride = base, tokenOverride = credential)
        // One encrypted entry commits endpoint + credential atomically. A failed save cannot
        // accidentally pair a previous token with a newly configured host.
        vault.set("integration:ha:configuration", JSONObject().put("url", base).put("token", credential).toString())
        verifiedAt = System.currentTimeMillis()
        verificationFailed = false
        lastMessage = "Conexión HTTPS y autorización verificadas con Home Assistant."
        return status()
    }

    fun disconnect() {
        vault.remove("integration:ha:configuration")
        verifiedAt = 0L
        verificationFailed = false
        lastMessage = "Home Assistant desconectado."
    }

    fun discoverLights(): JSArray {
        val states = JSONArray(request("GET", "/api/states"))
        val lights = JSArray()
        for (index in 0 until states.length()) {
            val state = states.getJSONObject(index)
            val id = state.optString("entity_id")
            if (!NativePolicy.validLightId(id)) continue
            val attributes = state.optJSONObject("attributes") ?: JSONObject()
            val value = JSObject().put("id", id)
                .put("name", attributes.optString("friendly_name", id))
                .put("on", state.optString("state") == "on")
                .put("available", state.optString("state") !in listOf("unavailable", "unknown"))
                .put("supportsColor", supportsColor(attributes))
            if (attributes.has("brightness")) value.put("brightness", attributes.optDouble("brightness") / 255.0 * 100.0)
            lights.put(value)
        }
        verifiedAt = System.currentTimeMillis()
        verificationFailed = false
        lastMessage = "Dispositivos reales descubiertos mediante Home Assistant."
        return lights
    }

    fun controlLight(entityId: String, on: Boolean?, brightness: Double?, color: String?): JSObject {
        require(NativePolicy.validLightId(entityId))
        require(on != null || brightness != null || color != null)
        require(on != false || (brightness == null && color == null))
        val state = JSONObject(request("GET", "/api/states/$entityId"))
        require(state.optString("state") !in listOf("unknown", "unavailable"))
        val attributes = state.optJSONObject("attributes") ?: JSONObject()
        val payload = JSONObject().put("entity_id", entityId)
        if (brightness != null) {
            val modes = attributes.optJSONArray("supported_color_modes")
            require(modes != null && (0 until modes.length()).any { modes.optString(it) !in listOf("onoff", "unknown") })
            payload.put("brightness_pct", NativePolicy.brightness(brightness))
        }
        if (color != null) {
            require(supportsColor(attributes))
            payload.put("rgb_color", JSONArray(NativePolicy.rgb(color)))
        }
        request("POST", if (on == false) "/api/services/light/turn_off" else "/api/services/light/turn_on", payload)
        // Home Assistant confirms the service call. The returned state is the server's report,
        // not a locally simulated success or a guarantee about unavailable physical hardware.
        val reported = JSONObject(request("GET", "/api/states/$entityId"))
        verifiedAt = System.currentTimeMillis()
        verificationFailed = false
        lastMessage = "Home Assistant confirmó la operación."
        return JSObject().put("success", true).put("state", reported.optString("state", "unknown"))
    }

    private fun supportsColor(attributes: JSONObject): Boolean {
        val modes = attributes.optJSONArray("supported_color_modes") ?: return false
        return (0 until modes.length()).any { modes.optString(it) in listOf("rgb", "rgbw", "rgbww", "xy", "hs") }
    }

    private fun request(
        method: String,
        path: String,
        payload: JSONObject? = null,
        baseOverride: String? = null,
        tokenOverride: String? = null
    ): String {
        val base = baseOverride ?: endpoint() ?: error("Home Assistant no configurado.")
        val credential = tokenOverride ?: token() ?: error("Home Assistant no autorizado.")
        val connection = URL(base + path).openConnection() as HttpsURLConnection
        connection.instanceFollowRedirects = false // Never forward a bearer token to another host.
        connection.connectTimeout = 10_000
        connection.readTimeout = 10_000
        connection.requestMethod = method
        connection.setRequestProperty("Authorization", "Bearer $credential")
        connection.setRequestProperty("Accept", "application/json")
        try {
            if (payload != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(payload.toString()) }
            }
            check(connection.responseCode in 200..299) { "Home Assistant rechazó la operación." }
            // Bound device discovery to avoid loading unbounded responses into the WebView.
            val result = connection.inputStream.bufferedReader(Charsets.UTF_8).use { reader ->
                val output = StringBuilder()
                val buffer = CharArray(8192)
                while (true) {
                    val count = reader.read(buffer)
                    if (count < 0) break
                    check(output.length + count <= 4 * 1024 * 1024)
                    output.append(buffer, 0, count)
                }
                output.toString()
            }
            return result
        } catch (error: Exception) {
            if (baseOverride == null) {
                verifiedAt = 0L
                verificationFailed = true
                lastMessage = "Home Assistant no pudo confirmar la conexión u operación. Revisá red y autorización."
            }
            throw error
        } finally {
            connection.disconnect()
        }
    }
}
