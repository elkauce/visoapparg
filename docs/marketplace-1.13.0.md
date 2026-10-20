# Marketplace VISO y medios de teclas — 1.13.0

Primera etapa publicada el 20 de octubre de 2026 con autorización del propietario, desde `fix/viso-deck-reference-layout` (fuente `b10e036`). No se modificó `main`. Web: https://viso-deck-android.vercel.app/marketplace.

## Funciones disponibles

Cada tecla admite PNG, JPG, WebP, GIF, AVIF, MP4 y WebM en edición normal y avanzada. El archivo se muestra dentro del botón y se copia a almacenamiento propio al guardar; no cambia su acción, estado, RGB ni el fondo del Display. Nombre e icono superpuestos se pueden mostrar u ocultar. Quitar el fondo o restablecer el aspecto recupera una tecla visible. Reloj y clima recuperan su contenido vivo al retirar el archivo. Un fallo de biblioteca queda contenido dentro del selector y permite seguir editando.

El cpanel ofrece Marketplace después de iniciar sesión. Incluye Descubrir, Iconos, Plugins, Perfiles, Protectores, Sonidos, Hardware y Usados, con búsqueda, detalles y biblioteca de la cuenta. Mantiene fondo `#F5F3EF`, marca visible y navegación inferior en celular.

Hay nueve productos propios: dos paquetes de iconos, Deck Esencial, Aurora VISO, Señales suaves, el acceso al plugin personalizado y las fichas Mini, Display y Matrix. Los 35 archivos originales incluyen 12 PNG, seis GIF, siete videos sin audio y tres WAV. Los precios o existencias de hardware no se inventan; las fichas informativas ofrecen detalles del equipo.

Los recursos gratuitos se agregan a la biblioteca. Se pueden descargar y usar al editar teclas. Aurora se aplica al Display con confirmación y elección de ajuste/visibilidad del estado. Deck Esencial agrega una página nueva sin reemplazar páginas ni estados existentes. El plugin abre la configuración personal de Elgato de la misma cuenta.

Los creadores completan su perfil y solicitan aprobación. Tras aprobarse, pueden preparar borradores, subir portadas y archivos, enviarlos a revisión y ver los motivos de cambios solicitados. El administrador puede aprobar, pedir cambios, archivar productos y retirar la aprobación de un creador.

Sólo VISO publica usados. El formulario conserva el enlace de afiliado completo de Mercado Libre o `meli.la`, identifica la relación de afiliación y dirige la compra al vendedor original. La sección comienza vacía hasta que VISO publique enlaces reales.

## Alcance comercial de esta etapa

Recursos gratuitos y compras mediante enlaces externos, según lo confirmado por el propietario. No hay cobros, carrito ni confirmación de pagos dentro de VISO. Los recursos externos se compran y entregan en el sitio del vendedor; VISO no otorga una licencia gratuita por abrir un enlace.

La importación automática de publicaciones de Mercado Libre y los pagos integrados quedan para una etapa posterior. No se ejecutó scraping ni se cargaron productos ajenos o anuncios comerciales ficticios. Las publicaciones técnicas usadas durante las pruebas pertenecen exclusivamente al backend local y quedaron archivadas.

## Permisos y archivos

Todas las consultas y operaciones del marketplace requieren sesión. Borradores y archivos privados sólo se muestran a su dueño o a administración; el catálogo muestra publicaciones aprobadas. La biblioteca guarda una copia de la versión adquirida. Aplicar un archivo de creador genera una copia propia, de modo que los cambios posteriores del producto no alteran las teclas existentes.

Los administradores se configuran mediante `MARKETPLACE_ADMIN_USER_IDS` en el servidor, con IDs inmutables de usuarios existentes. Un correo enviado desde el cliente no concede permisos. Se ubicó de forma única la cuenta indicada por el propietario mediante una consulta de sólo lectura, con evidencia de contraseña y Google verificado. Tras su autorización se habilitó ese ID y se comprobó su pertenencia al rol desde el servidor; el ID se conserva fuera del repositorio.

La subida autenticada `/marketplace/media` valida propietario, formato, encabezados reales y tamaño: 60 MB por archivo, 512 KB para JSON y cuota de 1000 archivos/1 GiB por creador. Los archivos ZIP/JSON se descargan; VISO no ejecuta código de plugins subidos. Se conservan las extensiones instalables `.streamDeckPlugin` y `.streamDeckProfile`.

Las operaciones antiguas de medios del estado rechazan originales compartidos del marketplace y no los eliminan al quitar/reemplazar un fondo o borrar un estado. Se mantienen las protecciones de archivos propios y ajenos.

## Android

APK publicada: `downloads/VISO-Deck-1.13.0-debug.apk`, `com.viso.deck`, versionCode 23. Conserva la firma SHA-1 `F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`, los permisos de 1.12.0 y el SDK oficial Google Home 1.10.1. Se conservan APK 1.12.0, fuente `3263ae3` y despliegue web `dpl_D8zcb4jfBpZEGLKG6Wp1y2CaoxH6` para recuperación.

El inicio Android añade Marketplace. Aplicar imágenes y videos usa la misma cuenta y almacenamiento de la web. Los enlaces comerciales se abren en el navegador externo. Para exportar archivos, Android ofrece «Abrir archivo» en el navegador; la web conserva la descarga directa. El instalador de Elgato se descarga desde la computadora con la misma cuenta.

Para compilar preservando Google Home es necesario declarar explícitamente el directorio existente del SDK:

```bash
source /workspace/.visoapparg-setup/android-tools/env.sh
VISO_GOOGLE_HOME_SDK_DIR=/workspace/status-mini-/app/libs node scripts/build-android.mjs
```

La compilación, firma, contenido del APK y permisos se verificaron; queda pendiente instalar y comprobar esta APK en dispositivos físicos. No se afirma haber probado luces o servicios nativos desde este entorno.

## Verificación

493 pruebas en 56 archivos, TypeScript frontend/backend, ESLint de los archivos modificados y compilaciones web/Android correctas. La cuenta técnica local verificó 33 operaciones del recorrido completo y 19 de presentación/reproducción en 1440, 390 y 320 px. Incluyen moderación desde la interfaz, subida de GIF y rechazo de contenido disfrazado, descarga idéntica por SHA-256, enlace afiliado exacto, sincronización de teclas entre sesiones, acción/estado/fondo conservados, video real en reproducción, perfil adicional, protector y plugin. Se restauraron la tecla, página y fondo de prueba. No se controlaron luces ni se modificaron datos de usuarios reales.

Evidencia: [recorrido](marketplace-evidence/browser-report.json), [presentación](marketplace-evidence/visual-report.json), [APK](marketplace-evidence/apk-report.json), [escritorio](marketplace-evidence/marketplace-desktop.png) y [celular](marketplace-evidence/marketplace-mobile.png). `scripts/verify-marketplace-assets.py` verifica formatos, movimiento, duración, sonido y hashes de los recursos originales.

## Publicación verificada

Se actualizó explícitamente el backend compartido `vivid-nightingale-785` y sus índices nuevos, y se publicó la web en el proyecto Vercel existente. Despliegue `dpl_C9TqQxSQWGEZLhNhs4XrS8gbMUpq`, estado `READY`, con alias https://viso-deck-android.vercel.app. Se conservaron los proyectos y las credenciales de Google Home y de acceso con Google.

Los 60 archivos servidos por el dominio coinciden por SHA-256 con la compilación revisada. La ruta directa `/marketplace` responde correctamente. Pasaron 42 comprobaciones públicas en navegador a 1440, 390 y 320 px: inicio, acceso con Google/contraseña disponible, catálogo protegido por sesión y diálogos sin desbordes ni errores de ejecución. La descarga pública de la APK responde HTTP 200, tiene 21.930.232 bytes y SHA-256 `dfe569bfd54c765f0fbc058c654e4fa6c50b28695775ca09cbfc1e398bdefa7c`. Las consultas del catálogo, sesión y administración rechazan solicitudes anónimas; la subida sin sesión responde HTTP 401. La comprobación del rol y de los índices fue de sólo lectura, sin crear sesiones del propietario ni alterar sus estados o luces.

El recorrido autenticado completo fue probado en el backend local, como se detalla arriba. La nueva APK todavía requiere prueba en un teléfono físico. Evidencia de publicación: [reporte](marketplace-evidence/production-report.json).
