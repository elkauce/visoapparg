package com.viso.deck

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging

object VisoTimbrePushProvider {
    fun token(context: Context, result: (String?, String?) -> Unit) {
        try {
            if (FirebaseApp.getApps(context).isEmpty() && FirebaseApp.initializeApp(context) == null) {
                result(null, "No se encontró la configuración de Firebase."); return
            }
            val messaging = FirebaseMessaging.getInstance()
            messaging.isAutoInitEnabled = true
            messaging.token.addOnCompleteListener { task ->
                if (task.isSuccessful) result(task.result, null)
                else result(null, "No se pudo obtener la inscripción de notificaciones. Revisá Google Play y la conexión.")
            }
        } catch (_: Exception) { result(null, "Firebase no está disponible en este dispositivo.") }
    }
    fun disable(context: Context) {
        try {
            if (FirebaseApp.getApps(context).isEmpty()) return
            // The authenticated backend revokes owner delivery at logout. Keep
            // the installation token to avoid an asynchronous delete racing a
            // subsequent account's registration on this same device.
            FirebaseMessaging.getInstance().isAutoInitEnabled = false
        } catch (_: Exception) { /* No active registration. */ }
    }
}
