package com.viso.deck

import com.google.android.gms.common.api.ApiException

/** Only exception class/status codes are exposed: no accounts, tokens or device IDs. */
internal object GoogleHomeFailure {
    fun describe(stage: String, failure: Exception): String {
        val chain = generateSequence(failure as Throwable) { it.cause }.take(8).toList()
        val google = chain.filterIsInstance<ApiException>().firstOrNull()
        if (google != null) {
            val hint = when (google.statusCode) {
                7 -> "Google informó un error de red."
                10 -> "Google rechazó la configuración de la app: revisá paquete, firma y cliente OAuth."
                else -> "Google no completó la operación."
            }
            return "$stage. $hint Código Google: ${google.statusCode}."
        }
        val localMessages = listOf("VISO todavía no recuperó", "La sesión VISO cambió", "La cuenta VISO cambió",
            "Google Home requiere consentimiento", "Google Home no concedió acceso", "Google Home necesita Android",
            "Google Home no está disponible")
        if (failure is IllegalStateException && localMessages.any { failure.message?.startsWith(it) == true })
            return failure.message!!
        return "$stage. Diagnóstico: ${chain.last().javaClass.simpleName}. Tocá Comprobar de nuevo."
    }
}
