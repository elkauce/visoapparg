# VISO Deck 1.6 — estados propios y pantalla encendida

El usuario confirmó físicamente que 1.5.3 vincula Google Home y sincroniza app, web y luces. Esa APK se conserva como referencia. La nueva versión añade nombres/colores personales y mantiene Deck y Display encendidos; estas dos mejoras siguen pendientes de prueba física en el teléfono.

## Estados personalizados

Dentro del editor de una tecla de estado, «O creá tu propio estado» permite escribir un nombre libre y elegir un RGB. «Crear y usar» utiliza la mutación existente `statuses.create`; selecciona el ID recién creado y permite guardar la tecla sin elegir un estado predeterminado. No se codifican listas de nombres personales: «Jugando» y «Pepe» son ejemplos. Se conserva el límite existente de 20 caracteres del backend.

Los estados se guardan en la misma cuenta y se activan con la sincronización existente. Google Home usa el RGB del estado personal que llega desde el backend; cambiar ese RGB vuelve a sincronizarlo. Solo controla las luces previamente seleccionadas y autorizadas, con las mismas comprobaciones de cuenta, primer plano, permisos y compatibilidad. Apagar/limpiar el estado no envía un color inventado. Los seis estados originales conservan sus colores configurados y sus pantallas; no se añaden pantallas predeterminadas.

El usuario aclaró que «otra luz» significaba otro color para su estado personal, no un control adicional de otra lámpara. No se amplía el control directo RGB ni se cambia la configuración de dispositivos.

## Pantalla encendida

Las rutas `/deck`, `/android/display` y el Display público `/s/:slug` solicitan mantener la pantalla encendida. En Android se usa `FLAG_KEEP_SCREEN_ON`, sin permisos nuevos ni un bloqueo de CPU. Al navegar fuera de esas vistas se elimina la bandera; Android no mantiene despierta una ventana que está en el fondo.

La web utiliza Screen Wake Lock mientras la vista está visible, recupera el bloqueo al volver y lo libera al salir. El navegador puede denegarlo por sus políticas o ahorro de batería; no se presenta una denegación como un bloqueo adquirido. Una solicitud que termina después de salir libera inmediatamente su bloqueo.

## Verificación

315 pruebas Vitest en 28 archivos, 16 pruebas JVM, TypeScript, ESLint, compilación Android con el SDK oficial existente y `apksigner verify` aprobados. Las nuevas pruebas cubren crear «Pepe» amarillo sin ningún preset disponible, persistir y asignar el estado a la tecla, sincronizar cambios de RGB recibidos de la cuenta, preservar colores de presets, rechazar RGB inválidos y activar/liberar el bloqueo en Deck y ambos Displays.

APK `com.viso.deck`, versión 1.6.0, `versionCode=10`, mismo backend `vivid-nightingale-785` y mismo certificado SHA-1 `F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`. Instalar como actualización sin desinstalar ni crear credenciales.

SHA-256: `5ec15697a2cc7a08186a3e6630425ec1f703c8d1771314741eb33c570dfef66d`.

La vista web de revisión también pasó las 62 comprobaciones responsivas existentes. En Chromium real se verificó que la ruta HTTPS del Deck obtiene Screen Wake Lock; las rutas del Display y la liberación se cubren en las pruebas de componente.

No se cambian el esquema ni las funciones del backend. La web nueva se prepara en vista previa; producción requiere autorización del usuario. La web existente sigue recibiendo los estados de la cuenta compartida aunque todavía no tenga el editor y el bloqueo de pantalla nuevos.

## Prueba física pendiente

Agregar una página personal y una tecla de estado. Escribir «Pepe», elegir amarillo, tocar «Crear y usar» y guardar la tecla. Activarla y confirmar que aparece en el Display/web y que solo las luces seleccionadas reciben amarillo. Luego volver a LIBRE y verificar su color previo.

Dejar abiertos Deck y Display por más tiempo que el apagado automático configurado y comprobar que sigan encendidos. Navegar a otra pantalla y comprobar que vuelva a respetarse el tiempo normal.

La versión 1.5.3 y su fuente `0942431` siguen disponibles para recuperación. Android puede impedir instalar una versión inferior encima de esta; no desinstalar sin conservar antes los datos locales.
