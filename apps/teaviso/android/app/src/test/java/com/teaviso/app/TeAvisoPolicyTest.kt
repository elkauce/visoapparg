package com.teaviso.app

import org.junit.Assert.*
import org.junit.Test

class TeAvisoPolicyTest {
 @Test fun restrictsExternalNavigation() {
   assertEquals("https", TeAvisoPolicy.browserUrl("https://vivid-nightingale-785.convex.site/api/auth/signin/google?code=test").scheme)
   for(value in listOf("javascript:alert(1)","file:///data/data/com.teaviso.app","https://user:pass@example.com/","http://example.com/","https://example.com/\n")){
     try{TeAvisoPolicy.browserUrl(value);fail(value)}catch(_:IllegalArgumentException){}
   }
   assertEquals("http",TeAvisoPolicy.browserUrl("http://10.0.2.2:3211/",true).scheme)
   try{TeAvisoPolicy.browserUrl("http://example.com/",true);fail()}catch(_:IllegalArgumentException){}
 }
 @Test fun isolatesAuthenticationStorageFromUnrelatedKeys() {
   assertTrue(TeAvisoPolicy.authKey("__convexAuthJWT_vividnightingale785"))
   assertTrue(TeAvisoPolicy.authKey("teaviso:native-google-attempt"))
   assertTrue(TeAvisoPolicy.authKey("teaviso:native-google-callback"))
   for(key in listOf("ha_token","viso:native-google-attempt","../../config","teaviso:native-google-attempt\n"))assertFalse(TeAvisoPolicy.authKey(key))
 }
 @Test fun exportsOnlyExplicitQrFormatsAndSafeFilenames() {
   assertTrue(TeAvisoPolicy.exportName("mi-casa-poster.png","image/png"))
   assertTrue(TeAvisoPolicy.exportName("qr.svg","image/svg+xml"))
   assertFalse(TeAvisoPolicy.exportName("../qr.png","image/png"))
   assertFalse(TeAvisoPolicy.exportName("qr.html","text/html"))
   assertFalse(TeAvisoPolicy.exportName("qr.png","image/svg+xml"))
 }
 @Test fun dropsForeignAndExpiredNotifications() {
   val payload=mapOf("type" to "timbre_call","ownerId" to "owner","callId" to "abcdefgh1234","kind" to "incoming","expiresAt" to "11000")
   assertNotNull(TimbrePushPolicy.event(payload,"owner",true,1000))
   assertNull(TimbrePushPolicy.event(payload,"other",true,1000))
   assertNull(TimbrePushPolicy.event(payload,"owner",false,1000))
   assertNull(TimbrePushPolicy.event(payload,"owner",true,12000))
 }
}
