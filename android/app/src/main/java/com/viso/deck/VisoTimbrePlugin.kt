package com.viso.deck

import android.Manifest
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(name = "VisoTimbre", permissions = [
    Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])
])
class VisoTimbrePlugin : Plugin() {
    @PluginMethod fun getCapabilities(call: PluginCall) {
        call.resolve(JSObject().put("available", BuildConfig.TIMBRE_FCM_ENABLED)
            .put("notificationsEnabled", NotificationManagerCompat.from(context).areNotificationsEnabled())
            .put("backgroundMedia", false))
    }
    @PluginMethod fun requestNotifications(call: PluginCall) {
        if (!BuildConfig.TIMBRE_FCM_ENABLED) { call.reject("VISO Timbre no tiene FCM configurado en esta APK."); return }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED)
            requestPermissionForAlias("notifications", call, "notificationsResult")
        else notificationsResult(call)
    }
    @PermissionCallback private fun notificationsResult(call: PluginCall) {
        call.resolve(JSObject().put("granted", NotificationManagerCompat.from(context).areNotificationsEnabled()))
    }
    @PluginMethod fun getPushToken(call: PluginCall) {
        if (!BuildConfig.TIMBRE_FCM_ENABLED || !NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            call.reject("Las notificaciones de VISO Timbre no están habilitadas."); return
        }
        VisoTimbrePushProvider.token(context) { token, error ->
            if (token == null) call.reject(error ?: "No se pudo registrar este dispositivo.")
            else call.resolve(JSObject().put("token", token))
        }
    }
    @PluginMethod fun configure(call: PluginCall) {
        val enabled = call.getBoolean("enabled", false) == true
        val ownerId = call.getString("ownerId")
        if (enabled && (!BuildConfig.TIMBRE_FCM_ENABLED || ownerId.isNullOrBlank() || ownerId.length > 160)) {
            call.reject("No se pudo vincular el dispositivo a esta cuenta."); return
        }
        val prefs = TimbreNotifications.settings(context)
        if (!enabled || prefs.getString("ownerId", null) != ownerId) TimbreNotifications.cancelAll(context)
        prefs.edit().putBoolean("enabled", enabled).apply {
            if (enabled) putString("ownerId", ownerId) else remove("ownerId")
        }.apply()
        if (!enabled) VisoTimbrePushProvider.disable(context)
        call.resolve()
    }
    @PluginMethod fun getPendingCall(call: PluginCall) {
        val enabled = TimbreNotifications.settings(context).getBoolean("enabled", false)
        call.resolve(JSObject().put("callId", if (enabled) activity.intent?.getStringExtra(TimbreNotifications.EXTRA_CALL_ID) else null))
    }
    @PluginMethod fun clearPendingCall(call: PluginCall) {
        activity.intent?.getStringExtra(TimbreNotifications.EXTRA_CALL_ID)?.let { TimbreNotifications.cancel(context, it) }
        activity.intent?.removeExtra(TimbreNotifications.EXTRA_CALL_ID)
        call.resolve()
    }
    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)
        if (!TimbreNotifications.settings(context).getBoolean("enabled", false)) return
        val callId = intent.getStringExtra(TimbreNotifications.EXTRA_CALL_ID) ?: return
        activity.intent = intent
        notifyListeners("timbreNotificationTapped", JSObject().put("callId", callId), true)
    }
}
