package com.viso.deck
import android.content.Context
/** Background commands still require the SDK's live grant and selected-device checks. */
internal object GoogleHomeBackground {
 private val owner=GoogleHomeOwnerScope()
 private var adapter:GoogleHomeAdapter?=null
 private var account:String?=null
 @Synchronized private fun get(context:Context,next:String):GoogleHomeAdapter {
  if(account!=next||adapter==null){owner.activate(next);account=next;adapter=GoogleHomeAdapter(context.applicationContext,owner,GoogleHomePreferences(context)){BackgroundPresenceService.running&&account==next}.also{it.registerBackground()}}
  return adapter!!
 }
 suspend fun apply(context:Context,account:String,name:String?,color:String?,revision:String){
  val home=get(context,account)
  val normalized=name?.trim()?.uppercase(java.util.Locale.ROOT)
  val state=when(normalized){"LIBRE"->"libre";"OCUPADO"->"ocupado";"REUNIÓN","REUNION"->"reunion";"LLAMADA","EN LLAMADA"->"llamada";"NO MOLESTAR"->"no-molestar";"AUSENTE"->"ausente";else->null}
  if(!GoogleHomePreferences(context).get(account).enabled)return
  val result=home.apply(owner.begin(account),state,"background:$revision",if(state==null&&name!=null)color else null)
  check(result.optBoolean("applied")||result.optBoolean("skipped"))
 }
 fun invalidate(){owner.invalidate()}
 @Synchronized fun close(){owner.activate(null);adapter=null;account=null}
}
