package com.viso.deck

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder

object VisoTimbrePushProvider {
    fun token(context: Context, result: (String?, String?) -> Unit) {
        result(null, "Esta APK no tiene configuradas las notificaciones FCM de VISO Timbre.")
    }
    fun disable(context: Context) = Unit
}
// Disabled by manifest in a build without Firebase; no network or registration.
class VisoTimbreMessagingService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
}
