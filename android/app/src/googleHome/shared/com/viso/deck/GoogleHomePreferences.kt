package com.viso.deck

import android.content.Context
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** No Google credentials cross the WebView bridge. Local IDs are scoped to VISO. */
internal class GoogleHomePreferences(context: Context) {
    data class Configuration(val selectedIds: List<String>, val colorsByState: Map<String, String>, val revision: String) {
        val enabled get() = selectedIds.isNotEmpty()
        fun json(): JSObject = JSObject()
            .put("selectedIds", JSArray(selectedIds))
            .put("colorsByState", JSObject(JSONObject(colorsByState).toString()))
            .put("enabled", enabled)
            .put("revision", revision)
    }

    private val vault = SecureVault(context)
    private fun key(account: String) = "integration:google-home:${GoogleHomePolicy.account(account)}"

    @Synchronized fun get(account: String): Configuration {
        val stored = vault.get(key(account)) ?: return Configuration(emptyList(), GoogleHomePolicy.defaultColors, "initial")
        return try {
            val value = JSONObject(stored)
            val ids = value.getJSONArray("selectedIds")
            val colors = value.getJSONObject("colorsByState")
            Configuration(
                GoogleHomePolicy.selected((0 until ids.length()).map { ids.getString(it) }),
                GoogleHomePolicy.colors(GoogleHomePolicy.stateKeys.associateWith { colors.getString(it) }),
                value.getString("revision")
            )
        } catch (_: Exception) {
            // A broken or older preference cannot authorize a device by itself.
            vault.remove(key(account))
            Configuration(emptyList(), GoogleHomePolicy.defaultColors, "initial")
        }
    }

    @Synchronized fun save(account: String, ids: List<String>, colors: Map<String, String>): Configuration {
        val config = Configuration(GoogleHomePolicy.selected(ids), GoogleHomePolicy.colors(colors), UUID.randomUUID().toString())
        val encoded = JSONObject().put("selectedIds", JSONArray(config.selectedIds))
            .put("colorsByState", JSONObject(config.colorsByState)).put("revision", config.revision).toString()
        vault.set(key(account), encoded)
        return config
    }

    @Synchronized fun clearSelection(account: String): Configuration {
        val current = get(account)
        return if (current.selectedIds.isEmpty()) current else save(account, emptyList(), current.colorsByState)
    }
}
