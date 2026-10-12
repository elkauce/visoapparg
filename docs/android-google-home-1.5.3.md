# VISO Deck 1.5.3 — descubrimiento de luces autorizadas

La captura del usuario después de instalar 1.5.2 muestra autorización confirmada por Google Home y un error `HomeException` durante el descubrimiento. Esto confirma que se superó la espera de sesión en ese teléfono; no confirma todavía qué operación del descubrimiento falla ni que las luces se controlen desde VISO.

La integración reutilizada de STATUS llama `syncLinkedDevices` como actualización opcional y después consulta los dispositivos autorizados. VISO exigía que esa actualización finalizara sin error. Se recupera la política original: si falla la actualización del proveedor, se continúa con la lista oficial del SDK. La actualización opcional tiene un máximo de cinco segundos. Se mantienen obligatorias la comprobación de permisos, casa autorizada, cuenta activa y compatibilidad de color.

También se utiliza `devices(true)`, como en STATUS. La metadata del SDK confirma que el parámetro es `enableMultipartDevices`, de manera que se consultan también dispositivos con varios componentes. Esto amplía únicamente el descubrimiento; no selecciona luces ni envía comandos. Todas las selecciones siguen siendo explícitas y se filtran por casa autorizada y capacidad real de cambio de color.

El diagnóstico distingue ahora el código y dominio de `HomeException`, sin exponer su mensaje completo, detalles, identificadores ni datos de cuentas. Si la consulta real de dispositivos falla, el error permanece visible; no se inventan luces ni se oculta la falta de permisos.

## Validación

Compilación Android con el SDK oficial existente, TypeScript, verificación del certificado y 15 pruebas JVM aprobadas. Las tres pruebas nuevas cubren un fallo opcional que permite continuar, cancelación que impide continuar y actualización exitosa que solo se ejecuta una vez. El frontend no cambia respecto a 1.5.2, cuya suite aprobó 305 pruebas.

APK `com.viso.deck`, versión 1.5.3, `versionCode=9`, certificado SHA-1 `F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`.

SHA-256: `ca8789878911d564f6038a954b002a1f341464d5226ee5a04be7a4a35953efb2`.

Instalar como actualización sin desinstalar ni cambiar las credenciales. Abrir Deck → estrella → Luces Google Home → Actualizar luces. Seleccionar una sola luz real compatible, guardar y probar LIBRE/OCUPADO. Pendiente descubrir y controlar físicamente las luces en el Samsung del usuario. Si falla, obtener captura del código y dominio nuevos.

Se conserva la APK 1.5.2 y el código previo `91f00b7` para recuperación. No se modifican backend, web, otras pantallas ni dispositivos del usuario.
