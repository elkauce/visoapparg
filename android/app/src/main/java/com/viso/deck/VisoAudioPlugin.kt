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
                        val values=bytes.map { ((it.toInt() and 255)-128)/128.0 }
                        emit(null, waveform, null, sqrt(values.map { it*it }.average()),values.maxOf { abs(it) })
                    }
                    override fun onFftDataCapture(v: Visualizer?, bytes: ByteArray?, rate: Int) {
                        if (!running || epoch != generation || bytes == null) return
                        val sampleRate = (rate / 1000).coerceAtLeast(1)
                        val frequencies = frequencies(sampleRate, bytes.size)
                        val bands = FloatArray(32) { i ->
                            val bin = (frequencies[i] * bytes.size / sampleRate).toInt().coerceIn(1, bytes.size/2-1)
                            sqrt((bytes[2*bin].toInt()*bytes[2*bin].toInt()+bytes[2*bin+1].toInt()*bytes[2*bin+1].toInt()).toDouble()).toFloat()/128f
                        }
                        emit(bands, null, frequencies)
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
                        val frequencies = frequencies(16000,count)
                        val windowed = FloatArray(count) { j -> (buffer[j]/32768f)*(0.5-0.5*kotlin.math.cos(2*Math.PI*j/(count-1).coerceAtLeast(1))).toFloat() }
                        val bands = FloatArray(32) { i ->
                            val step = 2*Math.PI*frequencies[i]/16000
                            val cs=kotlin.math.cos(step); val sn=kotlin.math.sin(step)
                            var re=0.0;var im=0.0;var co=1.0;var si=0.0
                            for(j in 0 until count){re+=windowed[j]*co;im-=windowed[j]*si;val next=co*cs-si*sn;si=si*cs+co*sn;co=next}
                            (4*sqrt(re*re+im*im)/count).toFloat().coerceIn(0f,1f)
                        }
                        if (running && generation == epoch) {
                            var sum=0.0;var peak=0.0
                            for(j in 0 until count){val value=buffer[j]/32768.0;sum+=value*value;peak=kotlin.math.max(peak,abs(value))}
                            emit(bands, wave, frequencies,sqrt(sum/count),peak)
                        }
                    }
                }.also { it.name = "VISO-vumeter"; it.start() }
            }
            call.resolve(JSObject().put("source",call.getString("source")))
        } catch (_: Exception) {
            shutdown()
            call.reject(if (call.getString("source") == "music") "Android no permite medir esta salida musical en este dispositivo. Probá la fuente Micrófono." else "No se pudo iniciar el micrófono. Revisá el permiso de audio y otras aplicaciones que lo usen.")
        }
    }
    private fun frequencies(rate: Int,size: Int) = FloatArray(32) { i ->
        val desired = 32*kotlin.math.exp(kotlin.math.ln(kotlin.math.min(16000.0,rate/2.0)/32)*i/31)
        kotlin.math.round(desired*size/rate).coerceIn(1.0,(size/2-1).coerceAtLeast(1).toDouble()).toFloat()*rate/size
    }
    private fun emit(bands: FloatArray?, wave: FloatArray?, frequencies: FloatArray? = null, level: Double? = null, peak: Double? = null) {
        val data = JSObject()
        if (bands != null) data.put("bands",JSArray(bands.toList()))
        if (frequencies != null) data.put("bandFrequencies",JSArray(frequencies.toList()))
        if (wave != null) {
            data.put("wave",JSArray(wave.toList()))
            val rms = (level ?: sqrt(wave.map { it*it }.average())).coerceAtLeast(0.000001)
            data.put("peak",peak ?: wave.maxOf { abs(it.toDouble()) });
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
