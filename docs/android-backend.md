# Backend de VISO Deck Android

Este cambio está preparado en la rama de Android para revisión. No despliega ni
migra el backend de producción. Las pruebas usan `convex-test` y el entorno
local; no certifican una integración nativa ni una ejecución en producción.

## Compatibilidad y activación

La APK de prueba usa las operaciones ya publicadas. Las funciones nuevas requieren
desplegar esta versión de Convex en un entorno autorizado y compilar el cliente
con `VITE_ANDROID_DECK_EXTENSIONS=true`. El valor predeterminado es `false`.
Activar el flag contra el backend publicado actual no agrega sus funciones y
puede producir errores de función inexistente.

Los argumentos originales de `deck_layout.get`, `ensureDefault`, `createPage`,
`setKey`, `removeKey`, `renamePage` y `removePage` siguen siendo válidos. Los
campos nuevos del esquema son opcionales. Una página sin `grid` conserva 5 × 3
posiciones. `ensureDefault` mantiene los estados existentes en su orden y añade
solamente la tecla Apagar. No modifica los colores ni los estados predeterminados.
La autenticación existente no cambia.

## Páginas y teclas

| Operación       | Argumentos añadidos o nuevos                                               | Comportamiento                                                                         |
| --------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `createPage`    | `grid?: {columns, rows}`                                                   | Crea una página vacía; omitir grid conserva 15 posiciones.                             |
| `configurePage` | `pageId`, `grid`, `canvas?`                                                | Guarda distribución y Canvas. Rechaza reducir la cuadrícula si quedarían teclas fuera. |
| `duplicatePage` | `pageId`, `name?`                                                          | Copia cuadrícula, Canvas y todas las teclas a una página nueva.                        |
| `reorderPages`  | `pageIds`                                                                  | Exige todas las páginas del usuario, una vez cada una.                                 |
| `setKey`        | `appearance?`                                                              | Apariencia individual sin cambiar el estado global.                                    |
| `moveKey`       | `keyId`, `pageId`, `position`, `swap?`, `from?`, `content?`, `appearance?` | Mueve, intercambia y edita en una sola transacción.                                    |

`grid` admite filas y columnas enteras entre 1 y 16, con un producto máximo de 64. Ejemplos: 3 × 2 (6), 5 × 3 (15), 8 × 4 (32), 8 × 8 (64). El máximo continúa
siendo ocho páginas por usuario; las consultas y limpiezas abarcan hasta 512
teclas. Los índices de posición empiezan en cero.

Si el destino de `moveKey` está ocupado, requiere `swap: true`. `from` contiene
la página y posición observadas por el cliente; si otro dispositivo movió la
tecla, la operación devuelve `CONFLICT` sin guardar cambios. El editor debe
enviar contenido y apariencia dentro de `moveKey` cuando también cambia de
posición. Convex ejecuta cada mutación de forma atómica y resuelve conflictos
de transacción. No se ejecutan dos mutaciones independientes para intercambiar.

`appearance` admite `label`, `icon`, `color`, `mediaStorageId` y `mediaType`
opcionales. Omitir la propiedad conserva la apariencia actual; `null` la limpia.
El servidor valida y deriva el tipo multimedia. `get` incluye
`appearance.mediaUrl` cuando existe apariencia.

`canvas` admite `mediaStorageId` y `mediaType` opcional. Omitirlo conserva el
Canvas; `null` lo limpia. `get` devuelve `canvas.mediaUrl`. La duplicación comparte
el archivo del mismo propietario. El cliente es responsable de alinear una sola
capa multimedia con las teclas y conservar las separaciones.

## Subida multimedia y propiedad

`POST https://<deployment>.convex.site/deck/media` recibe el archivo como cuerpo,
su MIME en `Content-Type` y el JWT de sesión en `Authorization: Bearer <token>`.
El preflight `OPTIONS` permite esos encabezados. Una respuesta correcta contiene
`{ok:true, storageId, mediaType}`.

Se admiten PNG, JPEG, WebP, GIF, AVIF, MP4, WebM y Ogg con un máximo de 60 MB.
El servidor comprueba tamaño durante la lectura aunque no haya Content-Length.
El MIME aceptado no garantiza que Android pueda decodificar cualquier archivo de
esa categoría; el cliente debe mostrar errores de carga o reproducción.
Los límites de la plataforma pueden restringir antes el tamaño de la solicitud.

El endpoint vincula cada archivo a la cuenta de la sesión mediante `deckMedia`.
Un id de archivo enviado por el cliente no acredita propiedad. Las teclas y
Canvas aceptan únicamente archivos de ese registro pertenecientes al usuario.
No se utiliza la subida legacy de Display para registrar propiedad de Deck.
`media.setMedia` también rechaza archivos Deck de otro usuario; al quitar una
imagen del Display o borrar un estado conserva archivos Deck que pueden estar
compartidos por varias teclas o páginas.

Los archivos registrados se conservan al retirar su última referencia para no
borrar recursos compartidos de forma accidental. La limpieza de archivos sin
referencias y una cuota total por usuario quedan como mejoras pendientes.

## Acciones y reintentos

El contenido nuevo `{kind:"action", label, icon, color, action}` admite acciones
`status`, `off`, `display`, `page`, `url`, `android-app`, `media`, `rgb` y
`automation`. El contrato completo está en
[`deck_action_content.ts`](../convex/lib/deck_action_content.ts).
Una automatización admite de una a 16 acciones simples, sin anidamiento. Los
estados y páginas referenciados deben pertenecer al usuario. Las URL admiten
únicamente HTTP(S); se validan paquete Android, color y brillo RGB (0–100).
Eliminar un estado o una página elimina teclas con referencias anidadas hacia
ese recurso.

Guardar una acción Android, multimedia o RGB configura su intención. Su
ejecución depende del proveedor nativo, permisos y dispositivos autorizados.
El backend no descubre lámparas ni afirma haberlas conectado. Google Home y
RGB permanecen pendientes de una integración oficial autorizada y probada.

`deck_actions.activateStatus({statusId, requestId, deviceId})` añade confirmación
idempotente para el cliente nuevo. `statusId:null` apaga. `requestId` y `deviceId`
son UUID; el id de dispositivo es un identificador público, no una credencial.
La sesión continúa siendo la fuente de autorización.

Un reintento con el mismo `requestId` devuelve `{ok:true, duplicate:true,
requestId}` y no repite la activación ni los webhooks. Usar el mismo id con otro
estado o dispositivo devuelve `CONFLICT`. Los recibos se aíslan por usuario y
se conservan 24 horas, con un máximo de 2.048 pulsaciones diarias por usuario.
Después de ese período no se garantiza deduplicación. Las acciones locales
requieren además protección contra doble pulsación en el cliente. La operación
legacy `statuses.setActive` conserva sus argumentos y comportamiento.

## Validación reproducible

```sh
pnpm exec tsc -p convex/tsconfig.json --pretty false
pnpm exec vitest run --project convex
```

Las pruebas verifican compatibilidad inicial, límites, aislamiento entre usuarios,
duplicación, reducción sin pérdida, intercambio/movimiento concurrente, edición
atómica, referencias anidadas, archivos y Canvas de propietarios correctos, y
confirmaciones idempotentes sin repetir webhooks. No contactan despliegues ni
servicios de iluminación. La aprobación y el despliegue del backend nuevo, sus
pruebas con una cuenta real y las pruebas en Android físico siguen siendo pasos
separados de estas comprobaciones.
