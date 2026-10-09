# Funciones nativas de VISO Deck

El frontend existente usa `src/lib/android-native.ts` para invocar `VisoNativePlugin`, registrado en `MainActivity`. El puente informa capacidades reales y rechaza acciones no disponibles. La navegación y el botón Atrás se mantienen en React Router / Capacitor App; la Activity conserva la WebView al cambiar orientación.

## Sesión y seguridad

`secureTokenStorage` implementa `TokenStorage` de Convex Auth. Cada valor se cifra con AES-256-GCM, IV aleatorio y nombre de clave autenticado como AAD. La clave se genera en AndroidKeyStore; no se incluye una clave secreta en la APK. Los SharedPreferences contienen solo ciphertext. El puente limita las operaciones de autenticación al espacio `auth:`; las credenciales de Home Assistant pertenecen a otro espacio y nunca se devuelven a JavaScript. Los mensajes de error son genéricos y no registran excepciones, tokens ni cuerpos HTTP.

La aplicación desactiva copias de seguridad y tráfico HTTP directo. Las URLs externas aceptan HTTP/HTTPS porque se abren en el navegador del usuario, con validación de esquema, host, puerto y ausencia de credenciales. No se aceptan URLs `javascript:`, `file:`, `intent:` ni otros esquemas ejecutables.

El identificador de dispositivo es un UUID aleatorio por instalación; no usa identificadores de hardware. Quitar datos de la aplicación elimina la sesión, la configuración y este identificador.

## Pantalla y acciones Android

El modo inmersivo usa WindowInsetsControllerCompat y permite mostrar temporalmente las barras con un gesto. El área de la WebView reserva los recortes de pantalla y el teclado; fuera del modo inmersivo también reserva las barras del sistema. La configuración Android evita recrear la Activity al rotar.

Abrir una aplicación requiere seleccionarla previamente en el diálogo nativo de aplicaciones permitidas. Solo se consultan aplicaciones con Activity de lanzamiento: no se solicita `QUERY_ALL_PACKAGES`. La lista inicial está vacía. No se permiten componentes arbitrarios ni comandos del sistema.

## Multimedia

Volumen y silenciar actúan sobre `AudioManager.STREAM_MUSIC` mediante `MODIFY_AUDIO_SETTINGS`. No requieren leer notificaciones.

Reproducir/pausar, siguiente y anterior usan `MediaSessionManager`, una sesión activa y sus acciones admitidas. El usuario debe conceder acceso a notificaciones a «VISO · control multimedia» en la configuración Android. El servicio no guarda ni registra contenido de notificaciones. `mediaPermissionGranted` se obtiene del sistema; `activeMediaSessions` y `mediaSession` se calculan a partir de sesiones reales. Abrir la pantalla de permisos no significa conceder permiso. Cada aplicación multimedia decide qué comandos admite; el envío del comando no garantiza un cambio de reproducción si esa aplicación lo rechaza.

## Home Assistant y luces RGB

La configuración requiere una instancia Home Assistant HTTPS con certificado confiable por Android y un token de larga duración de la cuenta que controla esas luces. El usuario introduce ambas cosas en un diálogo Android con contraseña oculta, captura bloqueada, autocompletado desactivado y sin historial de entrada. El frontend no recibe el token. La conexión `/api/` debe autorizarse antes de cifrar y guardar la configuración. HTTP, certificados inválidos y redirecciones se rechazan; nunca se reenvía un bearer token a otro host.

El descubrimiento consulta `/api/states` y devuelve entidades `light.*` reales, disponibilidad, estado y capacidades de color. Los controles llaman los servicios oficiales `light/turn_on` y `light/turn_off`, admiten brillo de 0–100 y color `#RRGGBB` cuando el dispositivo informa modos compatibles. Se verifica la entidad antes de llamar al servicio y se devuelve el estado reportado por Home Assistant después de la confirmación HTTP. Esa respuesta confirma la operación del servidor, no una comprobación visual del hardware físico. No se simulan lámparas ni conexiones.

La configuración guardada empieza como pendiente de verificar en una nueva ejecución. «Conectado» exige una verificación reciente del servidor; el estado no se considera conectado solamente porque exista un token. La integración puede desconectarse desde `disconnectHomeAssistant()`, que elimina la credencial cifrada.

No se ha validado una instancia física porque el entorno no incluye una cuenta o lámparas autorizadas. Escenas y vinculación automática entre estados VISO y luces requieren configuración expresa del usuario; este módulo proporciona acciones individuales.

## Google Home oficial: pendiente

La APK no incluye todavía Google Home SDK ni afirma estar conectada a Google Home. El estado es «pendiente: SDK oficial Home APIs y consentimiento Google en Android». La beta abierta permite pruebas sin registrar la aplicación en Developer Console; publicar una aplicación requiere la aprobación correspondiente. El SDK Home APIs actual se descarga después de iniciar sesión como desarrollador Google: el artefacto anterior de commissioning disponible en Maven no proporciona el SDK Home APIs completo. Las pruebas requieren integrar el SDK oficial y autorizar la cuenta del usuario en un dispositivo Android compatible con dispositivos reales. Home Assistant es una integración HTTPS separada y no reemplaza ese consentimiento oficial.

Referencias: [Google Home APIs para Android](https://developers.home.google.com/apis/android), [Developer Console](https://console.home.google.com/), [REST API de Home Assistant](https://developers.home-assistant.io/docs/api/rest/).

## Validación

Los comandos Gradle se ejecutan desde `android/`.

- `./gradlew :app:testDebugUnitTest`: política de URLs, orígenes HTTPS, allowlist de aplicaciones, IDs de luces, colores, brillo y claves de sesión.
- `./gradlew :app:connectedDebugAndroidTest`: en dispositivo / emulador, prueba AndroidKeyStore, persistencia cifrada, revocación y rechazo de ciphertext alterado.
- Pruebas físicas pendientes: recortes / barras / teclado en diferentes dispositivos, volver desde permisos, aplicaciones seleccionadas, sesiones reales de música y control de lámparas autorizadas.

Las pruebas de instrumentación necesitan un dispositivo disponible. La compilación de esos tests no equivale a ejecutarlos.
