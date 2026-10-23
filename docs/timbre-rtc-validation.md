# Validación de llamadas VISO Timbre

Última comprobación: **23 de octubre de 2026, 03:48 UTC**. Rama de trabajo: `feat/viso-timbre`.

Revisión visual posterior de administración: **23 de octubre, 12:12 UTC**, con el backend local actualizado a los esquemas finales de diseños QR, notificaciones y suscripciones. La evidencia de videollamada conserva su fecha y alcance originales.

## Resultado comprobado

Se completó una videollamada bidireccional desde la interfaz real de VISO, usando dos contextos de navegador aislados, el backend Convex local y coturn 4.6.3 local. La señalización pasó por las funciones y tablas reales de Timbre. Los dos extremos usaron candidatos **relay**; se recibieron paquetes de audio y se decodificaron cuadros de video en ambos.

La prueba usó cámara y micrófono sintéticos de Chromium y una licencia de prueba insertada exclusivamente en la base local. **No demuestra un pago real, una conexión entre redes físicas diferentes, recepción Android con la aplicación cerrada ni funcionamiento en un teléfono real.** No se desplegaron estas funciones ni se cargaron datos en un backend alojado para esta validación.

Evidencias sin credenciales ni SDP:

- [Prueba de la interfaz y backend reales](validation/timbre-ui-local.json).
- [Prueba aislada de transporte TURN](validation/timbre-rtc-relay-local.json).

## Recorrido real de la interfaz

1. Se inició un binario Convex independiente en `127.0.0.1:3320`, con HTTP Actions en `127.0.0.1:3321`, una base SQLite nueva y claves locales propias.
2. Se cargó una copia del backend contra esa dirección explícita mediante configuración `CONVEX_SELF_HOSTED_URL` de loopback. El proyecto alojado habitual y sus variables no fueron usados.
3. Se creó una cuenta de prueba mediante `auth:signIn` con el flujo Password existente. Un fixture interno, presente sólo en la copia local, preparó un plan, licencia, vivienda, miembro, QR y estados sintéticos.
4. Vite ejecutó el código de la aplicación con `VITE_CONVEX_URL=http://127.0.0.1:3320`. El residente inició sesión desde la interfaz de VISO. El visitante abrió `/t/:qr` sin autenticación, en otro contexto de Chromium.
5. Antes de pulsar los botones no se solicitó cámara ni micrófono a ninguno de los dos participantes. El visitante pulsó **Videollamar** y el residente **Atender** en `/timbre/call/:callId`.
6. El estado opcional de aviso de puerta se activó durante el timbrado. Al atender, quedó una única fuente de presencia `timbre`, sin la fuente de timbrado.
7. Se comprobó `connectionState=connected`, candidatos locales y remotos de tipo `relay` y recepción real de RTP. La medición corta registró 6.520/6.172 bytes de audio y 41.636/92.163 bytes de video; se decodificaron 44/46 cuadros.
8. **Finalizar** cerró la llamada en ambas interfaces, detuvo todas las pistas de cámara y micrófono, borró SDP/ICE del backend y restituyó el estado inicial **Libre** mediante el coordinador de presencia. No hubo errores de página.

Las cifras de RTP son evidencia de intercambio de medios en esa ejecución; no constituyen una medición de calidad de servicio ni de capacidad concurrente.

## Transporte y configuración de servicio

Las llamadas de audio y video requieren estas variables en el backend que vaya a prestar el servicio:

| Variable             | Contenido                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `TIMBRE_TURN_URLS`   | Lista JSON o separada por comas de URLs `turn:`/`turns:` del servidor contratado. Puede indicar `?transport=udp` o `?transport=tcp`. |
| `TIMBRE_TURN_SECRET` | Secreto REST compartido con coturn; mínimo de 32 caracteres. Nunca se envía al cliente.                                              |

Sin una configuración válida, el backend rechaza crear llamadas de audio/video y la interfaz no solicita permisos para esas modalidades. El chat conserva su comprobación independiente de licencia y configuración de la vivienda.

`getRtcConfiguration` autoriza al participante de una llamada aceptada y emite credenciales TURN REST HMAC-SHA1 ligadas al ID opaco de llamada y al rol. El vencimiento firmado corresponde al fin de la llamada autorizado por el servidor más un minuto de margen, con un máximo de 21 minutos desde la emisión. Así la credencial no vence a los cinco minutos durante una llamada admitida de hasta 20 minutos. La política del peer es `iceTransportPolicy: "relay"`. No hay una consulta pública de credenciales de proveedor. Esto no garantiza la duración en redes físicas ni agrega reinicio ICE o renegociación; una conexión fallida requiere iniciar otra llamada.

Chromium de este entorno tiene la política administrada `WebRtcIPHandling=disable_non_proxied_udp`. El primer intento con TURN por UDP no produjo candidatos. Se mantuvo esa política y la prueba se completó con **TURN por TCP**. La configuración efímera de coturn permitía peers de loopback para la prueba local; ese ajuste no forma parte del backend ni es una configuración recomendada para un servidor público.

Para repetir la prueba se debe preparar otra instancia local con el binario directamente, o usar explícitamente una configuración self-hosted de loopback. No se debe ejecutar `convex dev --configure new` para obtener una instancia aislada: ese comando puede crear un proyecto remoto aunque se solicite un despliegue local.

## Pruebas automatizadas

Comando ejecutado:

```sh
node node_modules/vitest/vitest.mjs run \
  convex/timbre_calls.test.ts \
  convex/lib/timbre_rtc.test.ts \
  convex/timbre_presence.test.ts \
  convex/automatic_presence.test.ts \
  convex/background_presence.test.ts --maxWorkers=2

node node_modules/typescript/bin/tsc --noEmit -p convex/tsconfig.json --pretty false
```

Resultado: **42 pruebas aprobadas en cinco archivos**, y comprobación TypeScript del backend sin errores. La repetición del 23 de octubre a las 04:00 UTC incluye la corrección del vencimiento TURN; la llamada real breve documentada arriba corresponde a la ejecución de las 03:48 UTC.

La suite verifica autorización del visitante mediante una capacidad aleatoria de 256 bits almacenada sólo como hash; separación de miembros y unidades; licencia vigente en comunicación e historial; revocación de QR; horarios, silencio y límites de frecuencia; destinatarios primarios y alternativos explícitos; primer usuario que atiende; roles de oferta/respuesta; validación y tamaño de SDP/ICE; credenciales TURN temporales; llamadas perdidas y caducidad de peers; bloqueo de visitantes; permisos de chat y mensajes; restauración de presencia sin pisar cambios manuales; y coexistencia con telefonía/reuniones.

## Revisión visual de administración

Se sincronizó el código final contra la misma instancia self-hosted de loopback y se revisaron cuentas sintéticas con y sin licencia. No se configuraron cobros ni se enviaron transacciones. El importe del catálogo capturado es un fixture identificado como validación local; no es una oferta comercial de VISO.

La interfaz cargó sin errores de página ni desbordamiento horizontal a 1440 y 390 píxeles. La cuenta sin licencia mostró la condición de pago y no ofreció crear un Timbre. Los diseños se generaron en la vista previa y se conservaron dentro del área disponible. Los PNG no contienen credenciales, tokens de autenticación ni datos de clientes; el QR pertenece a un fixture que sólo existe en la base local.

| Vista                          | Escritorio                                              | Móvil                                                  |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------ |
| Timbre del propietario         | [Captura](validation/timbre-owner-desktop.png)          | [Captura](validation/timbre-owner-mobile.png)          |
| Primera vista de la aplicación | [Captura](validation/timbre-owner-desktop-viewport.png) | [Captura](validation/timbre-owner-mobile-viewport.png) |
| Disponibilidad y avisos        | [Captura](validation/timbre-settings-desktop.png)       | [Captura](validation/timbre-settings-mobile.png)       |
| Editor QR                      | [Captura](validation/timbre-qr-editor-desktop.png)      | [Captura](validation/timbre-qr-editor-mobile.png)      |
| Vista previa imprimible        | [Captura](validation/timbre-qr-preview-desktop.png)     | [Captura](validation/timbre-qr-preview-mobile.png)     |
| Cuenta sin licencia            | [Captura](validation/timbre-unlicensed-desktop.png)     | [Captura](validation/timbre-unlicensed-mobile.png)     |
| Catálogo de planes y placas    | [Captura](validation/timbre-catalog-desktop.png)        | [Captura](validation/timbre-catalog-mobile.png)        |

[Resultado automatizado de la revisión visual](validation/timbre-visual-local.json). Las capturas de página completa muestran la navegación móvil fija en su posición de viewport; también se incluye una captura del viewport inicial para evaluar la vista habitual del teléfono.

## Límites y pruebas pendientes antes de habilitar el servicio

- Contratar/configurar TURN público y verificar audio/video con Wi-Fi y red móvil independientes. La prueba local de relay no sustituye esa comprobación.
- Configurar Firebase y probar la APK en teléfonos reales para notificaciones con la aplicación en segundo plano/cerrada, expiración, rechazo, permisos y ahorro de batería. El transporte nativo preparado depende del proveedor; no se validó entrega FCM en esta prueba.
- Comprobar Safari/iOS y otros navegadores por separado. No se agregó una aplicación iOS.
- Validar duración, desconexiones, cambios de red y concurrencia con el proveedor real. Esta prueba corta no es una prueba de carga.
- Validar el circuito de cobro con un pago confirmado real y su revocación. El fixture local sólo permite comprobar el comportamiento técnico de una licencia ya activa.

La limpieza de una llamada sigue permitida a sus participantes después de revocar la licencia o el QR, para liberar presencia y medios. Esa excepción no permite nuevas señales, mensajes ni credenciales. SDP/ICE se borra al terminar; los cuerpos de mensajes caducan a los 30 días y el metadato de llamadas a los 90 días.
