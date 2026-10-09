package com.viso.deck

import android.content.Context
import android.graphics.Color
import android.os.Build
import androidx.activity.result.ActivityResultCaller
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.home.ConnectivityState
import com.google.home.FactoryRegistry
import com.google.home.ForcePermissionFlow
import com.google.home.Home
import com.google.home.HomeClient
import com.google.home.HomeConfig
import com.google.home.HomeDevice
import com.google.home.PermissionsResultStatus
import com.google.home.PermissionsState
import com.google.home.google.ExtendedColorControl
import com.google.home.matter.standard.ColorControl
import com.google.home.matter.standard.ColorControlTrait
import com.google.home.matter.standard.ExtendedColorLightDevice
import com.google.home.matter.standard.LevelControl
import com.google.home.matter.standard.OnOff
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.roundToInt

/** One official client, reused from STATUS/viso-safe, without another VISO screen. */
private object GoogleHomeRuntime {
    private var client: HomeClient? = null
    @Synchronized fun register(context: Context, caller: ActivityResultCaller): HomeClient {
        val result = client ?: Home.getClient(context.applicationContext, HomeConfig(
            coroutineContext = Dispatchers.IO,
            factoryRegistry = FactoryRegistry(
                types = listOf(ExtendedColorLightDevice),
                traits = listOf(OnOff, LevelControl, ColorControl, ExtendedColorControl)
            ),
            homePlatformScope = HomeConfig.HomePlatformScope.HOME_PLATFORM_SCOPE_VERSION_1
        )).also { client = it }
        result.registerActivityResultCallerForPermissions(caller)
        return result
    }
}

internal class GoogleHomeAdapter(
    private val context: Context,
    private val owner: GoogleHomeOwnerScope,
    private val preferences: GoogleHomePreferences,
    private val isForeground: () -> Boolean
) {
    private var client: HomeClient? = null
    private var initializationFailed = false
    private val commandMutex = Mutex()
    private var lastSuccessfulSignature: String? = null

    fun register(caller: ActivityResultCaller) {
        if (!runtimeAvailable()) return
        try { client = GoogleHomeRuntime.register(context, caller) }
        catch (_: Exception) { initializationFailed = true }
    }

    fun accountChanged() { lastSuccessfulSignature = null }
    private fun runtimeAvailable(): Boolean = Build.VERSION.SDK_INT >= 29 &&
        GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS

    private fun requireClient(): HomeClient = client ?: error(
        if (Build.VERSION.SDK_INT < 29) "Google Home necesita Android 10 o posterior."
        else "Google Home no está disponible. Revisá Google Play y volvé a abrir VISO."
    )

    private suspend fun permission(): PermissionsState? = withTimeoutOrNull(8_000) {
        requireClient().hasPermissions().first { it != PermissionsState.PERMISSIONS_STATE_UNINITIALIZED }
    }

    suspend fun status(account: String, messageOverride: String? = null): JSObject {
        val available = runtimeAvailable() && client != null && !initializationFailed
        val state = if (available) permission() else null
        val structures = if (state == PermissionsState.GRANTED) withTimeoutOrNull(8_000) {
            requireClient().structures().list()
        } else null
        val accessRevoked = state == PermissionsState.NOT_GRANTED ||
            (state == PermissionsState.GRANTED && structures != null && structures.isEmpty())
        if (accessRevoked && owner.isOwner(account)) {
            // Revoked device IDs never stay eligible for later commands.
            preferences.clearSelection(account)
            owner.invalidate()
            lastSuccessfulSignature = null
        }
        // Google documents GRANTED + no structures after revocation in Home.
        val authorized = state == PermissionsState.GRANTED && !structures.isNullOrEmpty()
        val config = preferences.get(account)
        val message = messageOverride ?: when {
            Build.VERSION.SDK_INT < 29 -> "Google Home necesita Android 10 o posterior."
            !runtimeAvailable() -> "Google Home necesita servicios Google Play actualizados en este teléfono."
            !available -> "No se pudo iniciar Home APIs. Volvé a abrir VISO."
            authorized && config.enabled -> "Google Home autorizado; VISO usa únicamente tus luces seleccionadas."
            authorized -> "Google Home autorizado. Buscá y elegí las luces que utilizará VISO."
            state == PermissionsState.GRANTED -> "Google Home no confirmó acceso a una casa. Revisá permisos en Google Home y volvé a autorizar."
            state == PermissionsState.NOT_GRANTED -> "Autorizá Google Home con tu cuenta y casa. El cliente OAuth debe corresponder a esta APK."
            else -> "Google Home todavía no confirmó permisos. Revisá conexión, cuenta y configuración OAuth de VISO."
        }
        return JSObject().put("sdkPresent", true).put("available", available)
            .put("status", if (!available) "unavailable" else if (authorized) "connected" else "pending")
            .put("authorized", authorized).put("configured", authorized && config.enabled)
            .put("selectedCount", config.selectedIds.size).put("message", message)
    }

    suspend fun authorize(account: String): JSObject {
        owner.requireOwner(account)
        owner.invalidate()
        lastSuccessfulSignature = null
        val result = requireClient().requestPermissions(forcePermissionFlow = ForcePermissionFlow.FORCE_LAUNCH)
        // The official Google activity can return before JS receives appStateChange.
        // A temporarily null owner is safe for this permission-only response: it
        // neither saves a selection nor issues a light command nor reactivates VISO.
        check(!owner.isDifferentOwner(account)) { "La cuenta VISO cambió durante el consentimiento." }
        return when (result.status) {
            PermissionsResultStatus.SUCCESS -> status(account)
            PermissionsResultStatus.CANCELLED -> status(account, "Google Home devolvió vinculación cancelada. Podés volver a intentarlo.")
            else -> status(account, "Google Home rechazó la vinculación. Revisá el cliente OAuth Android de VISO en el proyecto STATUS y la audiencia de prueba.")
        }
    }

    private fun colorCapable(light: ExtendedColorLightDevice): Boolean {
        val matter = light.standardTraits.colorControl
        val google = light.googleTraits.extendedColorControl
        return matter?.supports(ColorControl.Command.MoveToHueAndSaturation) == true ||
            google?.supports(ExtendedColorControl.Command.MoveToColorHsv) == true ||
            google?.supports(ExtendedColorControl.Command.MoveToColorRgb) == true
    }

    private suspend fun permittedLights(account: String, refresh: Boolean): Map<String, Pair<HomeDevice, ExtendedColorLightDevice>> {
        owner.requireOwner(account)
        check(permission() == PermissionsState.GRANTED) { "Google Home requiere consentimiento oficial antes de buscar o controlar luces." }
        owner.requireOwner(account)
        val home = requireClient()
        if (refresh) home.syncLinkedDevices()
        owner.requireOwner(account)
        val structures = home.structures().list().map { it.id.toString() }.toSet()
        check(structures.isNotEmpty()) { "Google Home no concedió acceso a una casa." }
        val result = linkedMapOf<String, Pair<HomeDevice, ExtendedColorLightDevice>>()
        for (device in home.devices(false).list()) {
            owner.requireOwner(account)
            if (device.structureId.toString() !in structures) continue
            if (!device.has(ExtendedColorLightDevice)) continue
            val light = device.typeOrNull(ExtendedColorLightDevice).first() ?: continue
            if (colorCapable(light)) result[device.id.toString()] = device to light
        }
        owner.requireOwner(account)
        return result
    }

    suspend fun discover(account: String): JSObject = withTimeout(25_000) {
        val lights = permittedLights(account, refresh = true)
        val configuration = preferences.get(account)
        val validSelection = configuration.selectedIds.filter { it in lights }
        if (validSelection != configuration.selectedIds) {
            owner.invalidate()
            preferences.save(account, validSelection, configuration.colorsByState)
            lastSuccessfulSignature = null
        }
        val rows = JSArray()
        lights.forEach { (id, pair) ->
            val device = pair.first
            rows.put(JSObject().put("id", id)
                .put("name", device.name.filterNot(Char::isISOControl).trim().take(100).ifBlank { "Luz Google Home" })
                .put("online", device.sourceConnectivity.connectivityState in setOf(ConnectivityState.ONLINE, ConnectivityState.PARTIALLY_ONLINE))
                .put("colorCapable", true).put("structureId", device.structureId.toString()))
        }
        status(account).put("lights", rows)
    }

    suspend fun save(account: String, ids: List<String>, colors: Map<String, String>): GoogleHomePreferences.Configuration {
        owner.requireOwner(account)
        val validated = GoogleHomePolicy.selected(ids)
        val normalized = GoogleHomePolicy.colors(colors)
        if (validated.isNotEmpty()) {
            GoogleHomePolicy.requireAuthorizedSelection(validated, withTimeout(25_000) { permittedLights(account, false).keys })
        }
        owner.requireOwner(account)
        owner.invalidate()
        lastSuccessfulSignature = null
        return preferences.save(account, validated, normalized)
    }

    private suspend fun checkCurrent(ticket: GoogleHomeOwnerScope.Ticket, configRevision: String, structureId: String? = null) {
        check(isForeground()) { "VISO debe estar activa para sincronizar luces." }
        check(owner.isCurrent(ticket) && preferences.get(ticket.account).revision == configRevision) { "La solicitud VISO fue reemplazada." }
        check(permission() == PermissionsState.GRANTED) { "Google Home revocó o perdió el consentimiento." }
        val grantedStructures = withTimeout(8_000) { requireClient().structures().list().map { it.id.toString() }.toSet() }
        check(grantedStructures.isNotEmpty() && (structureId == null || structureId in grantedStructures)) {
            "Google Home ya no concede acceso a una casa."
        }
        check(isForeground()) { "VISO debe estar activa para sincronizar luces." }
        check(owner.isCurrent(ticket) && preferences.get(ticket.account).revision == configRevision) { "La solicitud VISO fue reemplazada." }
    }

    /** STATUS' supported HS/HSV/RGB commands, always guarded before each request. */
    private suspend fun applyColor(
        ticket: GoogleHomeOwnerScope.Ticket, config: GoogleHomePreferences.Configuration,
        light: ExtendedColorLightDevice, structureId: String, hex: String
    ) {
        val rgb = Color.parseColor(hex)
        val hsv = FloatArray(3)
        Color.colorToHSV(rgb, hsv)
        val matter = light.standardTraits.colorControl
        val google = light.googleTraits.extendedColorControl
        val supportsHs = hsv[2] > 0f && matter?.supports(ColorControl.Command.MoveToHueAndSaturation) == true
        val supportsHsv = google?.supports(ExtendedColorControl.Command.MoveToColorHsv) == true
        val supportsRgb = google?.supports(ExtendedColorControl.Command.MoveToColorRgb) == true
        // Decide that this exact color is expressible before changing any light.
        check(supportsHs || supportsHsv || supportsRgb) { "La luz no admite este color; no se enviaron comandos." }
        checkCurrent(ticket, config.revision, structureId)
        val onOff = light.standardTraits.onOff
        if (hsv[2] > 0f && onOff?.supports(OnOff.Command.On) == true) {
            onOff.on()
            checkCurrent(ticket, config.revision, structureId)
        }
        // HS preserves the light's existing brightness. A black color needs a
        // command that can express value/RGB; HS alone would incorrectly be white.
        if (supportsHs && matter != null) {
            try {
                checkCurrent(ticket, config.revision, structureId)
                matter.moveToHueAndSaturation(
                    ((hsv[0] / 360f) * 254f).roundToInt().coerceIn(0, 254).toUByte(),
                    (hsv[1] * 254f).roundToInt().coerceIn(0, 254).toUByte(),
                    0.toUShort(), ColorControlTrait.OptionsBitmap(), ColorControlTrait.OptionsBitmap()
                )
                return
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { checkCurrent(ticket, config.revision, structureId) }
        }
        if (supportsHsv && google != null) {
            try {
                checkCurrent(ticket, config.revision, structureId)
                google.moveToColorHsv(hsv[0], hsv[1], hsv[2])
                return
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { checkCurrent(ticket, config.revision, structureId) }
        }
        if (supportsRgb && google != null) {
            checkCurrent(ticket, config.revision, structureId)
            google.moveToColorRgb(Color.red(rgb).toUByte(), Color.green(rgb).toUByte(), Color.blue(rgb).toUByte())
            return
        }
        error("La luz no acepta un comando compatible para este color.")
    }

    suspend fun apply(ticket: GoogleHomeOwnerScope.Ticket, state: String?, revision: String): JSObject = commandMutex.withLock {
        if (!isForeground()) return@withLock skipped("application-inactive")
        if (!owner.isCurrent(ticket)) return@withLock skipped("superseded")
        if (state == null) return@withLock skipped("no-state")
        require(state in GoogleHomePolicy.stateKeys) { "El estado VISO no es válido." }
        require(revision.length in 1..512 && revision.none(Char::isISOControl)) { "La revisión VISO no es válida." }
        val config = preferences.get(ticket.account)
        if (!config.enabled) return@withLock skipped("no-selected-lights")
        val signature = "${ticket.account}|${ticket.generation}|$state|$revision|${config.revision}"
        if (signature == lastSuccessfulSignature) return@withLock skipped("already-applied")
        val devices = withTimeout(25_000) { permittedLights(ticket.account, false) }
        if (!owner.isCurrent(ticket)) return@withLock skipped("superseded")
        val limit = Semaphore(4)
        val results = coroutineScope {
            config.selectedIds.map { id -> async(Dispatchers.IO) {
                limit.withPermit {
                    val row = JSObject().put("id", id).put("success", false).put("commanded", false).put("confirmed", false)
                    try {
                        checkCurrent(ticket, config.revision)
                        val target = devices[id] ?: error("La luz ya no está disponible o no admite color.")
                        withTimeout(20_000) {
                            applyColor(ticket, config, target.second, target.first.structureId.toString(), config.colorsByState.getValue(state))
                        }
                        // The API acknowledged the command; no physical observation is fabricated.
                        row.put("success", true).put("commanded", true)
                    } catch (cancelled: CancellationException) { throw cancelled }
                    catch (_: Exception) {
                        row.put("error", if (!owner.isCurrent(ticket)) "La solicitud fue reemplazada."
                            else "Google Home no aceptó el color. Revisá permisos, conexión y compatibilidad de esta luz.")
                    }
                    row
                }
            } }.awaitAll()
        }
        val accepted = results.isNotEmpty() && results.all { it.getBoolean("success") }
        if (accepted && owner.isCurrent(ticket) && preferences.get(ticket.account).revision == config.revision) {
            lastSuccessfulSignature = signature
        }
        JSObject().put("applied", accepted).put("skipped", false).put("results", JSArray(results))
    }

    fun disconnect(account: String): GoogleHomePreferences.Configuration {
        owner.requireOwner(account)
        owner.invalidate()
        lastSuccessfulSignature = null
        return preferences.clearSelection(account)
    }

    fun skipped(reason: String) = JSObject().put("applied", false).put("skipped", true)
        .put("reason", reason).put("results", JSArray())
}
