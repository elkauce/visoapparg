package com.viso.deck

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class VisoTimbreMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        // Data-only delivery lets the local owner/expiry policy reject messages
        // for a logged-out or switched account, even when the WebView is closed.
        TimbreNotifications.receive(this, message.data)
    }
    override fun onNewToken(token: String) {
        // A token cannot be registered for an owner without an authenticated VISO
        // session. Mark it pending and let the next app resume refresh the backend.
        TimbreNotifications.settings(this).edit().putBoolean("tokenNeedsSync", true).apply()
    }
}
