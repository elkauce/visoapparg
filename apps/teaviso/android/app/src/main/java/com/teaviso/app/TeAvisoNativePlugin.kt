package com.teaviso.app

import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.net.Uri
import android.util.Base64
import android.view.WindowManager
import androidx.activity.result.ActivityResult
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.util.UUID

/** Protocol-compatible authentication bridge, without Deck or telephone capabilities. */
@CapacitorPlugin(name = "VisoNative")
class TeAvisoNativePlugin : Plugin() {
    private lateinit var vault: SecureVault
    private var exportBytes: ByteArray? = null
    override fun load() { vault = SecureVault(context) }
    @PluginMethod fun getToken(call: PluginCall) {
        try {
            val key = call.getString("key") ?: ""
            require(TeAvisoPolicy.authKey(key))
            call.resolve(JSObject().put("value", vault.get(key) ?: JSONObject.NULL))
        } catch (_: Exception) { call.reject("No se pudo recuperar la sesión segura.") }
    }
    @PluginMethod fun setToken(call: PluginCall) {
        try {
            val key = call.getString("key") ?: ""
            val value = call.getString("value") ?: throw IllegalArgumentException()
            require(TeAvisoPolicy.authKey(key) && value.length <= 32768)
            vault.set(key, value); call.resolve()
        } catch (_: Exception) { call.reject("No se pudo guardar la sesión segura.") }
    }
    @PluginMethod fun removeToken(call: PluginCall) {
        try { val key = call.getString("key") ?: ""; require(TeAvisoPolicy.authKey(key)); vault.remove(key); call.resolve() }
        catch (_: Exception) { call.reject("No se pudo limpiar la sesión segura.") }
    }
    @PluginMethod fun openUrl(call: PluginCall) {
        try {
            val uri = TeAvisoPolicy.browserUrl(call.getString("url") ?: "", BuildConfig.BUILD_TYPE == "localTest")
            activity.runOnUiThread {
                try { activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri.toASCIIString())).addCategory(Intent.CATEGORY_BROWSABLE)); call.resolve() }
                catch (_: Exception) { call.reject("No encontramos un navegador para abrir este enlace.") }
            }
        } catch (_: Exception) { call.reject("El enlace no es válido.") }
    }
    @PluginMethod fun setKeepScreenOn(call: PluginCall) { activity.runOnUiThread {
        if (call.getBoolean("enabled", false) == true) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        call.resolve()
    } }
    @PluginMethod fun setScreenOrientation(call: PluginCall) {
        val mode = call.getString("mode")
        if (mode !in listOf("portrait", "automatic")) { call.reject("Orientación inválida."); return }
        activity.runOnUiThread { activity.requestedOrientation = if (mode == "portrait") ActivityInfo.SCREEN_ORIENTATION_PORTRAIT else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED; call.resolve() }
    }
    @PluginMethod fun enterImmersive(call: PluginCall) { activity.runOnUiThread { WindowInsetsControllerCompat(activity.window, activity.window.decorView).hide(WindowInsetsCompat.Type.systemBars()); call.resolve() } }
    @PluginMethod fun exitImmersive(call: PluginCall) { activity.runOnUiThread { WindowInsetsControllerCompat(activity.window, activity.window.decorView).show(WindowInsetsCompat.Type.systemBars()); call.resolve() } }
    @PluginMethod fun setManagementAppearance(call: PluginCall) { activity.runOnUiThread {
        val light = call.getBoolean("light", true) == true
        val bars = WindowInsetsControllerCompat(activity.window, activity.window.decorView)
        bars.isAppearanceLightStatusBars = light; bars.isAppearanceLightNavigationBars = light; call.resolve()
    } }
    @PluginMethod fun getDeviceId(call: PluginCall) {
        val prefs = context.getSharedPreferences("teaviso.installation", 0)
        val id = prefs.getString("id", null) ?: UUID.randomUUID().toString().also { prefs.edit().putString("id", it).apply() }
        call.resolve(JSObject().put("id", id))
    }
    @PluginMethod fun capabilities(call: PluginCall) { call.resolve(JSObject()
        .put("platform", "android").put("immersive", true).put("secureStorage", true)
        .put("openApps", false).put("mediaVolume", false).put("mediaSession", false)
        .put("mediaPermissionGranted", false).put("activeMediaSessions", 0)
        .put("homeAssistant", JSObject().put("status", "unavailable").put("message", "No corresponde a esta aplicación."))
        .put("googleHome", JSObject().put("status", "unavailable").put("message", "Las integraciones de VISO se administran en VISO."))) }
    @PluginMethod fun saveFile(call: PluginCall) {
        try {
            val filename = call.getString("filename") ?: ""
            val mime = call.getString("mimeType") ?: ""
            val encoded = call.getString("base64") ?: ""
            require(TeAvisoPolicy.exportName(filename, mime) && encoded.length in 1..4194304 && exportBytes == null)
            val bytes = Base64.decode(encoded, Base64.DEFAULT)
            require(bytes.isNotEmpty())
            if (mime == "image/png") require(bytes.size > 8 && bytes.take(8) == listOf(137,80,78,71,13,10,26,10).map { it.toByte() })
            if (mime == "image/svg+xml") {
                val svg = bytes.toString(Charsets.UTF_8)
                require(svg.trimStart().startsWith("<svg") && !Regex("<(script|foreignObject)\\b", RegexOption.IGNORE_CASE).containsMatchIn(svg))
            }
            exportBytes = bytes
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, filename)
            startActivityForResult(call, intent, "exportResult")
        } catch (_: Exception) { exportBytes = null; call.reject("No se pudo preparar el archivo del QR.") }
    }
    @ActivityCallback private fun exportResult(call: PluginCall?, result: ActivityResult) {
        val bytes = exportBytes; exportBytes = null
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || result.data?.data == null) { call.resolve(JSObject().put("saved", false)); return }
        try {
            val uri = result.data!!.data!!
            require(uri.scheme == "content" && bytes != null)
            context.contentResolver.openOutputStream(uri, "wt")?.use { it.write(bytes) } ?: throw IllegalStateException()
            call.resolve(JSObject().put("saved", true))
        } catch (_: Exception) { call.reject("No se pudo guardar el QR en la ubicación elegida.") }
    }
    override fun handleOnDestroy() { exportBytes = null; super.handleOnDestroy() }
}
