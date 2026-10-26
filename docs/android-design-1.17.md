# VISO Android 1.17.0 — revisión del diseño

La entrada de la app utiliza la misma identidad que la web: fondo `#F5F3EF`, texto oscuro, acentos naranja y el símbolo original de VISO con lettering legible. El cambio corresponde a la gestión de la cuenta y del Deck; las vistas operativas conservan su diseño.

## Recorrido

- Antes de ingresar: formulario centrado, acceso Google y correo, registro y confirmación de contraseña. Un halo con los colores de los estados late suavemente; respeta la preferencia de reducir movimiento.
- Inicio: tarjeta completa con el color del estado confirmado por el servidor; accesos a Deck, Display, Timbre, Marketplace y Conexiones.
- Navegación: Inicio, Biblioteca y Cuenta, también dentro de Marketplace y Timbre en Android. La navegación web de escritorio conserva su menú.
- Cuenta: Google vinculado, cierre de sesión, editor del Deck, aplicaciones permitidas y configuración de Timbre y conexiones.
- Conexiones: se mantienen las integraciones y servicios configurados. Alexa mediante rutinas y Home Assistant se agrupan en «Otras conexiones». Esto no implementa un nuevo enlace directo a la cuenta Alexa.
- Edición: formularios claros para teclas, páginas, cuadrícula, modo de reposo, presencia automática, colores de Google Home y ajustes de las páginas existentes. Los selectores y ventanas secundarias heredan la paleta de gestión.

El editor conserva acciones, nombres y colores personalizados, iconos, archivos, biblioteca, imagen/video, páginas, duplicación y las demás funciones anteriores. No se eliminan permisos, conexiones guardadas ni datos. La tarjeta de estado no inventa un estado mientras sincroniza o cuando el Deck está apagado.

## Separación del modo operativo

`/deck` y `/s/:slug` mantienen su presentación y comportamiento. Los cambios de paleta se aplican en las rutas de gestión o en los formularios abiertos por el usuario. Los controles de actividad, pantalla encendida, presencia, Google Home, música y Timbre conservan sus implementaciones existentes.

La comparación local con la revisión anterior `654bd16` produjo cero píxeles distintos en Deck y Display, a 390 × 844 y 844 × 390. Se utilizaron componentes reales y datos sintéticos, con teclas visibles; no se operaron cuentas, luces, llamadas ni pagos reales durante esta prueba.

## Validación

- 941 pruebas aprobadas, en 100 archivos.
- 52 comprobaciones de navegador: acceso, destinos, estado, editor de teclas/páginas, tamaños de 320/390 px y horizontal, ausencia de errores de ejecución y comparación visual del modo operativo.
- TypeScript y compilación Android completados con Google Home SDK y Firebase Cloud Messaging habilitados.
- Sin incidencias ESLint nuevas. Permanecen seis incidencias previas del compilador React en código operativo; se compararon con la revisión anterior y no se modificó esa lógica para esta entrega.
- No había un dispositivo Android conectado. La instalación, acceso Google, permisos, Google Home y recepción de Timbre deben comprobarse en el teléfono antes de promover la descarga estable.

La APK es `com.viso.deck`, versión `1.17.0`, código `29`, con la misma firma de la versión anterior. Los indicadores de las barras del sistema se adaptan a la superficie de gestión, sin cambiar el control de pantalla completa.

## Archivos de revisión

La APK y su suma de comprobación se guardan en `artifacts/android/VISO-Deck-1.17.0-review.apk` y `.apk.sha256`. Las capturas y el informe de navegador se guardan en `artifacts/app-redesign/`. Estos artefactos se generan localmente y no contienen claves privadas del servidor. El archivo Android de Firebase continúa excluido de Git.

Reconstrucción en el entorno preparado:

```bash
source /workspace/.visoapparg-setup/android-tools/env.sh
VISO_TIMBRE_FCM_ENABLED=1 \
VISO_GOOGLE_HOME_SDK_DIR=/workspace/status-mini-/app/libs \
node scripts/build-android.mjs
```

La revisión se preparó sin publicar ni modificar el servidor. El 26 de octubre de 2026 el propietario autorizó la publicación con «Si publica».

## Publicación autorizada

La versión está publicada en [la web estable](https://viso-deck-android.vercel.app). El botón de descarga, el acceso rápido y el QR utilizan la misma [APK 1.17.0](https://raw.githubusercontent.com/elkauce/visoapparg/fed264a9d066b1db405f223efeb7fe7567b96619/downloads/VISO-Deck-1.17.0-debug.apk), alojada en un commit inmutable. Se descargó y comparó byte por byte con el archivo aprobado; conserva su firma anterior.

Se comprobaron los 93 archivos de la web antes y después de promover el despliegue, ocho rutas públicas y la decodificación real del QR. Además pasaron 18 comprobaciones de navegador sobre el acceso publicado, a 390 y 320 px, conectado al servidor real: Google disponible, correo/contraseña, registro, paleta y latido. No se crearon cuentas ni se iniciaron llamadas o pagos.

El [informe de publicación](validation/android-design-1.17-production.json) registra los despliegues actual y anterior y la suma de comprobación de la APK. No se desplegó Convex ni se modificó Te a Viso. Para ver el nuevo diseño en el teléfono hay que instalar la nueva APK; la prueba en un dispositivo físico sigue pendiente.
