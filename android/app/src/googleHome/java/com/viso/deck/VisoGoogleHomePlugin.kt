package com.viso.deck

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "VisoGoogleHome")
class VisoGoogleHomePlugin : Plugin() {
    private val owner = GoogleHomeOwnerScope()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val commandJobs = mutableSetOf<Job>()
    private lateinit var preferences: GoogleHomePreferences
    private lateinit var home: GoogleHomeAdapter
    private val execution = GoogleHomeExecutionScope(owner)

    override fun load() {
        preferences = GoogleHomePreferences(context)
        home = GoogleHomeAdapter(context, owner, preferences) { execution.canSynchronize() }
        // Called by BridgeActivity.onCreate, before the activity is STARTED.
        home.register(activity)
    }

    private fun account(call: PluginCall) = GoogleHomePolicy.account(call.getString("accountId"))

    private fun operation(call: PluginCall, message: String, action: suspend (String) -> JSObject) {
        scope.launch {
            try { call.resolve(action(account(call))) }
            catch (_: CancellationException) { call.reject("La sesión o solicitud VISO cambió.", "GOOGLE_HOME_CANCELLED") }
            catch (invalid: IllegalArgumentException) { call.reject(invalid.message ?: message, "GOOGLE_HOME_INVALID_CONFIGURATION") }
            catch (failure: Exception) { call.reject(GoogleHomeFailure.describe(message, failure), "GOOGLE_HOME_ACTION_FAILED") }
        }
    }

    @PluginMethod
    fun setActiveAccount(call: PluginCall) {
        activity.runOnUiThread {
            try {
                val account = call.getString("accountId")
                if (owner.activate(account)) {
                    execution.clearBackground()
                    commandJobs.toList().forEach { it.cancel() }
                    commandJobs.clear()
                    home.accountChanged()
                }
                call.resolve()
            } catch (_: Exception) { call.reject("La sesión VISO no es válida.", "GOOGLE_HOME_INVALID_ACCOUNT") }
        }
    }

    @PluginMethod
    fun setBackgroundSync(call: PluginCall) {
        activity.runOnUiThread {
            try {
                execution.setBackground(call.getString("accountId"), call.getBoolean("enabled", false) == true)
                if (!execution.canSynchronize()) pauseCommands()
                call.resolve()
            } catch (_: Exception) { call.reject("La cuenta VISO no permite sincronizar luces en segundo plano.", "GOOGLE_HOME_INVALID_ACCOUNT") }
        }
    }

    private fun pauseCommands() {
        owner.invalidate()
        commandJobs.toList().forEach { it.cancel() }
        commandJobs.clear()
        home.accountChanged()
    }

    @PluginMethod
    fun getStatus(call: PluginCall) = operation(call, "No se pudo comprobar Google Home. Revisá conexión y Google Play.") { account ->
        home.awaitActiveOwner(account)
        owner.requireOwner(account)
        val result = home.status(account)
        owner.requireOwner(account)
        result
    }

    @PluginMethod
    fun authorize(call: PluginCall) = operation(call, "No se pudo vincular Google Home. Revisá la conexión y Google Play; si continúa, contactá al soporte de VISO.") { account ->
        home.authorize(account, call.getBoolean("force", false) == true)
    }

    @PluginMethod
    fun discoverLights(call: PluginCall) = operation(call, "No se pudieron buscar luces. Autorizá Google Home y revisá conexión y dispositivos compatibles.") { account ->
        home.discover(account)
    }

    @PluginMethod
    fun getConfiguration(call: PluginCall) = operation(call, "No se pudo leer la configuración Google Home.") { account ->
        home.awaitActiveOwner(account)
        owner.requireOwner(account)
        preferences.get(account).json()
    }

    @PluginMethod
    fun saveConfiguration(call: PluginCall) = operation(call, "No se pudo guardar. Buscá nuevamente las luces autorizadas y revisá los seis colores.") { account ->
        val rawIds = call.getArray("selectedIds") ?: error("Falta selección de luces.")
        val rawColors = call.getObject("colorsByState") ?: error("Faltan colores VISO.")
        val keys = rawColors.keys().asSequence().toSet()
        require(keys == GoogleHomePolicy.stateKeys) { "Configurá únicamente los seis estados VISO." }
        val ids = (0 until rawIds.length()).map { rawIds.getString(it) }
        val colors = GoogleHomePolicy.stateKeys.associateWith { rawColors.getString(it) ?: error("Falta un color VISO.") }
        home.save(account, ids, colors).json()
    }

    @PluginMethod
    fun applyState(call: PluginCall) {
        activity.runOnUiThread {
            try {
                val ticket = owner.begin(account(call))
                val state = call.getString("stateKey")
                val revision = call.getString("revision") ?: ""
                val job = scope.launch {
                    try { call.resolve(home.apply(ticket, state, revision, call.getString("customColor"))) }
                    catch (_: CancellationException) { call.resolve(home.skipped("account-or-visibility-changed")) }
                    catch (failure: Exception) { call.reject(GoogleHomeFailure.describe("No se pudo aplicar el estado a Google Home. Revisá consentimiento, conexión y selección de luces", failure), "GOOGLE_HOME_ACTION_FAILED") }
                }
                commandJobs.add(job)
                job.invokeOnCompletion { commandJobs.remove(job) }
            } catch (_: Exception) { call.resolve(home.skipped("inactive-account")) }
        }
    }

    @PluginMethod
    fun disconnect(call: PluginCall) = operation(call, "No se pudo pausar Google Home para esta cuenta VISO.") { account ->
        home.disconnect(account).json()
    }

    override fun handleOnDestroy() {
        execution.setForeground(false)
        execution.clearBackground()
        owner.activate(null)
        scope.cancel()
    }

    override fun handleOnResume() { execution.setForeground(true) }

    override fun handleOnPause() {
        // Calls and meeting apps can cover an opted-in Deck. Its account and
        // selected-light permission checks remain valid while this process lives.
        // Otherwise pause immediately; resume never reactivates a logged-out owner.
        execution.setForeground(false)
        if (!execution.canSynchronize()) pauseCommands()
    }
}
