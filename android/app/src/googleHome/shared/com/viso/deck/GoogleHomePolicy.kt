package com.viso.deck

/** Only VISO's six statuses may cause a selected light command. */
internal object GoogleHomePolicy {
    val stateKeys = linkedSetOf("libre", "ocupado", "reunion", "llamada", "no-molestar", "ausente")
    val defaultColors = linkedMapOf(
        "libre" to "#00FF00", "ocupado" to "#FF0000", "reunion" to "#FFFF00",
        "llamada" to "#00AAFF", "no-molestar" to "#AA00FF", "ausente" to "#FF8800"
    )

    fun account(value: String?): String {
        require(value != null && value.length in 1..128 && value.all { it.isLetterOrDigit() || it in "_-:" }) {
            "La sesión VISO no es válida. Volvé a iniciar sesión."
        }
        return value
    }

    fun colors(values: Map<String, String>): Map<String, String> {
        require(values.keys == stateKeys) { "Configurá un color para cada uno de los seis estados VISO." }
        require(values.values.all { Regex("^#[0-9a-fA-F]{6}$").matches(it) }) { "Los colores deben usar el formato #RRGGBB." }
        return stateKeys.associateWith { values.getValue(it).uppercase(java.util.Locale.ROOT) }
    }

    fun selected(values: List<String>): List<String> {
        require(values.size <= 128 && values.all { it.length in 1..256 && it.none(Char::isISOControl) }) {
            "La selección de luces no es válida."
        }
        return values.distinct().sorted()
    }

    fun requireAuthorizedSelection(selected: List<String>, colorCapableIds: Set<String>) {
        require(colorCapableIds.containsAll(selected)) {
            "Una luz seleccionada ya no está autorizada o no admite color. Volvé a buscar luces."
        }
    }
}

/** Old account and superseded requests lose permission before the next command. */
internal class GoogleHomeOwnerScope {
    data class Ticket(val account: String, val generation: Long, val request: Long)
    private var owner: String? = null
    private var generation = 0L
    private var request = 0L

    @Synchronized fun activate(account: String?): Boolean {
        if (account != null) GoogleHomePolicy.account(account)
        if (owner == account) return false
        owner = account
        generation += 1
        request += 1
        return true
    }

    @Synchronized fun requireOwner(account: String) {
        check(owner == account) { "La sesión VISO cambió. Volvé a abrir la configuración." }
    }

    @Synchronized fun begin(account: String): Ticket {
        requireOwner(account)
        request += 1
        return Ticket(account, generation, request)
    }

    @Synchronized fun invalidate() { request += 1 }
    @Synchronized fun isOwner(account: String): Boolean = owner == account
    @Synchronized fun isDifferentOwner(account: String): Boolean = owner != null && owner != account
    @Synchronized fun isCurrent(ticket: Ticket): Boolean =
        owner == ticket.account && generation == ticket.generation && request == ticket.request
}
