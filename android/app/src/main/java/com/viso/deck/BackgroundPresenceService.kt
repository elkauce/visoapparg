package com.viso.deck

import android.app.*
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import android.content.Intent
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout

/** Opt-in persistent signaling, independent of the WebView and Deck route. */
@Suppress("DEPRECATION")
class BackgroundPresenceService: Service() {
 companion object {
  val ENDPOINT get()=if(BuildConfig.BUILD_TYPE=="localTest")"http://10.0.2.2:3210/api/mutation" else "https://vivid-nightingale-785.convex.cloud/api/mutation"
  const val CONFIG="presence:background"
  const val STOP="com.viso.deck.STOP_PRESENCE"
  @Volatile var suppressLights=false
  @Volatile var foreground=false
  @Volatile var running=false
  fun revoke(config:JSONObject){
   Thread {
    var c:HttpURLConnection?=null
    try {
     c=URL(ENDPOINT).openConnection() as HttpURLConnection
     c.requestMethod="POST";c.instanceFollowRedirects=false;c.connectTimeout=8000;c.readTimeout=10000;c.doOutput=true;c.setRequestProperty("Content-Type","application/json")
     val payload=JSONObject().put("path","background_presence:signal").put("format","json").put("args",JSONObject().put("secret",config.getString("secret")).put("calling",false).put("disable",true))
     c.outputStream.use{it.write(payload.toString().toByteArray(Charsets.UTF_8))};c.inputStream.use{it.readBytes()}
    }catch(_:Exception){/* A missed call lease expires server-side even offline. */}finally{c?.disconnect()}
   }.start()
  }
 }
 private val worker=Executors.newSingleThreadScheduledExecutor()
 private var listener:PhoneStateListener?=null
 private var manager:TelephonyManager?=null
 @Volatile private var calling=false
 @Volatile private var generation=0
 private var lastColorRevision:String?=null
 private var lastLightError=false
 override fun onBind(intent:Intent?):IBinder?=null
 override fun onCreate(){
  super.onCreate()
  val notifications=getSystemService(NotificationManager::class.java)
  if(Build.VERSION.SDK_INT>=26)notifications.createNotificationChannel(NotificationChannel("viso-presence","Estado automático VISO",NotificationManager.IMPORTANCE_LOW))
  val notification=notification("Detectando llamadas y sincronizando tus luces")
  if(Build.VERSION.SDK_INT>=34)startForeground(3104,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(3104,notification)
  running=true
  try {
   manager=getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
   calling=manager!!.callState!=TelephonyManager.CALL_STATE_IDLE
   listener=object:PhoneStateListener(){override fun onCallStateChanged(state:Int,phoneNumber:String?){calling=state!=TelephonyManager.CALL_STATE_IDLE;GoogleHomeBackground.invalidate();if(!worker.isShutdown)worker.execute{sync()}}}
   manager!!.listen(listener,PhoneStateListener.LISTEN_CALL_STATE)
   worker.scheduleWithFixedDelay({sync()},0,15,TimeUnit.SECONDS)
  }catch(_:Exception){notifications.notify(3104,notification("Falta permiso de llamadas. Abrí VISO para revisarlo."));stopSelf()}
 }
 override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int {
  if(intent?.action==STOP){
   generation+=1;GoogleHomeBackground.invalidate()
   val vault=SecureVault(this);val config=try{vault.get(CONFIG)?.let(::JSONObject)}catch(_:Exception){null}
   config?.optString("accountId")?.let{getSharedPreferences("viso-presence-runtime",0).edit().putString("stoppedAccount",it).apply()}
   // Restore only if the server still owns this call episode; queue behind an in-flight signal.
   if(!worker.isShutdown)worker.execute{calling=false;sync(true);vault.remove(CONFIG);stopSelf()}
   else {vault.remove(CONFIG);stopSelf()}
   return START_NOT_STICKY
  }
  generation+=1;lastColorRevision=null
  if(!worker.isShutdown)worker.execute{sync()}
  return START_STICKY
 }
 private fun notification(message:String):Notification {
  val open=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  val stop=PendingIntent.getService(this,1,Intent(this,BackgroundPresenceService::class.java).setAction(STOP),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  val builder=if(Build.VERSION.SDK_INT>=26)Notification.Builder(this,"viso-presence") else Notification.Builder(this)
  return builder.setSmallIcon(android.R.drawable.ic_menu_call).setContentTitle("VISO activo en segundo plano").setContentText(message).setContentIntent(open).setOngoing(true).addAction(Notification.Action.Builder(null,"Desactivar",stop).build()).build()
 }
 private fun sync(disable:Boolean=false){
  if(!running)return
  val stamp=generation
  val config=try{SecureVault(this).get(CONFIG)?.let(::JSONObject)}catch(_:Exception){null}
  if(config==null){stopSelf();return}
  val account=config.optString("accountId")
  if(!disable&&ContextCompat.checkSelfPermission(this,Manifest.permission.READ_PHONE_STATE)!=PackageManager.PERMISSION_GRANTED){
   calling=false;sync(true);SecureVault(this).remove(CONFIG);getSharedPreferences("viso-presence-runtime",0).edit().putString("stoppedAccount",account).apply();stopSelf();return
  }
  if(config.optLong("expires")<=System.currentTimeMillis()){getSystemService(NotificationManager::class.java).notify(3104,notification("Abrí VISO para renovar la conexión de tu cuenta."));return}
  var connection:HttpURLConnection?=null
  val wake=(getSystemService(Context.POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"VISO:presence-update")
  try {wake.acquire(60000)
   val sentCalling=calling
   val payload=JSONObject().put("path","background_presence:signal").put("format","json").put("args",JSONObject().put("secret",config.getString("secret")).put("calling",if(disable)false else sentCalling).put("disable",disable))
   connection=URL(ENDPOINT).openConnection() as HttpURLConnection
   connection.requestMethod="POST";connection.instanceFollowRedirects=false;connection.connectTimeout=8000;connection.readTimeout=10000;connection.doOutput=true;connection.setRequestProperty("Content-Type","application/json")
   connection.outputStream.use{it.write(payload.toString().toByteArray(Charsets.UTF_8))}
   check(connection.responseCode==200)
   val result=JSONObject(connection.inputStream.bufferedReader().use{it.readText()})
   check(result.optString("status")=="success")
   val value=result.getJSONObject("value")
   check(value.getString("accountId")==account)
   if(stamp!=generation||!running||SecureVault(this).get(CONFIG)?.let{JSONObject(it).optString("secret")}!=config.getString("secret")||sentCalling!=calling)return
   val status=value.optJSONObject("status")
   val revision=value.getLong("revision").toString()
   if(!suppressLights&&!foreground&&revision!=lastColorRevision){
    try {runBlocking {withTimeout(30000){GoogleHomeBackground.apply(this@BackgroundPresenceService,account,status?.optString("name"),status?.optString("color"),revision)}};lastColorRevision=revision;lastLightError=false}
    catch(_:Exception){lastLightError=true}
   }else if(foreground)lastColorRevision=null
   getSystemService(NotificationManager::class.java).notify(3104,notification(if(lastLightError)"Llamadas activas. Revisá permiso o conexión de Google Home." else if(calling)"Llamada detectada · señalización sincronizada" else "Detectando llamadas y sincronizando tus luces"))
  }catch(_:Exception){getSystemService(NotificationManager::class.java).notify(3104,notification("Sin conexión confirmada. VISO volverá a intentar automáticamente."))}
  finally{connection?.disconnect();if(wake.isHeld)wake.release()}
 }
 override fun onDestroy(){running=false;generation+=1;try{listener?.let{manager?.listen(it,PhoneStateListener.LISTEN_NONE)}}catch(_:Exception){};worker.shutdownNow();GoogleHomeBackground.close();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy()}
}
