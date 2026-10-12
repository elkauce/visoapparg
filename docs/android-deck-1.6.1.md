# VISO Deck 1.6.1 — tecla RGB independiente

El usuario aclaró que no quería crear otro estado como «Pepe»: quería una tecla con su propio nombre, RGB e icono, independiente de los estados. La implementación 1.6 añadía estados personales y no resolvía esa separación. Esa función se conserva, pero se añade una alternativa explícita dentro del editor existente.

## Uso

En una página personal: editar/agregar tecla → Tipo → Tecla personalizada RGB. Escribir «Pepe», elegir amarillo y guardar. El icono está oculto inicialmente; se puede mostrar y elegir uno propio.

La tecla se guarda como la acción RGB existente, con nombre, color e icono propios. No contiene `statusId`, no crea un registro de estado y no activa un estado VISO. Editarla recupera el mismo modo y sus valores. Cambiar su color actualiza tanto la apariencia como el RGB de su acción.

En la APK Android, pulsarla envía el RGB exclusivamente a las luces previamente seleccionadas y autorizadas en Google Home. Se reutiliza el puente nativo ya verificado: `stateKey=null`, color explícito y revisión única, sin modificar el estado de la cuenta. Se conservan las verificaciones de permisos, cuenta, primer plano y selección de luces. Un resultado vacío o un error de una luz no se presentan como éxito.

La web puede editar y mostrar estas teclas mediante la misma cuenta. Ejecutar el comando directo Google Home requiere la APK Android; no se simula una API Google Home web ni se convierte el comando en un cambio de estado. Los controles web de estados y su sincronización existente continúan funcionando.

## Verificación y recuperación

319 pruebas Vitest en 29 archivos, TypeScript, ESLint, compilación Android con SDK oficial y verificación de firma aprobados. La prueba del editor verifica «Pepe» amarillo sin crear/asociar un estado; la prueba de ejecución verifica que no se invoque el servicio de cambio de estado. Se conserva la pantalla encendida para Deck y Display de 1.6.

APK 1.6.1, `versionCode=11`, `com.viso.deck`, firma SHA-1 `F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`.

SHA-256: `f822f932ef67a4c5c7c31ab9a7480fc2d7d1ad643950c092930d9c99da1451f0`.

Instalar encima de 1.6, sin desinstalar ni crear credenciales. Sigue pendiente comprobar la tecla independiente físicamente en el teléfono del usuario. La vinculación y los estados normales fueron confirmados físicamente por el usuario en 1.5.3.

La APK 1.6 y el código anterior `de98de3` se conservan para recuperación. No se cambia el backend ni se publica la nueva web en producción sin autorización.
