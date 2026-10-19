package com.viso.deck

import android.content.Intent
import android.os.Build
import org.json.JSONObject
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CalendarContract
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(name = "VisoPresence", permissions = [
    Permission(alias = "calendar", strings = [Manifest.permission.READ_CALENDAR]),
    Permission(alias = "phone", strings = [Manifest.permission.READ_PHONE_STATE]),
    Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])
])
@Suppress("DEPRECATION")
class VisoPresencePlugin : Plugin() {
    private var phoneListener: PhoneStateListener? = null
    private val manager get() = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
    private fun granted(permission: String) = ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    @PluginMethod fun requestCalendarAccess(call: PluginCall) {
        if (getPermissionState("calendar") == PermissionState.GRANTED) call.resolve(JSObject().put("granted", true))
        else requestPermissionForAlias("calendar", call, "calendarPermissionResult")
    }
    @PermissionCallback private fun calendarPermissionResult(call: PluginCall) {
        call.resolve(JSObject().put("granted", getPermissionState("calendar") == PermissionState.GRANTED))
    }
    @PluginMethod fun requestPhoneAccess(call: PluginCall) {
        if (!context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)) { call.reject("Este dispositivo no tiene telefonía móvil.", "PHONE_UNAVAILABLE"); return }
        if (getPermissionState("phone") == PermissionState.GRANTED) call.resolve(JSObject().put("granted", true))
        else requestPermissionForAlias("phone", call, "phonePermissionResult")
    }
    @PermissionCallback private fun phonePermissionResult(call: PluginCall) {
        call.resolve(JSObject().put("granted", getPermissionState("phone") == PermissionState.GRANTED))
    }

    @PluginMethod fun requestBackgroundAccess(call:PluginCall) {
        if(Build.VERSION.SDK_INT<33 || getPermissionState("notifications")==PermissionState.GRANTED){allowBackground();call.resolve(JSObject().put("granted",true))}
        else requestPermissionForAlias("notifications",call,"backgroundPermissionResult")
    }
    private fun allowBackground(){context.getSharedPreferences("viso-presence-runtime",0).edit().remove("stoppedAccount").apply()}
    @PermissionCallback private fun backgroundPermissionResult(call:PluginCall){val granted=getPermissionState("notifications")==PermissionState.GRANTED;if(granted)allowBackground();call.resolve(JSObject().put("granted",granted))}
    @PluginMethod fun getBackgroundStatus(call:PluginCall){
        val account=call.getString("accountId")?:""
        val configuration=try{SecureVault(context).get(BackgroundPresenceService.CONFIG)?.let(::JSONObject)}catch(_:Exception){null}
        val current=configuration?.optString("accountId")
        call.resolve(JSObject().put("running",BackgroundPresenceService.running&&current==account).put("accountId",current).put("expires",configuration?.optLong("expires")?:0L).put("stopped",context.getSharedPreferences("viso-presence-runtime",0).getString("stoppedAccount",null)==account))
    }
    @PluginMethod fun configureBackground(call:PluginCall){
        try {
            check(granted(Manifest.permission.READ_PHONE_STATE))
            val account=call.getString("accountId")?:error("Falta cuenta")
            require(account.length in 1..128 && account.all {it.isLetterOrDigit() || it in "_-:"})
            val secret=call.getString("secret")?:error("Falta autorización")
            require(secret.matches(Regex("[0-9a-fA-F-]{72}")))
            val expires=call.getLong("expires")?:error("Falta vigencia")
            require(expires>System.currentTimeMillis())
            val cfg=JSONObject().put("accountId",account).put("secret",secret).put("expires",expires)
            BackgroundPresenceService.suppressLights=false
            SecureVault(context).set(BackgroundPresenceService.CONFIG,cfg.toString())
            val intent=Intent(context,BackgroundPresenceService::class.java)
            if(Build.VERSION.SDK_INT>=26)context.startForegroundService(intent) else context.startService(intent)
            call.resolve()
        } catch(_:Exception){call.reject("No se pudo activar el servicio de llamadas. Revisá permisos y abrí VISO para activarlo.","BACKGROUND_UNAVAILABLE")}
    }
    @PluginMethod fun stopBackground(call:PluginCall){
        val config=try{SecureVault(context).get(BackgroundPresenceService.CONFIG)?.let(::JSONObject)}catch(_:Exception){null}
        val requested=call.getString("accountId")
        if(config!=null&&requested!=null&&config.optString("accountId")!=requested){call.resolve();return}
        BackgroundPresenceService.suppressLights=true
        GoogleHomeBackground.close()
        SecureVault(context).remove(BackgroundPresenceService.CONFIG)
        context.stopService(Intent(context,BackgroundPresenceService::class.java))
        config?.let { BackgroundPresenceService.revoke(it) }
        call.resolve()
    }
    override fun handleOnResume(){BackgroundPresenceService.foreground=true}
    override fun handleOnPause(){BackgroundPresenceService.foreground=false}
    @PluginMethod fun listCalendars(call: PluginCall) {
        try {
            check(granted(Manifest.permission.READ_CALENDAR)) { "Autorizá el acceso al calendario en Android." }
            val rows = JSArray()
            requireNotNull(context.contentResolver.query(CalendarContract.Calendars.CONTENT_URI,
                arrayOf(CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, CalendarContract.Calendars.ACCOUNT_NAME),
                null, null, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME + " ASC")).use { cursor ->
                while (cursor.moveToNext()) rows.put(JSObject().put("id", cursor.getLong(0).toString())
                    .put("name", cursor.getString(1) ?: "Calendario").put("account", cursor.getString(2) ?: ""))
            }
            call.resolve(JSObject().put("calendars", rows))
        } catch (_: Exception) { call.reject("No se pudieron leer los calendarios sincronizados. Revisá el permiso Android.", "CALENDAR_UNAVAILABLE") }
    }
    @PluginMethod fun getSignals(call: PluginCall) {
        try {
            val calls = call.getBoolean("calls", false) == true
            val calendarIds = call.getArray("calendarIds") ?: JSArray()
            val ids = (0 until calendarIds.length()).map { calendarIds.getString(it) }
            require(ids.size <= 100 && ids.all { it.matches(Regex("[0-9]{1,20}")) })
            var calling = false
            if (calls) {
                check(granted(Manifest.permission.READ_PHONE_STATE))
                val phone = manager ?: error("Telefonía no disponible")
                calling = phone.callState != TelephonyManager.CALL_STATE_IDLE
            }
            // A confirmed telephone call has priority even if the calendar provider is unavailable.
            if (calling) {
                call.resolve(JSObject().put("calling", true).put("meeting", false))
                return
            }
            var meeting = false
            if (ids.isNotEmpty()) {
                check(granted(Manifest.permission.READ_CALENDAR))
                val now = System.currentTimeMillis()
                val builder = CalendarContract.Instances.CONTENT_URI.buildUpon()
                android.content.ContentUris.appendId(builder, now - 86_400_000)
                android.content.ContentUris.appendId(builder, now + 86_400_000)
                val projection = arrayOf(CalendarContract.Instances.BEGIN, CalendarContract.Instances.END,
                    CalendarContract.Instances.ALL_DAY, CalendarContract.Instances.STATUS,
                    CalendarContract.Instances.AVAILABILITY, CalendarContract.Instances.SELF_ATTENDEE_STATUS,
                    CalendarContract.Instances.TITLE, CalendarContract.Instances.DESCRIPTION, CalendarContract.Instances.EVENT_LOCATION)
                val selection = CalendarContract.Instances.CALENDAR_ID + " IN (" + ids.joinToString(",") { "?" } + ")"
                requireNotNull(context.contentResolver.query(builder.build(), projection, selection, ids.toTypedArray(), null)).use { cursor ->
                    while (cursor.moveToNext()) {
                        val text = listOf(6, 7, 8).joinToString(" ") { cursor.getString(it) ?: "" }
                        if (PresencePolicy.isScheduledMeeting(now, cursor.getLong(0), cursor.getLong(1), cursor.getInt(2) != 0,
                            cursor.getInt(3) == CalendarContract.Events.STATUS_CANCELED,
                            cursor.getInt(4) == CalendarContract.Events.AVAILABILITY_FREE,
                            cursor.getInt(5) == CalendarContract.Attendees.ATTENDEE_STATUS_DECLINED,
                            text, call.getBoolean("allBusyEvents", false) == true)) { meeting = true; break }
                    }
                }
            }
            // Neither event contents nor caller numbers leave the Android device.
            call.resolve(JSObject().put("calling", calling).put("meeting", meeting))
        } catch (_: Exception) { call.reject("No se pudieron verificar las llamadas o la agenda. Revisá los permisos Android; el estado no se cambiará con datos desconocidos.", "PRESENCE_UNAVAILABLE") }
    }
    @PluginMethod fun startPhoneObservation(call: PluginCall) {
        activity.runOnUiThread {
            try {
                check(granted(Manifest.permission.READ_PHONE_STATE))
                if (phoneListener == null) {
                    val listener = object : PhoneStateListener() {
                        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                            notifyListeners("signalsChanged", JSObject().put("calling", state != TelephonyManager.CALL_STATE_IDLE), true)
                        }
                    }
                    val phone = manager ?: error("Telefonía no disponible")
                    phone.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
                    phoneListener = listener
                }
                call.resolve()
            } catch (_: Exception) { call.reject("Android no permitió observar el estado de llamadas.", "PHONE_UNAVAILABLE") }
        }
    }
    @PluginMethod fun stopPhoneObservation(call: PluginCall) {
        activity.runOnUiThread { stopPhone(); call.resolve() }
    }
    private fun stopPhone() { try { phoneListener?.let { manager?.listen(it, PhoneStateListener.LISTEN_NONE) } } catch (_: Exception) { /* Permission may have been revoked. */ }; phoneListener = null }
    override fun handleOnDestroy() { stopPhone() }
}
