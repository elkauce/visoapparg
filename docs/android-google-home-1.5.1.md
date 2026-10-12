# VISO Deck 1.5.1 — recuperación de Google Home

La captura del usuario muestra un fallo de búsqueda de luces después del consentimiento, seguido de un fallo de consulta de permisos. El mensaje anterior ocultaba la excepción y dejaba el botón de consentimiento deshabilitado. Esto no permite atribuir el fallo físico a OAuth, Google Play Services o conectividad.

La APK 1.5.1 mantiene `com.viso.deck`, aumenta `versionCode` a 7 y conserva la firma SHA-1 `F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`. Se instala como actualización, sin desinstalar ni cambiar el cliente OAuth. Mantiene el backend `vivid-nightingale-785` y la web `https://viso-deck-android.vercel.app`.

## Cambios

- Las consultas y la búsqueda esperan hasta cinco segundos a que la actividad vuelva al primer plano y JavaScript restablezca la misma cuenta VISO después del consentimiento. La espera no reactiva cuentas ni permite comandos de luces. Un cambio de cuenta la invalida.
- Las excepciones al consultar permisos o casas devuelven un estado no autorizado con diagnóstico. Que el SDK esté disponible permite volver a solicitar consentimiento; no implica que existan permisos o luces autorizadas.
- Los diagnósticos muestran la operación y, cuando Google proporciona `ApiException`, su código. Los demás errores muestran únicamente la clase de excepción. No se exponen correos, tokens ni identificadores de luces.
- «Comprobar de nuevo» vuelve a consultar permisos y configuración y busca dispositivos únicamente si Google confirma la autorización. Permite recuperarse del error sin cerrar el diálogo ni repetir necesariamente el consentimiento.
- Integraciones → Google Home abre el mismo diálogo de luces del Deck. Se elimina de ese acceso el texto obsoleto de «Pendiente de habilitación» y la derivación a Home Assistant.

No cambia las pantallas del Deck, las páginas personales, multimedia, displays, comunicaciones VISO ni dispositivos existentes. No se modifican el backend, las consolas Google ni la web de producción.

## Validación

- 303 pruebas Vitest aprobadas en 27 archivos, incluidas recuperación de una consulta inicial fallida y recuperación tras fallar la búsqueda posterior al consentimiento y su consulta de respaldo.
- 11 pruebas JVM aprobadas; la prueba nueva verifica que volver a la misma cuenta después de una pausa no restaure permisos de comandos antiguos.
- TypeScript, ESLint, compilación Android con el SDK oficial existente y `apksigner verify` aprobados.
- SDK oficial y puente Google Home presentes en la APK. Pendiente probar el consentimiento y la búsqueda/cambio de color con el Samsung del usuario. No se afirma que esta actualización haya resuelto el error físico.

APK SHA-256: `3ffd1c42831e5abb18d414aca6bd558471876d624c88ede33d0b6a303c2c3287`.

Recuperación: el código anterior está en `bfcc99762ee731d6099dd57245c7d731780a43c3`. La APK 1.5 original se conserva en el sitio de descargas previo, sin sobrescribirla. Android puede impedir instalar una versión inferior encima de esta; no desinstalar como paso de recuperación sin conservar antes los datos locales.

## Prueba física

Instalar la actualización y abrir Deck → estrella → Luces Google Home → Comprobar de nuevo. Autorizar con la cuenta de prueba si Google lo solicita. Seleccionar una sola luz real compatible y guardar. Probar LIBRE/OCUPADO, luego cambiar el estado desde otro dispositivo con la misma cuenta mientras Android está en primer plano. Ante un error, conservar una captura del diagnóstico nuevo para distinguir problemas de cuenta, configuración y SDK.
