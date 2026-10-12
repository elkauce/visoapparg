# VISO Deck 1.7.0 — llamadas y reuniones programadas

Actualización incremental de la rama `fix/viso-deck-reference-layout`. No cambia `main`, las tres pantallas predeterminadas, las páginas personales, las teclas RGB independientes, el controlador, los displays, los dispositivos Mini, la comunicación existente ni el plugin Elgato. Deck y Display mantienen la pantalla encendida durante su uso.

## Configuración y comportamiento

En la APK: Deck → estrella de Ajustes → «Estado automático: llamadas y agenda».

La función está desactivada inicialmente. El usuario habilita las llamadas mediante el permiso Android `READ_PHONE_STATE`, y elige individualmente los calendarios ya sincronizados en su celular mediante `READ_CALENDAR`. Las preferencias se guardan por cuenta y dispositivo; se recomienda un detector por cuenta.

Una llamada telefónica entrante o en curso activa LLAMADA. Cuando termina, una reunión programada activa REUNIÓN si sigue en horario; de lo contrario se recupera el estado anterior. Una selección manual posterior, incluso del mismo estado, tiene prioridad y evita la restauración automática. Los cambios se publican mediante el mismo estado compartido de VISO y sus comunicaciones y webhooks existentes.

La agenda usa instancias de eventos del proveedor Android, incluyendo recurrencias y tiempos absolutos. De forma predeterminada reconoce enlaces Meet/Zoom y las palabras reunión/meeting. Hay una opción para incluir todos los eventos ocupados de los calendarios seleccionados. Excluye eventos de todo el día, libres, cancelados y rechazados; considera el inicio inclusivo y el fin exclusivo.

La agenda señala el horario programado, **no acredita asistencia real a Meet/Zoom**. Los eventos creados en una computadora se reconocen cuando estén sincronizados en alguno de los calendarios seleccionados en Android. No requiere otro proyecto Google Cloud ni un nuevo OAuth para Gmail/Zoom; no lee correo. Los calendarios corporativos dependen de su sincronización y de las restricciones del perfil Android administrado.

No se usa el micrófono, no se solicitan números telefónicos, contactos, historial ni permiso de escritura del calendario. El contenido y los nombres de los eventos se procesan localmente y no se envían a Convex. Si una lectura falla, no se inventa una finalización de reunión. Una llamada confirmada tiene prioridad aunque el calendario no pueda leerse.

## Sincronización segura

El backend añade opcionalmente `users.activeStatusRevision`. Todos los cambios normales incrementan la revisión, incluyendo selecciones del mismo estado y eliminación del estado activo. Las APIs nuevas `deck_actions.activateAutomaticStatus` y `deck_actions.getAutomaticReceipt` verifican identidad, propiedad del estado, UUIDs, revisión y aislamiento de la cuenta. Una transacción condicional impide que un cambio automático atrasado sobrescriba una selección manual. Los recibos permiten recuperar una respuesta perdida sin repetir el cambio ni sus webhooks.

Android reevalúa al recibir una señal telefónica, al volver a primer plano y cada 15 segundos mientras está visible. No envía una señal nueva cuando sabe que está desconectado, y descarta lecturas de una configuración o vista anterior. No incorpora un servicio permanente: Android puede suspender o cerrar el proceso. Google Home conserva la protección de cuenta, permisos, luces seleccionadas y primer plano; si la interfaz de llamada desplaza VISO, los comandos de luces pueden esperar hasta que VISO vuelva a primer plano. No se promete funcionamiento con la app cerrada.

## Validación

- 339 pruebas Vitest en 32 archivos aprobadas, incluyendo propiedad/revisión, restauración, reintentos, permisos y selección de calendarios.
- 18 pruebas nativas Android aprobadas en cuatro clases; cero fallos, errores o pruebas omitidas.
- TypeScript del frontend y backend, ESLint y compilación Android aprobados.
- Web de revisión: 62 controles de interacción y diseño responsive aprobados. Chromium concedió un Screen Wake Lock real en la ruta HTTPS del Deck.
- Firma APK verificada. Paquete `com.viso.deck`, versión `1.7.0`, código `12`; misma firma SHA-1 `F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`.
- APK: `downloads/VISO-Deck-1.7.0-debug.apk`, 19.764.397 bytes, SHA-256 `d15b165394347bd0db0cff04411549ebcd521613acd4d13ead57b55b5758717f`.

Web de revisión: https://viso-deck-android-m45dj0mw0-manuelhaguilar8-4981s-projects.vercel.app

## Publicación y prueba pendientes

La web pública no se promovió y el backend compartido `vivid-nightingale-785` no se actualizó: el usuario pidió no publicar sin autorización. Una consulta HTTP de solo lectura confirmó que `statuses:list` sigue disponible y que `getAutomaticReceipt` todavía no está publicado. La APK conserva las funciones existentes, pero **la automatización no puede probarse de extremo a extremo hasta habilitar las dos APIs nuevas en ese backend**. No usar `convex deploy` sin selección explícita, porque puede apuntar al proyecto de producción equivocado. No tocar el backend original `useful-egret-915`.

Después de la autorización: actualizar explícitamente el backend compartido, comprobar sus APIs, promover la web revisada y verificar el dominio público. Luego instalar la APK encima de la actual, sin desinstalar, y probar físicamente una llamada y un evento breve en un calendario seleccionado, observando el Display y exclusivamente las luces autorizadas. Probar también un cambio manual durante la llamada y el retorno desde la interfaz telefónica.

La integración Google Home de versiones anteriores fue confirmada por el usuario en su teléfono; las nuevas señales de llamadas y calendario **siguen pendientes de prueba física**. Se preservan intactos el código estable `af91f0e`, la APK 1.6.1 y su checksum para recuperación. Un APK con código de versión inferior no se ofrece como actualización directa de 1.7.
