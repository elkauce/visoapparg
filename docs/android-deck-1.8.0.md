# VISO Deck 1.8.0: catálogo compartido de páginas

Problema: Android anteponía tres páginas locales fijas (Estados, Spotify y Standby), mientras el editor web leía solamente deckPages. Por eso la web no podía editar ni eliminar lo que aparecía realmente en la APK.

Ahora /deck y /deck/edit usan el mismo catálogo autenticado de la cuenta. Estados VISO, Spotify y Reloj se materializan como páginas persistidas, conservando los IDs, teclas, estados y archivos anteriores. La migración es transaccional y ocurre una sola vez por cuenta, al abrir el Deck/editor actualizado; el marcador impide recrear páginas eliminadas. Se mantienen ocho páginas adicionales además de las tres iniciales, con un máximo total de once. Una biblioteca de 24 estados se conserva sin superar el límite ni reemplazar estados del usuario.

Las páginas admiten cambio de nombre/tipo, orden, duplicación y eliminación; las cuadrículas usan las teclas reales, incluyendo clima, enlaces, acciones, imágenes, videos e iconos/colores propios. Reloj conserva reloj, música, fotografías y widgets, con preferencias y fotos guardadas por cuenta. Se importan las preferencias/fotos antiguas cuando la nube está vacía; se conservan los archivos locales originales. Las fotos nuevas usan el endpoint autenticado existente, con validación de propietario y límites de 8 fotos/24 MB por página. Append/remove se aplican en el servidor sin reemplazar otras fotos por una captura vieja del cliente.

No se cambiaron las integraciones nativas de llamadas, calendario ni Google Home. La APK usa el SDK oficial Home 1.10.1 de STATUS y conserva com.viso.deck y la firma SHA-1 F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6. Versión 1.8.0, código 14. APK SHA256: 24953bd20c741456bebc02debcd12940011420e5407f984945a55f0b0a95f670.

Validación: TypeScript de frontend/backend, compilación Gradle con verificación de los AAR oficiales, firma APK y presencia del SDK/adaptador reales en DEX. 358 pruebas automáticas aprobadas. Pruebas unitarias de catálogo, permisos, biblioteca llena, preferencias, clima, duplicación y fotos. Dos sesiones Chromium autenticadas contra un Convex local real verificaron creación/renombre/eliminación de páginas, clima y reloj analógico compartidos, y que Reloj eliminado no reaparece al recargar (solo geocodificación fue fixture). Otra prueba verificó subida/visualización/eliminación reales de fotografías entre las sesiones.

El emulador Android del entorno no terminó de arrancar sus servicios de instalación; no se afirma una prueba completa de interfaz nativa. La comprobación física de la APK 1.8.0 y Google Home queda para el teléfono del usuario. La APK 1.7.1 se conserva como recuperación. Sus tres páginas fijas no pueden obedecer eliminaciones remotas: instalar 1.8.0 es necesario para el catálogo compartido completo.

La publicación corrige el alcance del editor completo autorizado por el usuario. Actualizar únicamente el despliegue compartido vivid-nightingale-785 y el proyecto Vercel viso-deck-android; no publicar en useful-egret-915, visoapparg ni main. Las APIs antiguas conservan get({}) y los clientes anteriores no reciben las nuevas páginas virtuales como duplicados en sus catálogos existentes. Publicar backend antes de la web para admitir los nuevos argumentos/endpoints; la aplicación nueva requiere el backend actualizado.

Para compilar conservando Google Home, usar el SDK recuperado y validado de STATUS, además del entorno Android preparado:

```sh
source /workspace/.visoapparg-setup/android-tools/env.sh
VISO_GOOGLE_HOME_SDK_DIR=/workspace/status-mini-/app/libs node scripts/build-android.mjs
```

Sin esa variable el proyecto construye deliberadamente el adaptador no disponible; comprobar el SDK real y GoogleHomeAdapter en el DEX antes de distribuir cualquier APK.
