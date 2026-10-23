# VISO 1.16: entrega de web y Android

Entrega del 23 de octubre de 2026, autorizada al pedir continuar con todo y entregar una versión utilizable. Trabajo en `feat/viso-timbre`; `main` se conserva. La web y la APK comparten cuentas y el backend `vivid-nightingale-785`.

## Enlaces

- [Web pública](https://viso-deck-android.vercel.app/).
- [Administración de Timbre](https://viso-deck-android.vercel.app/timbre): ingresar con la cuenta autorizada y abrir Administración → Conexión de llamadas.
- [APK 1.16.0 inmutable](https://raw.githubusercontent.com/elkauce/visoapparg/28a928e8c9d1928ba3eb2e8df0f52e0673138272/downloads/VISO-Deck-1.16.0-debug.apk).
- [Variables privadas del backend](https://dashboard.convex.dev/d/vivid-nightingale-785/settings/environment-variables).

## Alcance publicado

La web incorpora Timbre en la navegación y el marketplace existentes: inmuebles, integrantes, unidades, QR personalizados, mensajes, historial, administración comercial y configuración de servicios. Las operaciones del servicio conservan sus comprobaciones de licencia, permisos y disponibilidad; publicar las pantallas no concede acceso gratuito. El QR y el botón de descarga del panel apuntan a la APK 1.16.0.

La APK es `com.viso.deck`, `versionCode 27`, `versionName 1.16.0`, compilación debug para pruebas. Conserva el certificado de 1.15.0, el SDK Google Home revisado y el backend compartido. Agrega cámara como capacidad opcional para la comunicación de Timbre; los dispositivos sin cámara pueden seguir instalando. No incorpora claves de Cloudflare ni una cuenta de servicio Firebase. La verificación de firma no sustituye una instalación física ni una revisión de Play Protect.

## Estado real de activación

Al publicar se comprobó que los dos campos privados de Cloudflare y la cuenta de servicio FCM seguían vacíos, y no existían planes ni licencias Timbre. Por eso **las llamadas reales de Timbre siguen sin estar activadas**. La administración está disponible para completar esa configuración.

| Capacidad                                  | Estado de esta entrega                                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Web, panel y acceso a Timbre               | Publicados en el dominio estable.                                                                                                 |
| APK con navegación y administración Timbre | Descargable, firmada y compilada; no comprobada en un teléfono físico durante esta entrega.                                       |
| Audio/video entre visitante y residente    | Implementado y comprobado anteriormente en laboratorio local; pendiente de Cloudflare real, licencia válida y prueba entre redes. |
| Recepción con la web o app abierta         | Implementada para cuentas destinatarias y llamadas autorizadas; pendiente de prueba productiva una vez activado el servicio.      |
| Avisos Android en segundo plano            | FCM desactivado en esta APK. Requiere configuración Firebase del proyecto y nueva compilación compatible.                         |
| Planes, licencias y cobros                 | Administrables; no se inventaron precios, registraron pagos ni otorgaron licencias gratuitas. Los cobros permanecen desactivados. |

Firebase Cloud Messaging no cobra por el envío de estos avisos. Su archivo Android y su cuenta de servicio del servidor son requisitos de configuración, no una contratación de otros productos Firebase. La [guía Firebase](timbre-firebase.md) explica los pasos. La [guía Cloudflare](timbre-cloudflare.md) identifica los campos ya creados en Convex; no es necesario cambiar código por cargar después esas credenciales del servidor.

## Verificaciones

- Suite de revisión: 895 pruebas en 94 archivos. Proveedores de pago, Cloudflare y FCM simulados en las pruebas de código.
- Android: 27 pruebas JUnit, `assembleDebug` aprobado y certificado coincidente con 1.15.0.
- APK pública: HTTP 200, 22.562.751 bytes y SHA-256 `798284ef8035aa93f5b4b8135933b1c63db7fe2ea4999f25d2557295eed50cbb`.
- Web: compilación aprobada y comparación de sus 93 archivos con el despliegue de revisión antes de promoverlo. La comprobación del dominio estable y sus rutas se registra en [el informe web](validation/timbre-web-1.16.json).
- [Informe Android](validation/timbre-android-1.16.json): versión, firma, permisos, SDK Home y ausencia de instaladores anidados o archivos privados.
- La revisión visual local de configuración cubre 1440, 390 y 320 píxeles; no se presenta como una sesión autenticada de producción ni como prueba física de Google Home.

Despliegue web: `dpl_C6ZzNXfd6Y9FL2WXEFySfFFAQpKV`. Fuente del paquete: `28a928e8c9d1928ba3eb2e8df0f52e0673138272`. La verificación estática y los tests no certifican audio/video público ni avisos con la app cerrada.

## Recuperación

La APK anterior [1.15.0](https://raw.githubusercontent.com/elkauce/visoapparg/fix/viso-deck-reference-layout/downloads/VISO-Deck-1.15.0-debug.apk) y el despliegue web anterior `dpl_7P7WbVBNT1u6otZK6ebJiPHS4ctM` se conservan. Android normalmente no permite instalar una versión menor encima de una mayor; no recomendar desinstalar sin evaluar la configuración local del usuario. Para volver atrás en la web puede promoverse el despliegue anterior. El backend conserva las APIs anteriores y la corrección de presencia para APK antiguas; no borrar tablas ni sustituir datos como procedimiento automático de reversión.
