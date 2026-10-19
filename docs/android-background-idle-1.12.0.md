# VISO 1.12.0 — llamadas en segundo plano y protector opcional

Implementación sobre `fix/viso-deck-reference-layout`; no modifica `main`.

## Comportamiento

- Ajustes de presencia: opción explícita para detectar llamadas telefónicas en segundo plano. Solicita permisos de teléfono y notificaciones; mantiene una notificación con acceso para desactivar. No lee números ni graba audio. Funciona independientemente de la ruta Deck y utiliza el estado compartido que recibe también Elgato.
- El servicio nativo consulta el estado compartido y sincroniza las luces Google Home seleccionadas cuando VISO está en segundo plano. En primer plano continúa el controlador existente. No abre consentimiento sin intervención del usuario.
- Al finalizar una llamada restaura el estado anterior únicamente si nadie cambió el estado manualmente. Una concesión de 90 segundos evita dejar una llamada atascada si el teléfono pierde conexión. El servicio usa una capacidad revocable limitada por dispositivo, cifrada localmente y almacenada solo como hash en el servidor; no conserva el token de inicio de sesión.
- Google Home conserva selección y colores ante fallos temporales, estructuras vacías o permisos retirados. Retirar permisos puede requerir autorización de nuevo, pero no elimina la configuración. La desconexión explícita sigue borrándola.
- Ajustes de Deck → Principal y protector de pantalla: elegir páginas reales y espera de 3 a 3600 segundos. Desactivado inicialmente. El primer toque vuelve a la principal sin ejecutar una tecla; mantener pulsado abre la configuración para salir del modo. Editar o abrir diálogos pausa la espera. Páginas eliminadas no provocan navegación ni bloquean desactivar el protector.
- Las páginas conservan pantalla completa. No hay controles permanentes nuevos. El protector cambia la página visible, no el estado de señalización.

## Validación

- 384 pruebas web/backend en 41 archivos: correctas.
- 21 pruebas JVM Android: correctas.
- Compilación APK con SDK oficial Google Home 1.10.1: correcta.
- Cuenta técnica y backend local real: alta de capacidad, llamada y restauración verificadas.
- Chromium con cuenta local real: guardar páginas, espera de 3 segundos, despertar sin cambiar estado, pulsación larga y desactivación verificados; alto completo conservado.
- El emulador Android sin aceleración no completó el arranque. Las llamadas y luces en segundo plano requieren prueba física; no se afirma verificación en un teléfono ni luces reales.

## Distribución y límites

APK `downloads/VISO-Deck-1.12.0-debug.apk`, paquete `com.viso.deck`, versionCode 22. Firma SHA-1 `F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`, conservada respecto a 1.11.4. SHA-256 del APK: `e0edae2f0c2bc17f54a8384fad55476288a4ed8b21af7613acd15bf098dc0305`.

Se conserva el APK 1.11.4 para recuperación. Esta entrega no resuelve ni evita el bloqueo de instalación de Play Protect del S26. Android puede detener servicios por cierre forzado o restricciones de batería; la activación inicial requiere abrir VISO y aceptar los permisos. No incorpora detección de reuniones fuera del comportamiento existente.

El usuario autorizó publicar la versión 1.12.0 el 19 de octubre de 2026. Se actualizó el backend compartido `vivid-nightingale-785` mediante selección explícita en archivo externo (`CONVEX_DEPLOYMENT=dev:vivid-nightingale-785`), `dev --once`, typecheck habilitado y codegen deshabilitado. Convex confirmó funciones listas y los tres índices de `presenceDevices`. La consulta pública de un slug inexistente devuelve `found:false`; el endpoint nuevo rechaza una capacidad inválida con `UNAUTHORIZED`. No se modificaron cuentas, estados ni luces del usuario durante la verificación. El APK publicado en GitHub devuelve HTTP 200 y coincide con el hash anterior.

La publicación web permanece pendiente: Vercel rechazó la sesión almacenada y requiere renovar el acceso mediante su flujo oficial de dispositivo. No se crearon proyectos ni credenciales nuevos. La web anterior sigue publicada y los cambios de schema/backend son aditivos. Tras autorizar Vercel, continuar la publicación web de esta misma revisión y verificar el dominio público; no requiere volver a pedir autorización de publicación.
