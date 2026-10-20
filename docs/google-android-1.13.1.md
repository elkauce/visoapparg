# Acceso con Google en Android — 1.13.1

Implementado sobre `fix/viso-deck-reference-layout`, sin modificar `main`. APK `com.viso.deck`, versionCode 24, versionName 1.13.1. La publicación de este ajuste en el servidor y de la descarga web queda pendiente de aprobación del propietario.

## Comportamiento

El acceso de la APK ofrece «Continuar con Google» además de correo y contraseña. Abre el navegador del sistema y regresa a VISO; no abre el consentimiento Google dentro del WebView. La sesión la emite el mismo backend que utiliza la web, por lo que una identidad Google ya vinculada recupera el mismo usuario, deck, páginas, dispositivos y biblioteca.

En Configuración → Cuenta, quien usaba contraseña puede vincular Google a la sesión existente. La vinculación conserva el ID y los datos actuales; no combina cuentas por coincidencia de correo sin demostrar la sesión original. Si ese Google pertenece a otra cuenta VISO, se rechaza la vinculación.

El retorno exacto es `com.viso.deck://oauth/google`, con un nonce aleatorio por intento y código de un solo uso. Android sólo registra ese esquema, host y ruta; los enlaces web y las autorizaciones de Google Home conservan sus recorridos actuales. El intento y su verificador se guardan en el almacén cifrado existente antes de salir al navegador. La app valida el nonce, el vencimiento y el formato antes de canjear mediante Convex Auth. Maneja retorno con la app abierta o cerrada, evita canjes duplicados y permite cancelar sin borrar la sesión existente.

La adaptación del verificador está fijada a `@convex-dev/auth` 0.0.96 y tiene una prueba de contrato contra la implementación instalada. La actualización de esa dependencia requiere revisar este contrato y el adaptador existente de vinculación.

## Configuración y recuperación

Se reutilizan el cliente Google web y su callback HTTPS de Convex. No hacen falta otro proyecto Google ni un nuevo cliente Android de OAuth para este recorrido. No se reemplazan `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, claves de sesión ni la configuración de Google Home. El backend únicamente añade el destino nativo estricto y anuncia `nativeGoogle` en la disponibilidad; una APK contra el servidor anterior mantiene el acceso por contraseña y oculta Google hasta actualizarse.

La APK conserva la firma SHA-1 `F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`, los permisos de 1.13.0 y el SDK de Google Home. No cambia la detección de llamadas, las luces ni el editor. Se conserva la APK 1.13.0, la fuente `b3c1127` y el despliegue web `dpl_C9TqQxSQWGEZLhNhs4XrS8gbMUpq` para recuperación.

## Verificación

Pasaron 573 pruebas del conjunto completo, más tres pruebas adicionales de ajustes Google y una nueva de bloqueo durante un inicio nativo lento. Las 48 pruebas focales del provider, botón, contraseña y ajustes volvieron a pasar tras ese último ajuste. TypeScript frontend/backend, ESLint de los archivos modificados y compilaciones web/Android correctos.

Se verificaron paquete, versión, firma, permisos, SDK Home, destino de producción y retorno nativo dentro del APK. [Reporte del APK](google-android-evidence/apk-report.json).

La [web de revisión](https://viso-deck-android-4v7u1x01b-manuelhaguilar8-4981s-projects.vercel.app) pasó 23 comprobaciones públicas en navegador a 1440, 390 y 320 px, incluyendo Google y contraseña disponibles, callback HTTPS existente y recuperación tras cancelar. No se inició sesión ni se llegó al consentimiento Google. [Evidencia de revisión](google-android-evidence/preview-report.json).

La autorización Google con una cuenta real y la instalación en un teléfono físico quedan pendientes. Las comprobaciones con un proveedor simulado local no equivalen a probar el consentimiento Google real.

## Pase pendiente

Actualizar explícitamente el backend compartido `vivid-nightingale-785`, publicar la web ya compilada en el proyecto existente y verificar disponibilidad, retorno y descarga de APK/QR. No crear proyectos, regenerar credenciales ni cambiar permisos del dispositivo. La APK requiere esa actualización del servidor para ofrecer Google.
