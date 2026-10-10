# VISO Deck Android 1.3: diseño de las tres pantallas

Esta actualización continúa VISO Deck 1.2 desde `feature/viso-three-screens`, sin reconstruir la aplicación. Se trabaja en `fix/viso-deck-reference-layout`; las ramas `main` y el proyecto nativo STATUS se conservan. El paquete sigue siendo `com.viso.deck`, con versionCode 4 y versionName 1.3.0.

[Descargar APK de prueba 1.3](https://raw.githubusercontent.com/elkauce/visoapparg/fix/viso-deck-reference-layout/downloads/VISO-Deck-1.3-debug.apk). La versión [1.2 de recuperación](https://raw.githubusercontent.com/elkauce/visoapparg/feature/viso-three-screens/downloads/VISO-Deck-1.2-debug.apk) sigue disponible. La nueva APK se instala como actualización de Deck 1.2 con la misma firma; no es una actualización del paquete STATUS.

## Pantallas

- **Estados VISO:** los seis botones conservan la selección y confirmación del backend existente. Aprovechan el área disponible en grillas 2×3 vertical y 3×2 horizontal.
- **Spotify:** carátula, canción, artista, progreso, transporte y volumen de la sesión real Android. La distribución usa una columna vertical y dos horizontales; mantiene el acceso multimedia, los estados de error y los controles habilitados por Android.
- **Standby:** relojes digital de tres colores, analógico y flip, dúo con música o fotografía, fotografías y widgets. Conserva las fotos y preferencias privadas por cuenta; los relojes aprovechan el tamaño del panel y los widgets se adaptan al espacio.

El número de página pequeño queda arriba a la izquierda y abre un menú con exactamente esas tres pantallas. La estrella pequeña arriba a la derecha abre **Ajustes**. También se puede deslizar horizontalmente sobre zonas sin controles. La APK entra en modo inmersivo al abrir Deck y respeta los márgenes del recorte del teléfono. Los botones de navegación, reproducción y cambio de fotografía conservan áreas táctiles de al menos 44 px.

**Google Home**, **Personalizar Standby**, el editor original de teclas, pantalla completa y volver al inicio siguen accesibles desde Ajustes. No se agrega otra pantalla predeterminada. No se despliega la web ni se cambia el backend alojado; se conserva su sincronización, los permisos y los logos originales.

## Google Home pendiente de prueba física

La APK contiene el SDK oficial 1.10.1 reutilizado de STATUS. No hay dispositivos ni conexiones simulados en la aplicación. El certificado conserva el SHA-1:

`F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`

En el mismo proyecto Google Cloud **STATUS**, el propietario debe comprobar el cliente Android `com.viso.deck` con ese certificado y la cuenta de Google Home en los usuarios de prueba de OAuth. El cliente `com.statusmini.app` con certificado F6 pertenece a la otra aplicación y se conserva. No se crea otro proyecto ni se incorporan secretos OAuth a la APK.

Para probar en Android 10+ con Google Play Services: **estrella → Ajustes → Google Home**, autorizar la cuenta/casa, seleccionar únicamente las luces deseadas, guardar selección y colores, y cambiar los estados. Deben comprobarse el consentimiento, las luces reales y un cambio de estado desde otro dispositivo. Tener el SDK y una compilación aprobada no acredita esas pruebas físicas. La ejecución depende de que Android pueda mantener o reanudar VISO; no se garantiza control con el proceso detenido.

## Comprobaciones

- TypeScript y compilación web/Android completos.
- 299 pruebas web y 10 pruebas JVM aprobadas.
- El informe de navegador usa datos de prueba explícitos para revisar geometría, orientación y callbacks; no demuestra reproducción ni consentimiento Google en un teléfono.
- Firma v2, paquete, versión, SDK incluido y checksum del APK verificados antes de entregar.

El checksum final acompaña a la APK en `downloads/VISO-Deck-1.3-debug.apk.sha256`. Las capturas de validación muestran datos de prueba identificados como tales. No se modifican credenciales, pagos, proyectos Google ni dispositivos del propietario.

Validación final: **84 variantes** en 360×800, 800×360, 320×568, 568×320, 720×1280 y 1280×720, con cero errores de React y cero fallos de geometría. [Informe](android-deck-1.3-evidence/browser-report.json), [Estados](android-deck-1.3-evidence/estados.png), [Spotify](android-deck-1.3-evidence/spotify.png) y [Standby](android-deck-1.3-evidence/standby.png). Son pruebas de interfaz con fixtures externos, sin escribir en el backend alojado.

APK: **16548582 bytes**, SHA-256 `8fa386e2f52d581de639137a83ee88ffb055979318e2718ac1ccc6ae84e13b80`.
