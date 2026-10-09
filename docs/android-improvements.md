# VISO Deck Android 1.1: versión de prueba

Estas mejoras parten de la versión Android/web funcional de `elkauce/visoapparg`, commit estable `dbf6592102313e7e4abd45094f2789e0c886a5d6`. Se conservó y publicó el respaldo `backup/viso-deck-android-stable-dbf6592` antes de modificar fuentes. El trabajo está separado en `feature/viso-deck-android-improvements`; `main` y `feature/viso-deck-android` conservan sus referencias.

La APK nueva se descarga como [VISO-Deck-1.1-debug.apk](https://raw.githubusercontent.com/elkauce/visoapparg/feature/viso-deck-android-improvements/downloads/VISO-Deck-1.1-debug.apk). Mantiene `com.viso.deck` y el certificado de la APK estable, aumenta `versionCode` a 2 y usa `versionName` 1.1.0: permite actualizar la instalación anterior sin desinstalarla. Es una compilación de depuración para pruebas, no una publicación en Google Play. SHA-256: `3f9ebcd05f03699797cae2abc3fa50ae78e08e167c4753e63f5a6aa5a5c713be`.

[Abrir web candidata](https://viso-deck-mejoras-npgfwlf4l-manuelhaguilar8-4981s-projects.vercel.app/). Su [descarga directa de la APK](https://viso-deck-mejoras-npgfwlf4l-manuelhaguilar8-4981s-projects.vercel.app/downloads/VISO-Deck-1.1-debug.apk) sirve el mismo archivo. Para probar Deck y Display en dos dispositivos, entra con la misma cuenta VISO y abre Pantalla completa → Abrir en el dispositivo Display. Los controles de estado siguen compartiendo la cuenta y su enlace público existente.

## Qué cambia

- Inicio: las dos tarjetas conservan su forma y ubicación, con el verde oficial existente. Pantallas y diálogos usan los insets reales de Android; el teclado no duplica el margen inferior y la navegación restablece el desplazamiento.
- Editor: Mostrar nombre y Mostrar icono son independientes y se guardan por tecla. Funcionan sobre imagen, GIF y video conservando proporciones, acciones y valores predeterminados anteriores. Canvas conserva su tratamiento existente.
- Aplicaciones: selector nativo con iconos reales, nombres, búsqueda y selección persistente. Abrir aplicación utiliza solamente apps lanzables autorizadas; permite imagen personalizada y comunica las ausentes. No incorpora `QUERY_ALL_PACKAGES` ni cambia los permisos del manifiesto.
- Integraciones: dos grupos compactos con Google Home, Alexa, Dispositivos VISO, Home Assistant, Spotify y multimedia, y Aplicaciones y automatizaciones. Los controles y permisos están dentro de cada detalle. Se elimina la tarjeta Elgato solamente del menú Android; sus funciones compartidas originales se conservan.
- Alexa conserva el mecanismo existente de webhook/rutinas, con configuración y prueba explícitas. Home Assistant conserva HTTPS y credenciales nativas protegidas. Multimedia usa controles Android existentes, sin pedir una cuenta de Spotify ni anunciar una integración con su API.
- Dispositivos VISO conserva el feed RGB público existente y permite comprobar su respuesta. Una respuesta del servidor no se presenta como conexión física del aparato. La tienda queda en «Catálogo próximamente», según la indicación del propietario.

## Cuenta, sincronización y compatibilidad

La APK y la web candidata utilizan el mismo backend existente `https://vivid-nightingale-785.convex.cloud`. Se inicia sesión con el correo y contraseña VISO actuales. No se desplegaron funciones Convex, migraciones, cambios de autenticación ni cambios en los endpoints de Display, estados, páginas o acciones. No se necesita otra cuenta.

Las preferencias de visibilidad se codifican dentro del campo de apariencia existente mediante `viso1:<icono>:<nombre><icono>`. Ambas visibles conservan el icono original sin codificación. Los clientes nuevos interpretan las preferencias y los clientes anteriores siguen ejecutando las acciones; **la web estable anterior no interpreta los nuevos controles visuales**. Para comprobar estas preferencias entre app y web se debe usar la web candidata. Publicar estos cambios en `viso-deck-android.vercel.app` requiere aprobación del propietario.

El sitio estable y su APK anterior se conservan; no se cambia su proyecto, dominio ni despliegue. La candidata se publica como un despliegue **preview** en otro proyecto Vercel, `viso-deck-mejoras`, usando únicamente los archivos públicos compilados y la APK nueva.

## Verificación efectuada

| Comprobación | Resultado |
| --- | --- |
| TypeScript frontend y Convex | Aprobado |
| ESLint completo sin advertencias | Aprobado |
| Vitest | 213 pruebas, 18 archivos aprobados |
| Java/Kotlin y pruebas JVM | Compilación aprobada; 5 pruebas aprobadas |
| Vite, Capacitor y `assembleDebug` | Aprobados |
| APK | Firma v2 válida; mismo certificado y paquete que la versión estable; código de versión superior |
| Contenido de la APK | Backend compartido correcto; endpoints locales de prueba ausentes |
| Chromium y Convex locales | 110 comprobaciones aprobadas; cero errores JavaScript; fixture restaurado; ninguna consulta a Convex cloud |
| Web candidata pública | Portada, inicio de sesión con cuenta de prueba existente, Deck e integraciones aprobados; cero errores JavaScript; sin modificar datos ni usar la cuenta del propietario |

La prueba de interfaz usa vistas de 360×800 y 800×360, navegación por las seis integraciones, cuatro combinaciones de visibilidad, carga real de imagen, guardado, cambio de página, recarga y un segundo contexto autenticado de la misma cuenta. Verifica que la acción de estado y otra tecla no cambian. Los márgenes CSS de sistema se simulan: **no es una prueba de insets físicos ni del bridge Android**. La publicación contiene evidencia en [android-improvements/report.json](android-improvements/report.json). Las capturas desactivan animaciones de apertura para mostrar el diálogo terminado. La candidata pública se verificó además en Chromium con validación TLS normal y una cuenta de prueba anterior: ver [cloud-readonly-report.json](android-improvements/cloud-readonly-report.json).

## Qué necesita una prueba física o un recurso externo

- Teléfono Android: actualización de la APK, notch, teclado, rotación, barras e inmersión; selección y apertura reales de aplicaciones; permisos y control de una sesión multimedia.
- Logo: falta el SVG/PNG transparente oficial. Su incorporación ya está preparada y se conserva el encabezado previo; ver [android-branding.md](android-branding.md).
- Google Home: faltan proyecto/SDK y credenciales oficiales para implementar el consentimiento y control reales. La interfaz muestra «Pendiente de habilitación» y no simula una conexión.
- Alexa y Home Assistant: necesitan las rutinas/webhook o servidor reales del propietario para comprobar ejecución física. No se enviaron comandos externos durante estas pruebas.
- Hardware VISO: el repositorio contiene un ejemplo ESP32 que consulta RGB, sin identidad, descubrimiento, registro ni telemetría. Se necesita firmware/documentación del aparato para esas funciones y una prueba física; ver [android-viso-devices.md](android-viso-devices.md).
- Tienda: no existe una URL oficial todavía. `VITE_VISO_STORE_URL` queda disponible para incorporarla después.

La instalación conservando datos se comprueba mediante identidad, firma y versión; no se afirma haber ejecutado esta actualización en un teléfono físico dentro de este entorno.
