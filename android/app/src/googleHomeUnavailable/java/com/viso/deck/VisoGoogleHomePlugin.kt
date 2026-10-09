package com.viso.deck

import android.os.Build
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/** CI/general build without the separately supplied official SDK: never fake it. */
@CapacitorPlugin(name = "VisoGoogleHome")
class VisoGoogleHomePlugin : Plugin() {
    private val owner = GoogleHomeOwnerScope()
    private lateinit var preferences: GoogleHomePreferences
    override fun load() { preferences = GoogleHomePreferences(context) }
    private fun account(call: PluginCall) = GoogleHomePolicy.account(call.getString("accountId"))
    private fun local(call: PluginCall, action: (String) -> JSObject) {
        try { call.resolve(action(account(call))) }
        catch (_: Exception) { call.reject("La configuración o sesión VISO no es válida.", "GOOGLE_HOME_INVALID_CONFIGURATION") }
    }
    private fun status(account: String): JSObject = JSObject()
        .put("sdkPresent", false).put("available", false).put("status", "pending")
        .put("authorized", false).put("configured", false).put("selectedCount", 0)
        .put("message", if (Build.VERSION.SDK_INT < 29) "Google Home necesita Android 10 o posterior y una APK con Home APIs."
            else "Esta compilación no incluye el SDK oficial Home APIs. Instalá la APK VISO preparada con el SDK de STATUS.")

    @PluginMethod fun setActiveAccount(call: PluginCall) {
        try { owner.activate(call.getString("accountId")); call.resolve() }
        catch (_: Exception) { call.reject("La sesión VISO no es válida.", "GOOGLE_HOME_INVALID_ACCOUNT") }
    }
    @PluginMethod fun getStatus(call: PluginCall) = local(call) { owner.requireOwner(it); status(it) }
    @PluginMethod fun authorize(call: PluginCall) { call.reject("Esta APK no incluye el SDK oficial Google Home; no puede abrir su consentimiento.", "GOOGLE_HOME_SDK_NOT_INCLUDED") }
    @PluginMethod fun discoverLights(call: PluginCall) = local(call) { owner.requireOwner(it); status(it).put("lights", JSArray()) }
    @PluginMethod fun getConfiguration(call: PluginCall) = local(call) {
        owner.requireOwner(it)
        // A build without the SDK cannot apply these IDs, but never deletes them.
        preferences.get(it).json().put("selectedIds", JSArray()).put("enabled", false)
    }
    @PluginMethod fun saveConfiguration(call: PluginCall) = local(call) { account ->
        owner.requireOwner(account)
        val ids = call.getArray("selectedIds") ?: error("Falta selección.")
        require(ids.length() == 0)
        val raw = call.getObject("colorsByState") ?: error("Faltan colores.")
        require(raw.keys().asSequence().toSet() == GoogleHomePolicy.stateKeys)
        val colors = GoogleHomePolicy.stateKeys.associateWith { raw.getString(it) ?: error("Falta un color VISO.") }
        owner.invalidate()
        // Updating local colors without the SDK preserves a previous real selection.
        preferences.save(account, preferences.get(account).selectedIds, colors)
            .json().put("selectedIds", JSArray()).put("enabled", false)
    }
    @PluginMethod fun applyState(call: PluginCall) {
        call.resolve(JSObject().put("applied", false).put("skipped", true).put("reason", "sdk-not-included").put("results", JSArray()))
    }
    @PluginMethod fun disconnect(call: PluginCall) = local(call) { account ->
        owner.requireOwner(account); owner.invalidate(); preferences.clearSelection(account).json()
    }
    override fun handleOnPause() { owner.activate(null) }
    override fun handleOnDestroy() { owner.activate(null) }
}
