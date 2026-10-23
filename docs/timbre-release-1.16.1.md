# VISO 1.16.1: configuración Android de Firebase

La APK de pruebas incorpora el archivo Android real proporcionado por el propietario para `com.viso.deck` y habilita Firebase Cloud Messaging con `VISO_TIMBRE_FCM_ENABLED=1`. Versión `1.16.1`, código `28`. El archivo `android/app/google-services.json` permanece fuera de Git; el paquete Android contiene sus recursos cliente generados, sin incluir una cuenta de servicio privada.

[Descargar APK 1.16.1](https://raw.githubusercontent.com/elkauce/visoapparg/8fb92f60f1311ea1524eb06c24f85b512a64849e/downloads/VISO-Deck-1.16.1-debug.apk). Descarga HTTP 200 y SHA-256 verificados: `ef6f46eb6f5cd13b38a32af3aa5ca60fd381fbfa1be2691893fc31826219fa0e`. La firma coincide con la de 1.16.0. No se verificó instalación en un teléfono físico durante esta entrega.

## Activar los avisos

1. Guardar el JSON privado completo de la cuenta de servicio **del mismo proyecto Firebase** en `TIMBRE_FCM_SERVICE_ACCOUNT`, dentro de [las variables del backend compartido](https://dashboard.convex.dev/d/vivid-nightingale-785/settings/environment-variables). No enviarlo por chat ni incorporarlo al repositorio.
2. Verificar en Firebase que la API Cloud Messaging HTTP v1 esté habilitada.
3. Instalar esta APK e ingresar con la cuenta destinataria del Timbre. La prueba interna existente conserva su vencimiento; esta actualización no crea licencias ni pagos.
4. Entrar en **Timbre → Avisos de Timbre en Android → Activar avisos de Android** y permitir las notificaciones. El permiso y la inscripción corresponden a esa cuenta y ese teléfono.
5. En otro teléfono/red, abrir el enlace del QR y tocar **Llamar** o **Videollamar**. En el teléfono destinatario, tocar el aviso de VISO y luego **Atender**, permitiendo micrófono/cámara.

## Alcance y comprobación

FCM entrega una notificación Android de prioridad alta y vigencia breve. Al tocarla, VISO revalida la llamada y permite atender. No implementa apertura automática de una pantalla telefónica ni timbrado continuo, y no garantiza mantener audio/video con el WebView suspendido.

La prueba física debe cubrir la app abierta, en segundo plano y el teléfono bloqueado, además de rechazo, cancelación y cambio de cuenta. Una compilación correcta y las pruebas de código no certifican la entrega en un Samsung ni la aceptación de credenciales por Firebase. La recepción también depende del permiso de notificaciones y las restricciones de Android; forzar la detención puede impedirla.

Esta entrega conserva el SDK Google Home, el backend compartido y las integraciones existentes. El código de aplicación no cambió; se habilitó la capacidad ya implementada mediante su configuración Android. La cuenta de servicio del servidor se gestiona por separado. El [informe Android](validation/timbre-android-1.16.1.json) registra las comprobaciones del paquete y sus límites.

Se comprobó que la cuenta de servicio guardada en el servidor pertenece al mismo proyecto del archivo Android. La validación sintáctica no demuestra la autorización de envío ni la entrega física. El diagnóstico interno `timbre_setup:verifyFirebase` comprueba OAuth y realiza exclusivamente una validación FCM HTTP v1 con `validate_only: true`, un tópico fijo y sin tokens de dispositivos. Devuelve sólo indicadores de estado, sin claves, tokens, correos, identificadores de proyecto ni respuestas del proveedor. No envía notificaciones ni crea llamadas.

El 23 de octubre de 2026 el diagnóstico real confirmó coincidencia de proyecto, credenciales OAuth aceptadas y autorización FCM válida. El [informe del proveedor](validation/timbre-firebase-check.json) conserva sólo esos estados. Las pruebas de esta entrega incluyen 912 casos de revisión en 95 archivos, 27 pruebas Android sin fallos, tipos backend/frontend y lint de los archivos backend cambiados. La recepción con el teléfono bloqueado sigue pendiente de una prueba física después de instalar y habilitar los avisos en el dispositivo.

El propietario autorizó actualizar la descarga web y el 23 de octubre de 2026 se publicó el botón y QR de 1.16.1 en [la web estable](https://viso-deck-android.vercel.app). La misma URL inmutable se utiliza en Conexiones, el diálogo del QR y el acceso rápido del panel. La etiqueta visible indica 1.16.1. Se verificaron el componente renderizado, la descarga HTTP 200 y los 93 archivos del despliegue, tanto antes como después de promoverlo al dominio público. El [informe de publicación](validation/timbre-web-1.16.1-download.json) conserva la evidencia y el despliegue previo para reversión. Esta actualización del enlace no sustituye la prueba de notificaciones en el teléfono.

## Reconstrucción

Restaurar el archivo Android real en la ruta ignorada, preparar JDK/SDK y CA/proxy del entorno, suministrar el SDK Google Home revisado mediante `VISO_GOOGLE_HOME_SDK_DIR`, y ejecutar `VISO_TIMBRE_FCM_ENABLED=1 node scripts/build-android.mjs`. Mantener el certificado compatible al distribuir. El archivo privado de la cuenta de servicio se guarda exclusivamente en el backend.
