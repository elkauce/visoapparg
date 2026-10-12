# VISO Deck 1.7.1 — luces en llamadas y reuniones automáticas

El usuario confirmó que los controles manuales Google Home funcionan, pero sus luces no cambian al activar automáticamente LLAMADA o REUNIÓN. La versión 1.7 pausaba los comandos de luces cuando una llamada u otra aplicación cubría el Deck, aunque el estado compartido ya se hubiera actualizado.

## Corrección

La sincronización Google Home puede continuar mientras una llamada o una aplicación de reuniones cubre un Deck que tenga habilitada la detección automática de llamadas o al menos un calendario seleccionado. Se conserva únicamente la autorización de la cuenta VISO actual. Deshabilitar la detección, salir del Deck, cambiar de cuenta o cerrar la sesión elimina esta habilitación. Destruir la actividad cancela los trabajos nativos.

La habilitación es local y específica del Deck autenticado; no solicita nuevos permisos Android, no incorpora un servicio permanente ni exige otro OAuth/proyecto. Los comandos siguen pasando por Home APIs oficiales y mantienen las verificaciones de consentimiento real, casa autorizada, luces seleccionadas, capacidades RGB, revisión de configuración y cuenta propietaria antes de cada comando. No se amplía la selección de dispositivos.

El controlador escucha `pause` y `resume` de Android además de `appStateChange`, para cubrir llamadas y ventanas superpuestas que no llegan a detener la actividad. Al volver a VISO se revalida la configuración y se envía el último estado pendiente.

Se corrige también un caso independiente de coalescencia: dos notificaciones idénticas recibidas antes de despachar al SDK podían marcar el estado como intentado y luego descartarlo sin enviarlo. Ahora el intento se registra cuando se va a despachar realmente, o cuando la preparación falla. Una prueba reproduce la secuencia de snapshots duplicados de LLAMADA.

Con la detección automática habilitada, los saltos transitorios del ciclo de vida y los errores de comandos permiten un máximo de dos reintentos, con intervalos nominales de uno y dos segundos. Antes de reintentar se revisan los permisos y la selección. Una señal más reciente, desactivar la función o cambiar/cerrar la cuenta cancela el reintento. No hay sondeo indefinido ni se repite una llamada antigua después de una reunión nueva.

Los fallos conservan ahora los códigos y dominios seguros de Google/Home cuando están disponibles. No se muestran tokens, cuentas, IDs de dispositivos ni mensajes internos completos. Los comandos alternativos HS/HSV/RGB conservan el diagnóstico del último fallo cuando todos los comandos compatibles fallan. No se presenta un comando rechazado como éxito físico.

## Verificación

- 349 pruebas Vitest en 32 archivos aprobadas, incluyendo sincronización con el Deck cubierto, desactivación, aislamiento de cuentas, snapshots repetidos, recuperación al volver a la app y reintentos limitados.
- 21 pruebas nativas en cinco clases aprobadas: cero errores, fallos o pruebas omitidas. Se verifica que una cuenta antigua no pueda habilitar o deshabilitar el acceso de otra cuenta.
- TypeScript, ESLint y compilación Android con SDK oficial aprobados.
- APK verificada con `apksigner`; `com.viso.deck`, versión `1.7.1`, código `13`, misma firma SHA-1 `F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`.
- Inspección del APK confirmó Home SDK y `GoogleHomeAdapter`, el puente `setBackgroundSync`, el controlador nuevo y exclusivamente la conexión a `vivid-nightingale-785`.
- APK `downloads/VISO-Deck-1.7.1-debug.apk`: 19.486.858 bytes; SHA-256 `869e85494cc16bc0b94be24abf7eb935b5544efb231e654bd4bdd1cff13fddf5`.

## Instalación, alcance y prueba física

Instalar encima de 1.7, sin desinstalar. Se conservan la cuenta, la autorización Google Home, la selección de luces y los colores guardados. Abrir el Deck y mantener habilitadas las llamadas o los calendarios elegidos en la estrella → «Estado automático: llamadas y agenda».

Probar una llamada entrante/en curso y un evento de agenda de reunión, observando el Display y las luces seleccionadas antes de volver a VISO. Comprobar también la restauración al finalizar y un cambio manual durante la llamada. La agenda indica el horario programado, no confirma asistencia real a Meet/Zoom.

La corrección fue verificada en código, pruebas y compilación; **el funcionamiento físico del SDK en segundo plano durante una llamada o reunión sigue pendiente de confirmación en el teléfono del usuario**. No se simulan dispositivos, permisos ni resultados. Si Google rechaza un comando se informa del fallo y su diagnóstico disponible. Android puede suspender o cerrar el proceso; no se promete señalización con VISO forzada a cerrar o con el proceso detenido. La ejecución de los temporizadores también depende de Android.

No se requieren cambios del backend ni publicación de la web pública: la sincronización compartida de 1.7 ya funciona y la corrección se ejecuta dentro de la APK. No se modifica `main`. La fuente `b1595cf`, la APK 1.7.0 y su checksum se conservan intactos para recuperación.
