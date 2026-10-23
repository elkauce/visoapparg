# Preparar avisos Android para Timbre

Para notificar una llamada a Android se utiliza **Firebase Cloud Messaging (FCM)**, un servicio sin cargo por el envío de mensajes según los [precios de Firebase](https://firebase.google.com/pricing). No es necesario usar las bases de datos, Storage, Functions ni otros productos pagos de Firebase. Las cuentas y los datos de VISO siguen en Convex; el audio y el video usan TURN.

## Configuración que queda pendiente

1. Entrar en [Firebase Console](https://console.firebase.google.com/), crear un proyecto en el plan sin costo **Spark** o agregar Firebase a un proyecto Google Cloud existente. No sustituir las credenciales de Google Home ni el inicio Google de VISO. FCM no requiere activar los otros servicios pagos de Firebase.
2. Registrar la aplicación Android con el identificador exacto **`com.viso.deck`**.
3. Descargar su archivo real `google-services.json` y colocarlo en `android/app/google-services.json`. El archivo está fuera de Git. No crear uno con datos inventados para habilitar la compilación.
4. Verificar que la API **Firebase Cloud Messaging HTTP v1** esté habilitada. Seguir la [configuración oficial Android](https://firebase.google.com/docs/cloud-messaging/android/client) y la [autorización del servidor](https://firebase.google.com/docs/cloud-messaging/auth-server).
5. Preparar una cuenta de servicio del mismo proyecto con permiso para enviar mensajes FCM. Guardar el JSON privado completo únicamente en la variable Convex **`TIMBRE_FCM_SERVICE_ACCOUNT`**. La sección de configuración de Timbre tiene el acceso al despliegue correcto. No poner la clave privada en `google-services.json`, Vercel ni variables `VITE_`.
6. Compilar una APK nueva con **`VISO_TIMBRE_FCM_ENABLED=1`** y el archivo Android real. Asignar una versión nueva y mantener el certificado de firma compatible antes de distribuirla. La APK actual sin FCM no cambia por guardar una variable en el servidor.
7. Instalarla, entrar con la cuenta correspondiente y activar los avisos de Timbre concediendo permiso de notificaciones. El dispositivo debe registrarse en la sesión de esa cuenta.

## Comprobación física

Probar una llamada con la app abierta, en segundo plano y con la pantalla bloqueada; comprobar también el rechazo, la cancelación, el cierre de sesión y el cambio de cuenta. Tener un JSON válido no certifica que el teléfono reciba notificaciones. Forzar la detención de Android o ciertas restricciones del fabricante pueden impedirlas.

El aviso permite abrir VISO y atender después de revalidar la llamada; no enciende automáticamente cámara ni micrófono. La implementación actual no garantiza mantener una llamada de audio/video con el WebView suspendido. No hay una aplicación iOS nativa con APNs/CallKit en esta rama.

La guía complementaria [Cloudflare y llamadas](timbre-cloudflare.md) prepara el transporte de medios. FCM y TURN son configuraciones distintas; ninguna crea licencias, cobra al usuario o publica la web por sí sola.
