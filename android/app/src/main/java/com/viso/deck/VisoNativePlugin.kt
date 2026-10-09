package com.viso.deck

import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.media.AudioManager
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.text.InputType
import android.text.Editable
import android.text.TextWatcher
import android.util.Base64
import android.view.Gravity
import android.view.WindowManager
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.BaseAdapter
import android.widget.CheckBox
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.text.Collator
import java.text.Normalizer
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors

@CapacitorPlugin(name = "VisoNative")
class VisoNativePlugin : Plugin() {
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var vault: SecureVault
    private lateinit var homeAssistant: HomeAssistantClient
    private val preferences get() = context.getSharedPreferences("viso_native_preferences", Context.MODE_PRIVATE)

    override fun load() {
        vault = SecureVault(context)
        homeAssistant = HomeAssistantClient(vault)
        activity.runOnUiThread { applyImmersive(activity, bridge.webView) }
    }

    private fun background(call: PluginCall, message: String, operation: () -> JSObject?) {
        worker.execute {
            try {
                val result = operation()
                if (result == null) call.resolve() else call.resolve(result)
            } catch (_: Exception) {
                // Never pass native exceptions, HTTP bodies or credential values to logs/JS.
                call.reject(message, "NATIVE_ACTION_FAILED")
            }
        }
    }

    private fun ui(call: PluginCall, message: String, operation: () -> Unit) {
        activity.runOnUiThread {
            try { operation() } catch (_: Exception) { call.reject(message, "NATIVE_ACTION_FAILED") }
        }
    }

    @PluginMethod
    fun enterImmersive(call: PluginCall) = ui(call, "No se pudo activar la pantalla completa.") {
        immersive = true
        applyImmersive(activity, bridge.webView)
        call.resolve()
    }

    @PluginMethod
    fun exitImmersive(call: PluginCall) = ui(call, "No se pudo salir de pantalla completa.") {
        immersive = false
        applyImmersive(activity, bridge.webView)
        call.resolve()
    }

    @PluginMethod
    fun openUrl(call: PluginCall) = ui(call, "La URL debe usar HTTP/HTTPS y tener un navegador disponible.") {
        val url = NativePolicy.safeBrowserUrl(call.getString("url") ?: "")
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url.toASCIIString())).addCategory(Intent.CATEGORY_BROWSABLE)
        activity.startActivity(intent)
        call.resolve()
    }

    private fun allowedApps(): Set<String> = preferences.getStringSet("allowed_apps", emptySet())?.toSet() ?: emptySet()

    private data class LaunchableApp(val packageName: String, val name: String, val resolved: ResolveInfo)

    private fun launchableApps(): List<LaunchableApp> {
        // This is the existing MAIN/LAUNCHER visibility query, not a scan of all packages.
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val manager = context.packageManager
        @Suppress("DEPRECATION")
        val visible = manager.queryIntentActivities(intent, 0)
        val collator = Collator.getInstance(Locale.getDefault())
        return visible.distinctBy { it.activityInfo.packageName }
            .filter { it.activityInfo.packageName != context.packageName && NativePolicy.validPackage(it.activityInfo.packageName) }
            .map { resolved ->
                val packageName = resolved.activityInfo.packageName
                val label = resolved.activityInfo.applicationInfo.loadLabel(manager).toString()
                    .filter { !it.isISOControl() }.trim().take(100)
                val name = label.takeIf { it.isNotEmpty() && it != packageName } ?: "Aplicación"
                LaunchableApp(packageName, name, resolved)
            }
            .sortedWith { first, second -> collator.compare(first.name, second.name) }
    }

    private fun appDrawable(app: LaunchableApp): Drawable? = try {
        app.resolved.activityInfo.applicationInfo.loadIcon(context.packageManager)
    } catch (_: Exception) { null }

    private fun appIcon(app: LaunchableApp): String? {
        val drawable = appDrawable(app) ?: return null
        val bitmap = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888)
        return try {
            val width = drawable.intrinsicWidth.takeIf { it > 0 } ?: 96
            val height = drawable.intrinsicHeight.takeIf { it > 0 } ?: 96
            val scale = minOf(96.0 / width, 96.0 / height)
            val drawnWidth = (width * scale).toInt().coerceIn(1, 96)
            val drawnHeight = (height * scale).toInt().coerceIn(1, 96)
            val left = (96 - drawnWidth) / 2
            val top = (96 - drawnHeight) / 2
            drawable.setBounds(left, top, left + drawnWidth, top + drawnHeight)
            drawable.draw(Canvas(bitmap))
            val bytes = ByteArrayOutputStream()
            if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, bytes) || bytes.size() > 65_536) null
            else "data:image/png;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
        } catch (_: Exception) { null } finally { bitmap.recycle() }
    }

    @PluginMethod
    fun openApp(call: PluginCall) = ui(call, "No se pudo abrir la aplicación. Elegí otra desde el editor.") {
        val packageName = call.getString("packageName") ?: ""
        if (!NativePolicy.allowedPackage(packageName, allowedApps())) {
            call.reject("Esta aplicación no está permitida. Elegila en Aplicaciones permitidas.", "APP_NOT_ALLOWED")
            return@ui
        }
        val intent = context.packageManager.getLaunchIntentForPackage(packageName)
        if (intent == null) {
            call.reject("La aplicación ya no está instalada o disponible. Elegí otra desde el editor.", "APP_UNAVAILABLE")
            return@ui
        }
        try { activity.startActivity(intent) } catch (_: ActivityNotFoundException) {
            call.reject("La aplicación ya no está instalada o disponible. Elegí otra desde el editor.", "APP_UNAVAILABLE")
            return@ui
        } catch (_: SecurityException) {
            call.reject("Android no permite abrir esta aplicación. Elegí otra desde el editor.", "APP_UNAVAILABLE")
            return@ui
        }
        call.resolve()
    }

    @PluginMethod
    fun getAllowedApps(call: PluginCall) {
        call.resolve(JSObject().put("packages", JSArray(allowedApps().sorted())))
    }

    @PluginMethod
    fun listInstalledApps(call: PluginCall) = background(call, "No se pudieron consultar las aplicaciones disponibles.") {
        val selected = allowedApps()
        val apps = JSArray()
        launchableApps().forEach { app ->
            apps.put(JSObject().put("packageName", app.packageName).put("name", app.name)
                .put("icon", appIcon(app) ?: JSONObject.NULL).put("allowed", app.packageName in selected))
        }
        JSObject().put("apps", apps)
    }

    @PluginMethod
    fun getAppIcon(call: PluginCall) = background(call, "No se pudo leer el icono de la aplicación.") {
        val packageName = call.getString("packageName") ?: ""
        require(NativePolicy.validPackage(packageName))
        val app = launchableApps().firstOrNull { it.packageName == packageName }
        JSObject().put("icon", app?.let(::appIcon) ?: JSONObject.NULL)
    }

    @PluginMethod
    fun configureAllowedApps(call: PluginCall) = ui(call, "No se pudo configurar la lista de aplicaciones.") {
        val applications = launchableApps()
        val selected = allowedApps().toMutableSet()
        val density = context.resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()
        val layout = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(8), dp(20), 0)
        }
        val search = EditText(activity).apply {
            hint = "Buscar aplicación"
            inputType = InputType.TYPE_CLASS_TEXT
            setSingleLine(true)
            isSaveEnabled = false
            imeOptions = EditorInfo.IME_ACTION_DONE
        }
        val list = ListView(activity).apply {
            dividerHeight = 0
            isVerticalScrollBarEnabled = true
        }
        val empty = TextView(activity).apply {
            text = "No hay aplicaciones disponibles."
            gravity = Gravity.CENTER
            setPadding(0, dp(24), 0, dp(24))
        }
        var filtered = applications
        val adapter = object : BaseAdapter() {
            override fun getCount() = filtered.size
            override fun getItem(position: Int) = filtered[position]
            override fun getItemId(position: Int) = position.toLong()
            override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
                val row = convertView as? LinearLayout ?: LinearLayout(activity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    minimumHeight = dp(64)
                    setPadding(dp(4), dp(8), dp(4), dp(8))
                    addView(ImageView(activity).apply {
                        scaleType = ImageView.ScaleType.FIT_CENTER
                        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                    }, LinearLayout.LayoutParams(dp(40), dp(40)).apply { marginEnd = dp(14) })
                    addView(TextView(activity).apply {
                        textSize = 16f
                        setSingleLine(false)
                        maxLines = 2
                    }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    addView(CheckBox(activity).apply {
                        isClickable = false
                        isFocusable = false
                        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                    })
                }
                val app = filtered[position]
                (row.getChildAt(0) as ImageView).setImageDrawable(appDrawable(app))
                (row.getChildAt(1) as TextView).text = app.name
                (row.getChildAt(2) as CheckBox).isChecked = app.packageName in selected
                row.contentDescription = "${app.name}, ${if (app.packageName in selected) "seleccionada" else "sin seleccionar"}"
                return row
            }
        }
        list.adapter = adapter
        list.setOnItemClickListener { _, _, position, _ ->
            val packageName = filtered[position].packageName
            if (!selected.add(packageName)) selected.remove(packageName)
            adapter.notifyDataSetChanged()
        }
        fun searchKey(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFD)
            .replace(Regex("\\p{M}"), "").lowercase(Locale.getDefault())
        search.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(text: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(text: CharSequence?, start: Int, before: Int, count: Int) {
                val term = searchKey(text?.toString()?.trim() ?: "")
                filtered = applications.filter { searchKey(it.name).contains(term) }
                empty.text = if (applications.isEmpty()) "No hay aplicaciones disponibles." else "No se encontraron aplicaciones."
                empty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
                adapter.notifyDataSetChanged()
            }
            override fun afterTextChanged(text: Editable?) = Unit
        })
        empty.visibility = if (applications.isEmpty()) View.VISIBLE else View.GONE
        layout.addView(search)
        layout.addView(empty)
        // A recycled native list remains smooth even with many launchable applications.
        layout.addView(list, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,
            minOf(dp(360), (context.resources.displayMetrics.heightPixels * 0.42).toInt())))
        AlertDialog.Builder(activity).setTitle("Aplicaciones permitidas")
            .setView(layout)
            .setPositiveButton("Guardar") { _, _ ->
                val visible = applications.map { it.packageName }.toSet()
                val saved = selected.intersect(visible)
                preferences.edit().putStringSet("allowed_apps", saved).apply()
                call.resolve(JSObject().put("packages", JSArray(saved.sorted())))
            }
            .setNegativeButton("Cancelar") { _, _ -> call.reject("Configuración cancelada.", "CANCELLED") }
            .setOnCancelListener { call.reject("Configuración cancelada.", "CANCELLED") }
            .show()
    }

    private fun listenerComponent() = ComponentName(context, VisoNotificationListener::class.java)

    private fun mediaAccessGranted(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            return (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .isNotificationListenerAccessGranted(listenerComponent())
        }
        val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
        return enabled.split(':').any { ComponentName.unflattenFromString(it) == listenerComponent() }
    }

    private fun sessions(): List<MediaController> {
        if (!mediaAccessGranted()) return emptyList()
        return (context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager)
            .getActiveSessions(listenerComponent())
    }

    @PluginMethod
    fun requestMediaAccess(call: PluginCall) = ui(call, "No se pudo abrir el permiso de acceso multimedia.") {
        // The platform owns the grant. Returning from settings never implies permission was granted.
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        activity.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun media(call: PluginCall) = ui(call, "Control multimedia no disponible: revisá permisos y una sesión de música activa.") {
        val command = call.getString("command") ?: ""
        val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (command in listOf("volume-up", "volume-down", "mute")) {
            val direction = when (command) {
                "volume-up" -> AudioManager.ADJUST_RAISE
                "volume-down" -> AudioManager.ADJUST_LOWER
                else -> AudioManager.ADJUST_TOGGLE_MUTE
            }
            audio.adjustStreamVolume(AudioManager.STREAM_MUSIC, direction, AudioManager.FLAG_SHOW_UI)
        } else {
            require(command in listOf("play-pause", "next", "previous"))
            require(mediaAccessGranted())
            val controllers = sessions()
            val controller = controllers.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING }
                ?: controllers.firstOrNull() ?: error("No media sessions")
            val state = controller.playbackState ?: error("No playback state")
            val supported = state.actions
            val transport = controller.transportControls
            when (command) {
                "next" -> { require(supported and PlaybackState.ACTION_SKIP_TO_NEXT != 0L); transport.skipToNext() }
                "previous" -> { require(supported and PlaybackState.ACTION_SKIP_TO_PREVIOUS != 0L); transport.skipToPrevious() }
                "play-pause" -> if (state.state == PlaybackState.STATE_PLAYING) {
                    require(supported and (PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE) != 0L)
                    transport.pause()
                } else {
                    require(supported and (PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PLAY_PAUSE) != 0L)
                    transport.play()
                }
            }
        }
        call.resolve()
    }

    private fun authKey(call: PluginCall): String {
        val key = call.getString("key") ?: ""
        require(NativePolicy.validStorageKey(key))
        return "auth:$key" // JS can never address integration:ha:configuration.
    }

    @PluginMethod
    fun getToken(call: PluginCall) = background(call, "No se pudo leer la sesión segura.") {
        JSObject().put("value", vault.get(authKey(call)) ?: JSONObject.NULL)
    }

    @PluginMethod
    fun setToken(call: PluginCall) = background(call, "No se pudo guardar la sesión segura.") {
        val value = call.getString("value") ?: error("Missing token")
        require(value.length <= 1_048_576)
        vault.set(authKey(call), value)
        null
    }

    @PluginMethod
    fun removeToken(call: PluginCall) = background(call, "No se pudo eliminar la sesión segura.") {
        vault.remove(authKey(call))
        null
    }

    @PluginMethod
    fun getDeviceId(call: PluginCall) = background(call, "No se pudo identificar este dispositivo.") {
        val id = preferences.getString("device_id", null) ?: UUID.randomUUID().toString().also {
            check(preferences.edit().putString("device_id", it).commit())
        }
        JSObject().put("id", id)
    }

    @PluginMethod
    fun capabilities(call: PluginCall) = background(call, "No se pudieron consultar las funciones Android.") {
        val granted = mediaAccessGranted()
        val activeCount = try { sessions().size } catch (_: SecurityException) { 0 }
        JSObject().put("platform", "android").put("immersive", true).put("secureStorage", true)
            .put("openApps", true).put("mediaVolume", true).put("mediaSession", granted && activeCount > 0)
            .put("mediaPermissionGranted", granted).put("activeMediaSessions", activeCount)
            .put("homeAssistant", homeAssistant.status())
            .put("googleHome", JSObject().put("status", "pending")
                .put("message", "Pendiente: SDK oficial Home APIs y consentimiento Google en Android."))
    }

    @PluginMethod
    fun configureHomeAssistant(call: PluginCall) = ui(call, "No se pudo abrir la configuración segura.") {
        val layout = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            val inset = (20 * resources.displayMetrics.density).toInt()
            setPadding(inset, inset, inset, 0)
        }
        val url = EditText(activity).apply {
            hint = "https://homeassistant.ejemplo.com"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine(true)
        }
        val token = EditText(activity).apply {
            hint = "Token de larga duración de tu cuenta"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setSingleLine(true)
            isSaveEnabled = false
            imeOptions = EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO
        }
        layout.addView(url)
        layout.addView(token)
        val dialog = AlertDialog.Builder(activity).setTitle("Home Assistant · conexión segura")
            .setMessage("Usá una instancia HTTPS con certificado válido. La credencial queda cifrada con AndroidKeyStore y nunca se entrega a la interfaz web.")
            .setView(layout)
            .setPositiveButton("Verificar y guardar", null)
            .setNegativeButton("Cancelar") { _, _ ->
                token.text.clear()
                call.reject("Configuración cancelada.", "CANCELLED")
            }
            .setOnCancelListener {
                token.text.clear()
                call.reject("Configuración cancelada.", "CANCELLED")
            }
            .create()
        dialog.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        dialog.setOnShowListener {
            dialog.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val base = url.text.toString().trim()
                val credential = token.text.toString().trim()
                try {
                    NativePolicy.homeAssistantBase(base)
                    require(credential.isNotEmpty())
                } catch (_: Exception) {
                    url.error = "Ingresá una URL HTTPS válida y una credencial."
                    return@setOnClickListener
                }
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled = false
                dialog.getButton(AlertDialog.BUTTON_NEGATIVE).isEnabled = false
                dialog.setCancelable(false)
                worker.execute {
                    try {
                        val result = homeAssistant.configure(base, credential)
                        activity.runOnUiThread {
                            token.text.clear()
                            dialog.dismiss()
                            call.resolve(result)
                        }
                    } catch (_: Exception) {
                        activity.runOnUiThread {
                            token.error = "No se pudo autorizar. Revisá token, red y certificado HTTPS."
                            dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled = true
                            dialog.getButton(AlertDialog.BUTTON_NEGATIVE).isEnabled = true
                            dialog.setCancelable(true)
                        }
                    }
                }
            }
        }
        dialog.show()
    }

    @PluginMethod
    fun homeAssistantStatus(call: PluginCall) = background(call, "No se pudo comprobar Home Assistant.") { homeAssistant.verify() }

    @PluginMethod
    fun discoverLights(call: PluginCall) = background(call, "No se pudo descubrir iluminación. Configurá Home Assistant y revisá autorización/red.") {
        JSObject().put("lights", homeAssistant.discoverLights())
    }

    @PluginMethod
    fun controlLight(call: PluginCall) = background(call, "Home Assistant rechazó la acción. Revisá conexión, dispositivo, color y brillo compatibles.") {
        homeAssistant.controlLight(call.getString("entityId") ?: "", call.getBoolean("on"), call.getDouble("brightness"), call.getString("color"))
    }

    @PluginMethod
    fun disconnectHomeAssistant(call: PluginCall) = background(call, "No se pudo eliminar la conexión Home Assistant.") {
        homeAssistant.disconnect()
        null
    }

    override fun handleOnResume() {
        activity.runOnUiThread { applyImmersive(activity, bridge.webView) }
    }

    override fun handleOnDestroy() {
        worker.shutdownNow()
    }

    companion object {
        private var immersive = false

        @JvmStatic
        fun applyImmersive(activity: android.app.Activity, webView: android.view.View?) {
            val window = activity.window
            WindowCompat.setDecorFitsSystemWindows(window, false)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val attributes = window.attributes
                attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                window.attributes = attributes
            }
            val controller = WindowInsetsControllerCompat(window, window.decorView)
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            if (immersive) controller.hide(WindowInsetsCompat.Type.systemBars()) else controller.show(WindowInsetsCompat.Type.systemBars())
            if (webView != null) {
                ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
                    if (activity is MainActivity) {
                        activity.applyWebViewInsets(view, insets, immersive)
                    } else {
                        val type = if (immersive) WindowInsetsCompat.Type.displayCutout() else WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
                        val safe = insets.getInsets(type)
                        val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
                        view.setPadding(safe.left, safe.top, safe.right, maxOf(safe.bottom, keyboard.bottom))
                    }
                    insets
                }
                ViewCompat.requestApplyInsets(webView)
            }
        }
    }
}
