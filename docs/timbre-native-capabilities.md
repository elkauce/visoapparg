# VISO Timbre: Android, permisos y presencia

## Lo que implementa este cambio

Timbre permanece dentro de la aplicación VISO existente (`com.viso.deck`). La
videollamada usa WebRTC en primer plano; Capacitor 8 ya gestiona las solicitudes
de permisos de `getUserMedia`. Se agregó `CAMERA` como capacidad opcional: los
dispositivos sin cámara siguen pudiendo instalar la app y responder con audio.
No se captura audio/video al recibir el aviso. El usuario debe abrir y aceptar.
La llamada debe cerrar sus tracks y la conexión al terminar o cambiar de cuenta.

`VisoTimbre` y sus implementaciones de FCM permiten preparar recepción real de
avisos de llamada sin reutilizar el servicio de telefonía. La compilación normal
informa `available:false`; no incluye Firebase Messaging ni habilita el servicio.
Para incluirlo, el operador debe proporcionar la configuración Firebase Android
del proyecto para `com.viso.deck` en `android/app/google-services.json` y compilar
con `VISO_TIMBRE_FCM_ENABLED=1`. No agregar ese archivo al repositorio. El servidor
necesita credenciales FCM HTTP v1 del mismo proyecto; son distintas de la
configuración Android y deben almacenarse únicamente como secretos del backend.

Incluso compilada con Firebase, la inscripción automática está deshabilitada.
Secuencia de activación desde VISO:

1. Verificar `getCapabilities().available` y mostrar una opción de activación.
2. Por acción explícita del usuario, llamar `requestNotifications()`.
3. Si se concedió, obtener `getPushToken()` y registrar el token con el backend
   autenticado, asociado al dispositivo y usuario actuales.
4. Sólo tras registrar correctamente, llamar
   `configure({ ownerId: user._id, enabled: true })`.
5. En cada reanudación con sesión válida volver a obtener y sincronizar el token.
   FCM puede rotarlo con el proceso cerrado; el servicio no puede atribuir un
   token a un usuario sin una sesión autenticada.
6. Al salir de la cuenta, revocar la inscripción en el servidor y llamar
   `configure({ enabled: false })`. El almacenamiento local borra el dueño y
   cancela los avisos pendientes. Los mensajes para otro dueño se descartan.

El backend debe enviar **mensajes data-only**, prioridad Android alta y TTL corto.
Payload permitido por el adaptador:

```json
{
  "type": "timbre_call",
  "kind": "incoming",
  "callId": "identificador_de_llamada",
  "ownerId": "identificador_del_usuario",
  "expiresAt": "timestamp_en_milisegundos"
}
```

`kind` también admite `cancel` para quitar el aviso cuando otra persona atiende,
el visitante cuelga o la llamada expira. La fecha debe seguir vigente y no superar
cinco minutos en el futuro. No enviar direcciones, nombres de visitantes, SDP,
ICE, capacidades privadas ni instrucciones de apertura en la notificación.

El aviso es genérico, privado en la pantalla bloqueada, y abre la Activity de
VISO. No acepta la llamada desde el background. En arranque consultar
`getPendingCall()`; en la app abierta escuchar `timbreNotificationTapped`.
Reconsultar llamada, membresía y licencia autenticadas antes de permitir aceptar;
después consumir `clearPendingCall()`. Un aviso puede llegar tarde o después de
que otro integrante haya atendido. El servidor decide quién obtuvo la llamada.

## Límites que requieren validación física

- No se promete pantalla completa al recibir una llamada: Android 14+ restringe
  los full-screen intents. Se usa un canal de alta importancia con acceso normal
  por toque, respetando permisos, modo No molestar y ajustes del sistema.
- FCM requiere Google Play Services, conectividad y credenciales correctas.
  Android, Samsung y otros fabricantes pueden demorar mensajes. Una aplicación
  detenida por la fuerza no puede garantizar recepción hasta que el usuario la
  vuelva a abrir. No se reemplaza esto con polling de un WebView cerrado.
- No hay servicio de micrófono/cámara en primer plano para continuar una llamada
  con el WebView suspendido o el teléfono bloqueado. `backgroundMedia:false` es
  deliberado. Implementar esa continuidad necesita servicio/permisos tipados,
  audio focus y pruebas de Android 14-16; el servicio telefónico `specialUse`
  existente no cumple esa función.
- No existe objetivo nativo iOS en este repositorio. APNs/CallKit/PushKit necesitan
  implementación y revisión independientes. Safari visitante en primer plano y
  web push no equivalen a recepción VoIP nativa.
- STUN no basta para redes móviles/NAT restrictivo. TURN debe configurarse en el
  backend con credenciales temporales y probarse entre dos redes independientes.
  Nunca empaquetar una contraseña permanente TURN en JavaScript o en la APK.

## Coordinación de estados y luces

`convex/lib/timbre_presence.ts` guarda una sola base por usuario en
`presenceArbiters` y fuentes con lease en `presenceSources`. Teléfono y Timbre
tienen prioridad sobre la señal opcional de timbre; ésta tiene prioridad sobre
agenda. Sólo una llamada Timbre **aceptada** llama a
`beginTimbrePresence`; finalizar/expirar llama a `endTimbrePresence`, idempotente.
Cuando termina una fuente, se mantiene la siguiente fuente viva y la base se
restaura sólo cuando termina la última. Una elección manual, incluso del mismo
estado, invalida la restauración automática durante todo ese episodio.

El propietario puede optar por un estado propio para señalizar cuando suena el
timbre (`ringStatusId`). Por defecto no se modifica ningún estado al sonar.
La fuente `timbre-ring:callId` vence a los 90 s y se elimina al atender o finalizar;
si otra persona atiende, el dueño recupera su base y la presencia de llamada
pertenece a la cuenta de quien atendió. `signalStatusOnAccept` permite desactivar
también la señalización de llamada aceptada; el valor omitido conserva activada
esa opción. Todo usa el mismo arbitraje, sin restauraciones independientes.

El servicio telefónico conserva su contrato HTTP y renueva una lease de 90 s.
La nueva app envía el modo de agenda/llamada cada 30 s mediante el campo opcional
`presenceMode` de `activateAutomaticStatus`. No usa una pila local de restauración.
Las APK anteriores siguen teniendo la API y su control de revisión; deben
actualizarse para la coexistencia completa con Timbre y los heartbeats de agenda.
La señal de agenda sigue representando la franja de un evento; no verifica que
el usuario haya entrado realmente en Meet o Zoom. La telefonía detecta llamadas
del sistema mediante `TelephonyManager`; no detecta todas las llamadas de
WhatsApp, Meet o Zoom. El listener de notificaciones existente es de multimedia.

Las transiciones efectivas usan `setActiveStatus`, conservando las mismas
notificaciones de estado, RGB/Display y webhooks. Dos fuentes con el mismo estado
no repiten el efecto. Google Home conserva su adaptador y selección de luces.
El parpadeo al sonar debe ser una señal transitoria con cancelación y generación,
si en el futuro se implementa una animación específica del dispositivo. La
señalización actual activa un estado/color configurado, sin prometer un efecto
de parpadeo no implementado en los drivers.
El ejecutor nativo de Home actual depende del servicio telefónico, por lo que
una reacción de Home con sólo Timbre y el proceso cerrado requiere trabajo
adicional; no se debe presentar como garantizada por este cambio.

## Validación requerida antes de publicación

La batería de backend cubre ambos órdenes de finalización teléfono/Timbre,
agenda/Timbre, dos llamadas, selección manual distinta e idéntica, expiración,
idempotencia y base borrada. La política nativa comprueba dueño, opt-in, formato y
caducidad de mensajes. Además se requiere en equipos reales:

- Samsung S9/S26 y una tablet sin telefonía; Android 13-16.
- Notificación permitida/denegada, canal deshabilitado y No molestar.
- App en primer plano, fondo, bloqueo, proceso eliminado y force-stop.
- Token rotado, logout, cambio de cuenta y llamada ya atendida.
- Dos redes con TURN, audio/video, permisos revocados y pérdida de conexión.
- Llamada telefónica y agenda solapadas con Timbre en ambos órdenes.
- Google Home realmente vinculado, luces seleccionadas y recuperación de sesión.

No activar comercialmente recepción en background ni continuidad de medios sin
credenciales, distribución apropiada y estas comprobaciones.
