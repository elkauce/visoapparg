# VISO Deck Android 1.2: tres pantallas

La APK de prueba continúa el proyecto actual y conserva el paquete `com.viso.deck`, su certificado, la cuenta, la sincronización VISO y las páginas/teclas guardadas. No se modificaron funciones Convex, el backend alojado ni la web de producción.

[Descargar VISO Deck 1.2](https://raw.githubusercontent.com/elkauce/visoapparg/feature/viso-three-screens/downloads/VISO-Deck-1.2-debug.apk). Instalar como actualización de la APK anterior; no hace falta desinstalar para probarla. Es una compilación debug de prueba, no una publicación de producción.

## Alcance

- **Estados VISO:** LIBRE, OCUPADO, REUNIÓN, LLAMADA, NO MOLESTAR y AUSENTE. La selección espera la confirmación de la sincronización existente. Conserva los estados anteriores y sus identificadores; si falta No molestar se crea solamente al pulsarlo. El editor original permanece accesible, sin convertirse en otra pestaña predeterminada.
- **Spotify:** carátula, canción, artista, progreso y controles de la sesión Android real de Spotify. Requiere conceder acceso a notificaciones y tener Spotify reproduciendo en el teléfono. No utiliza canciones de las referencias ni simula sesiones en el navegador.
- **Standby:** una pantalla con personalización en un diálogo: reloj digital, multicolor/tres tonos, analógico, flip, dúo, música real, fotos privadas locales y widgets de fecha/calendario, estado/conexión y batería disponible. La distribución responde a orientación horizontal y vertical. Las fotos se guardan por cuenta en este dispositivo.
- **Google Home:** diálogo dentro de Estados VISO, sin cuarta pantalla. Reutiliza el SDK oficial recuperado de STATUS/`viso-safe`; solicita consentimiento oficial, descubre luces con comandos de color compatibles y aplica los seis colores editables exclusivamente a los IDs seleccionados. Un observador global recibe cambios VISO de otros clientes mientras la app está activa. Pausar Android, cambiar de cuenta, revocar permisos o cambiar la selección invalida comandos pendientes. Al reanudar, revalida y aplica el estado actual. No exige Home Assistant ni un servidor personal.
- Los dos logos PNG originales del ZIP se incorporaron sin recortarlos ni eliminar su transparencia, en recursos Android y fuente web.

## Google Home: acción necesaria del propietario

No se creó otro proyecto Google Cloud. El cliente existente `com.statusmini.app` no corresponde al paquete de esta APK. En [Google Cloud → clientes OAuth](https://console.cloud.google.com/auth/clients), seleccionar **STATUS**, comprobar si existe y, si falta, añadir un cliente **Android** con:

- Paquete: `com.viso.deck`.
- SHA-1: `F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`.
- Revisar que la cuenta Google usada en el teléfono figure en la audiencia de pruebas.

Conservar el cliente Android anterior. No hay que incorporar secretos OAuth a la APK. No dispongo de una sesión administrativa en la consola privada de STATUS para verificar o efectuar ese cambio. Después, en un teléfono Android 10+ con Google Play, abrir **Estados VISO → Luces Google Home**, autorizar la cuenta/casa oficial, buscar luces de color, seleccionar únicamente las deseadas, guardar los colores y probar los seis estados.

**Pendiente de prueba física:** consentimiento real, descubrimiento y color de las lámparas, cambios desde otra app/web VISO, revocación y reconexión; reproducción/portada de Spotify y permisos Android. La sincronización de luces depende de que Android pueda ejecutar la app; no se promete control con la app cerrada o detenida forzosamente. SDK presente y comando aceptado por la API no equivalen a un color observado físicamente. Fuentes y límites: [informe Google Home](android-three-screens-google-home.md).

## Validación y artefacto

- Instalación reproducible con pnpm 11.19.0 y lockfile congelado; TypeScript app/backend, ESLint, web build y Android build completos aprobaron.
- **298 pruebas Vitest** en 27 archivos y **10 pruebas JVM** sin fallos.
- Chromium con Convex local: **162 comprobaciones**, 21 combinaciones de vista/distribución. Verificó los seis cambios reales de estado, propagación desde otro cliente, conservación de estados/páginas anteriores, tres pestañas siempre visibles, relojes/fotos/widgets sin desbordamiento en horizontal y vertical, fotos reales locales y persistencia tras recargar. Sin errores JavaScript ni acceso al backend de producción. La cuenta de prueba quedó restaurada.
- Siete verificaciones reales adicionales de IndexedDB para fotografías; pruebas de sesiones multimedia con fixtures verifican lógica/distribución, no reproducción física.
- Verificación APK: versionCode **3**, versionName **1.2.0**, minSdk **24**, targetSdk **36**. Home APIs se habilita solo en Android **10+**. Firma v2 válida, misma SHA-1 que 1.1. SDK `Home`, `GoogleHomeAdapter` y comandos RGB están presentes; las dos imágenes originales web se conservan byte por byte. Usa el mismo backend HTTPS `vivid-nightingale-785` de la web Android existente.
- Tamaño: **16.507.869 bytes**. SHA-256: `fbcf340588cdd710ce6d5ffb08e8a68397d57b4c1cdc4d68df5e7326cc682752`.

Los AAR oficiales independientes no se publican en Git. Para reconstruir la APK con Google Home, recuperar/verificar el SDK autorizado con `scripts/setup-google-home-sdk.mjs`, exportar `VISO_GOOGLE_HOME_SDK_DIR` al directorio verificado y ejecutar `node scripts/build-android.mjs` con JDK/SDK Android preparados. CI general sin esos archivos compila y prueba una variante que declara Google Home no disponible; su artefacto está rotulado **without-google-home-sdk** y no es la APK enlazada arriba. No instalar artefactos CI con otro certificado sobre esta app.
