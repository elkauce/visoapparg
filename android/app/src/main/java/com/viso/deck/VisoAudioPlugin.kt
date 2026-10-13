package com.viso.deck

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.Visualizer
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.sqrt

// Foreground-only, device-local audio. No audio is saved or uploaded.
@CapacitorPlugin(name = "VisoAudio", permissions = [Permission(alias = "audio", strings = [Manifest.permission.RECORD_AUDIO])])
class VisoAudioPlugin : Plugin() {
    private var visualizer: Visualizer? = null
    private var recorder: AudioRecord? = null
    private var reader: Thread? = null
    @Volatile private var running = false
    @Volatile private var epoch = 0

    @PluginMethod fun start(call: PluginCall) {
        if (call.getString("source") !in listOf("music", "microphone")) {
            call.reject("Fuente de audio inválida"); return
        }
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("audio", call, "permissionResult"); return
        }
        begin(call)
    }
    @PermissionCallback private fun permissionResult(call: PluginCall) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Permití el acceso al audio para usar el vúmetro"); return
        }
        begin(call)
    }
    private fun begin(call: PluginCall) {
        shutdown()
        try {
            running = true
            val generation = epoch
            if (call.getString("source") == "music") {
                // Android's official Visualizer effect on the output mix. Some devices
                // or protected playback disallow this; never replace it with fake levels.
                val effect = Visualizer(0)
                visualizer = effect
                effect.captureSize = Visualizer.getCaptureSizeRange()[1].coerceAtMost(1024)
                val result = effect.setDataCaptureListener(object: Visualizer.OnDataCaptureListener {
                    override fun onWaveFormDataCapture(v: Visualizer?, bytes: ByteArray?, rate: Int) {
                        if (!running || epoch != generation || bytes == null) return
                        val waveform = FloatArray(64) { i -> ((bytes[i * bytes.size / 64].toInt() and 255) - 128) / 128f }
                        emit(null, waveform)
                    }
                    override fun onFftDataCapture(v: Visualizer?, bytes: ByteArray?, rate: Int) {
                        if (!running || epoch != generation || bytes == null) return
                        val bands = FloatArray(32) { i ->
                            val start = 2 + i * (bytes.size - 2) / 32
                            val end = 2 + (i + 1) * (bytes.size - 2) / 32
                            var energy = 0.0
                            for (k in start until end - 1 step 2) energy += sqrt((bytes[k].toInt() * bytes[k].toInt() + bytes[k+1].toInt() * bytes[k+1].toInt()).toDouble())
                            (energy / ((end-start)/2).coerceAtLeast(1) / 128).toFloat().coerceIn(0f,1f)
                        }
                        emit(bands, null)
                    }
                }, (Visualizer.getMaxCaptureRate() / 2).coerceAtMost(20000), true, true)
                if (result != Visualizer.SUCCESS || effect.setEnabled(true) != Visualizer.SUCCESS) throw IllegalStateException("La salida musical no está disponible")
            } else {
                val size = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
                if (size <= 0) throw IllegalStateException("Micrófono no disponible")
                val record = AudioRecord(MediaRecorder.AudioSource.MIC, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size.coerceAtLeast(4096))
                recorder = record
                if (record.state != AudioRecord.STATE_INITIALIZED) throw IllegalStateException("No se pudo iniciar el micrófono")
                record.startRecording()
                reader = Thread {
                    val buffer = ShortArray(1024)
                    while (running && generation == epoch) {
                        val count = try { record.read(buffer,0,buffer.size) } catch (_: Exception) { break }
                        if (count <= 0) {
                            if (running && generation == epoch) notifyListeners("audioStopped", JSObject().put("reason", "No se pudo leer el micrófono"))
                            synchronized(this@VisoAudioPlugin) { if (epoch == generation) shutdown() }
                            break
                        }
                        val wave = FloatArray(64) { i -> buffer[i * count / 64] / 32768f }
                        val bands = FloatArray(32) { i ->
                            var energy = 0f
                            val start = i * count / 32; val end = (i+1)*count/32
                            for (j in start until end) energy += abs(buffer[j].toFloat()) / 32768f
                            energy / (end-start).coerceAtLeast(1)
                        }
                        if (running && generation == epoch) emit(bands, wave)
                    }
                }.also { it.name = "VISO-vumeter"; it.start() }
            }
            call.resolve(JSObject().put("source",call.getString("source")))
        } catch (_: Exception) {
            shutdown()
            call.reject(if (call.getString("source") == "music") "Android no permite medir esta salida musical en este dispositivo. Probá la fuente Micrófono." else "No se pudo iniciar el micrófono. Revisá el permiso de audio y otras aplicaciones que lo usen.")
        }
    }
    private fun emit(bands: FloatArray?, wave: FloatArray?) {
        val data = JSObject()
        if (bands != null) data.put("bands",JSArray(bands.toList()))
        if (wave != null) {
            data.put("wave",JSArray(wave.toList()))
            val rms = sqrt(wave.map { it*it }.average()).coerceAtLeast(0.000001)
            data.put("level",rms.coerceAtMost(1.0)); data.put("db",20*log10(rms))
        }
        notifyListeners("audioFrame",data)
    }
    @Synchronized private fun shutdown() {
        running = false; epoch++
        try { visualizer?.enabled = false; visualizer?.release() } catch (_: Exception) {}
        visualizer = null
        val old = recorder; recorder = null
        try { old?.stop() } catch (_: Exception) {}
        try { old?.release() } catch (_: Exception) {}
        reader = null
    }
    @PluginMethod fun stop(call: PluginCall) { shutdown(); call.resolve() }
    override fun handleOnPause() { shutdown(); notifyListeners("audioStopped",JSObject().put("reason","La captura se detuvo al salir de VISO")) }
    override fun handleOnDestroy() { shutdown() }
}
