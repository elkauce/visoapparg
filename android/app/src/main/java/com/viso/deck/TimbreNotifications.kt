package com.viso.deck

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/** Separate from the opt-in telephone service: works on tablets without phone permission. */
object TimbreNotifications {
    const val CHANNEL = "viso_timbre_calls"
    const val EXTRA_CALL_ID = "viso_timbre_call_id"
    private const val TAG = "viso.timbre"
    fun settings(context: Context) = context.getSharedPreferences("viso.timbre.push", Context.MODE_PRIVATE)
    fun receive(context: Context, data: Map<String, String>) {
        val prefs = settings(context)
        val event = TimbrePushPolicy.event(data, prefs.getString("ownerId", null),
            prefs.getBoolean("enabled", false), System.currentTimeMillis()) ?: return
        if (event.kind == "cancel") { cancel(context, event.callId); return }
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "Llamadas de VISO Timbre", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Avisos al recibir una llamada del timbre"
                lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
            })
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            this.data = Uri.parse("com.viso.deck://timbre/${event.callId}")
            putExtra(EXTRA_CALL_ID, event.callId)
        }
        val tap = PendingIntent.getActivity(context, event.callId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.viso_notification)
            .setContentTitle("Llamada de VISO Timbre")
            .setContentText("Tocá para abrir VISO y responder.")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentIntent(tap).setAutoCancel(true)
            .setTimeoutAfter((event.expiresAt - System.currentTimeMillis()).coerceIn(1_000, 120_000))
            .build()
        try { manager.notify("$TAG:${event.callId}", 0, notification) }
        catch (_: SecurityException) { /* Notification permission may have been revoked. */ }
    }
    fun cancel(context: Context, callId: String) {
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .cancel("$TAG:$callId", 0)
    }
    fun cancelAll(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 23) manager.activeNotifications
            .filter { it.tag?.startsWith("$TAG:") == true }.forEach { manager.cancel(it.tag, it.id) }
    }
}
