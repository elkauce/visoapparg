# VISO 1.15.0 — navegación, biblioteca y Google Home

Versión preparada en `fix/viso-deck-reference-layout`. La web de revisión está en https://viso-deck-android-g89ehkpun-manuelhaguilar8-4981s-projects.vercel.app . **No se actualizó el backend compartido ni el dominio de producción.**

La revisión pública permite comprobar el frontend. El catálogo Vúmetro y la aplicación directa de imágenes a teclas necesitan publicar también el backend de esta versión; el recorrido funcional completo se verificó contra el servidor local con cuentas técnicas. No se presentan estas operaciones nuevas como habilitadas en el servicio actual.

## Navegación y recursos

Panel, Display, Conexiones, Marketplace y Cuenta comparten el mismo menú. Se quitaron las pestañas internas repetidas. En móvil el menú se adapta a una barra inferior. Deck y Display a pantalla completa conservan sus superficies sin este menú.

Los recursos gratuitos ofrecen «Obtener y usar»; los adquiridos ofrecen «Usar». La biblioteca mantiene ese acceso visible aun cuando el detalle del paquete está cerrado y explica qué es cada producto, dónde se utiliza y sus requisitos. La ficha utiliza la versión adquirida de la biblioteca, no los archivos de una edición posterior del vendedor.

Una imagen, GIF o video puede aplicarse a una tecla existente con una vista previa y confirmación. Se copia al almacenamiento propio del comprador y se modifica únicamente la apariencia; la acción, el nombre y el color se conservan. El servidor verifica propiedad, licencia y cambios de imagen ocurridos desde la vista previa. También permanece la aplicación al fondo del Display con sus ajustes existentes.

Las páginas compatibles se agregan con confirmación, conservando páginas y configuraciones anteriores. El Vúmetro se incorpora al catálogo como una página nativa real, con sus trece diseños y opciones de audio. Estados se mantiene como el perfil Deck Esencial, que crea sus teclas reales. Las cuentas nuevas siguen recibiendo Estados y Clima; no se agregan recursos a bibliotecas existentes sin obtenerlos.

Los perfiles compatibles utilizan su instalación de página; sonidos y paquetes externos muestran su reproducción, descarga e instrucciones correspondientes. Los plugins de terceros no se ejecutan automáticamente. Los cobros de Mercado Pago permanecen deshabilitados mientras se configura el servicio.

Las portadas de Fútbol, Reloj, Clima, Spotify y Vúmetro son capturas de los componentes y del renderer reales. Los datos de ejemplo están rotulados expresamente; no son resultados deportivos ni condiciones climáticas en vivo. La captura de Spotify muestra su presentación Android con una sesión multimedia de ejemplo. El generador reproducible está en `scripts/capture-marketplace-pages.mjs`; su fixture de desarrollo no se incluye en web ni APK.

## Google Home

La conexión distingue una comprobación temporalmente fallida de permisos revocados. Recupera verificaciones con reintentos limitados al volver a la aplicación o recuperar conexión. No abre consentimiento automáticamente ni elimina las luces y colores guardados por una respuesta incompleta. Revisar permisos sigue siendo una acción explícita.

Los borradores y las respuestas pendientes quedan separados por cuenta. Las luces ya elegidas pueden conservarse aunque un descubrimiento incompleto no las devuelva; agregar una luz nueva exige validación y cada comando vuelve a comprobar permisos, casa y dispositivo. La creación de la clave cifrada comparte un bloqueo entre las instancias del proceso para evitar reemplazos durante el primer uso simultáneo.

La lista de integraciones muestra la comprobación real de Google Home, reemplazando el texto fijo «Pendiente de habilitación». Los mensajes habituales indican acciones del usuario y conservan diagnósticos útiles sin mostrar credenciales.

Alexa queda para otro momento, según lo indicado por el propietario. Se mantiene la revisión manual de productos y sus actualizaciones. No se añadió una supuesta certificación automática del contenido ni un antivirus.

## Artefactos y verificación

APK preparada: `downloads/VISO-Deck-1.15.0-debug.apk`, `com.viso.deck`, versionCode 26. Conserva certificado y permisos de 1.14.0 y el SDK oficial Google Home 17.1.0. Su tamaño y SHA-256 están registrados en `panel-1.15-evidence/apk-report.json`.

Pasaron 709 pruebas Vitest en 75 archivos y 25 pruebas JVM; se repitieron las 80 pruebas del marketplace tras los últimos ajustes. TypeScript, ESLint de los archivos modificados, compilaciones Android/web y verificación del catálogo aprobaron. Los informes de navegador registran 30 comprobaciones locales con clientes y creadores técnicos, sincronización entre sesiones, tamaños de 1440/390/320 px y ausencia de errores JavaScript. La evidencia pública adicional es anónima.

El preview Vercel quedó READY. Se comprobaron sus 80 archivos contra la compilación; para el HTML se identificó únicamente la inyección de la herramienta de comentarios de Vercel. El HTML de producción sigue coincidiendo exactamente con la versión 1.14.0.

No se autorizaron cuentas Google Home reales, no se enviaron comandos a luces físicas y no se realizaron compras. Antes de considerar comprobada la recuperación de Google Home en el dispositivo, instalar la APK como actualización y probar conexión, selección guardada, salida/regreso a la app y cambios de estado en un teléfono con luces autorizadas.

## Configuración de Vercel solicitada

Se consultó https://vercel.com/get-started.md . La CLI 63.1.0 quedó autenticada como `manuelhaguilar8-4981` y se reutilizó el proyecto existente `viso-deck-android`. El plugin oficial no pudo instalarse porque no está disponible en los marketplaces de este cliente; se instalaron las guías alternativas de `vercel-labs/agent-skills` en el ámbito del usuario.

El servidor MCP compartido `https://mcp.vercel.com` quedó agregado a Codex, pero no se completó su autorización OAuth de retorno local ni se cargaron sus herramientas en esta sesión. No se afirma una comprobación MCP `list_teams`. La CLI autenticada sí permitió crear y verificar el preview. No se cambiaron credenciales de Google, Convex o Mercado Pago.
