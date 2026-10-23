# VISO Timbre: configuración, revisión y despliegue

Documento operativo para la rama `feat/viso-timbre`. Complementa el [mapa de integración](timbre-integration.md) y las [capacidades y limitaciones nativas](timbre-native-capabilities.md). Las instrucciones siguientes describen cómo preparar y validar un entorno; no representan un despliegue realizado.

## Entornos y datos existentes

Timbre usa las cuentas de Convex Auth, el panel, la biblioteca, los estados y el checkout de VISO. No necesita otra cuenta ni otra aplicación para el residente. El visitante abre una página pública sin registrarse.

La ampliación de esquema es aditiva: `timbre_tables.ts`, `timbre_commerce_tables.ts`, `timbre_calls_tables.ts`, las tablas de notificaciones y las de arbitraje de presencia se incorporan al esquema existente. No hay conversión masiva de usuarios, reinicio de sus configuraciones ni licencia gratuita por registrarse.

Las tablas de Timbre comienzan vacías. Los usuarios existentes siguen sin licencia hasta un pago verificado, una compra expresamente elegible o un contrato comercial pagado registrado por un administrador. No ejecutar un seed que asigne licencias a todas las cuentas. Los productos del marketplace ya adquiridos no sustituyen una licencia del servicio.

Los diseños completos con imagen se guardan por separado en `timbreQrDesigns` y `timbrePlateDesigns`. Los documentos de QR y pedidos conservan resúmenes sin la imagen; los listados no descargan cientos de imágenes a la vez. La exportación autorizada une solamente el diseño seleccionado. Hay compatibilidad de lectura con diseños inline de un prototipo anterior; si una base de revisión tuviera esos datos, migrarlos por lotes a las tablas separadas antes de probar un catálogo voluminoso. La producción anterior a esta ampliación no contiene estas tablas.

Preparar una base de revisión separada y un dominio HTTPS estable antes de crear QR destinados a impresión. Copiar solamente la configuración necesaria del entorno; no exportar datos personales de producción a pruebas. Usar usuarios y pagos de prueba identificables en revisión. No apuntar una APK de laboratorio a la base productiva por omisión.

## Variables y credenciales

Configurar los valores privados desde la administración del backend o el gestor de secretos del despliegue. No guardarlos en archivos versionados, parámetros de URL, capturas, formularios del panel ni variables `VITE_`.

| Variable o archivo | Dónde se configura | Uso |
| --- | --- | --- |
| `VITE_CONVEX_URL` | Compilación web | URL pública del backend Convex del entorno. |
| `VITE_CONVEX_SITE_URL` | Compilación web | Origen HTTP Convex del mismo entorno. |
| `VITE_PUBLIC_APP_URL` | Compilación web y APK | Origen público HTTPS de VISO para enlaces `/t/:qr` y archivos impresos. Debe ser un dominio estable, accesible por visitantes. |
| `VITE_VISO_WEB_URL` | Compilación APK | URL pública web de la navegación Android existente y alternativa para el origen canónico de Timbre cuando no se definió `VITE_PUBLIC_APP_URL`. |
| `SITE_URL` | Backend | Origen HTTPS web usado por autenticación y retornos del checkout. |
| `CONVEX_SITE_URL` | Backend | Origen HTTPS del backend HTTP, usado para webhooks. |
| `MARKETPLACE_ADMIN_USER_IDS` | Backend | Identificadores inmutables de los administradores VISO autorizados; se reutiliza la administración existente. |
| `TIMBRE_TURN_URLS` | Backend | Lista JSON o lista separada por comas de URI `turn:`/`turns:` de un servicio TURN compatible con autenticación REST. |
| `TIMBRE_TURN_SECRET` | Secreto backend | Secreto compartido TURN REST de al menos 32 caracteres. Nunca enviarlo al navegador ni a la APK. |
| `TIMBRE_FCM_SERVICE_ACCOUNT` | Secreto backend | JSON de cuenta de servicio del proyecto Firebase autorizado para FCM HTTP v1. Contiene `project_id`, `client_email`, `private_key` y `type: service_account`. |
| `TIMBRE_RECURRING_ENABLED` | Backend | La cadena exacta `true` permite contratar recurrencia únicamente si también están preparados Mercado Pago live y sus controles existentes. Ausente o distinto de `true`: deshabilitada. No activarla para probar la UI. |
| `android/app/google-services.json` | Configuración local Android | Configuración Firebase de la aplicación `com.viso.deck`, del mismo proyecto que el backend FCM. Mantener fuera de Git. |
| `VISO_TIMBRE_FCM_ENABLED=1` | Compilación Android | Incluye Firebase Messaging cuando también existe `google-services.json`. Sin ambos, la APK informa que push no está disponible. |

La autenticación Google existente mantiene sus propias credenciales y certificados; no sustituirlos por la cuenta de servicio FCM ni modificar el vínculo de Google Home para agregar Timbre.

La APK utiliza un origen interno como `https://localhost`. Ese origen no sirve para un QR impreso. El helper canónico elige `VITE_PUBLIC_APP_URL`, después `VITE_VISO_WEB_URL` y rechaza un origen de producción inseguro. El script Android propaga el origen público configurado. Verificar el valor compilado y escanear el archivo resultante desde otro dispositivo antes de vender o fabricar una placa.

### TURN

Contratar o administrar un servidor TURN con autenticación REST compatible con coturn. Configurar un nombre DNS, certificados válidos para `turns:`, puertos anunciados accesibles y el rango de puertos de relay en el firewall del servidor. Utilizar las URI reales del proveedor; no publicar una contraseña TURN permanente como configuración del cliente.

El backend firma credenciales temporales para una llamada autorizada hasta su vencimiento más 60 segundos, con un máximo de 21 minutos desde su emisión. Las llamadas están acotadas a 20 minutos. La configuración usa `iceTransportPolicy: relay`; no depende de que ambas personas compartan Wi-Fi ni expone un secreto compartido. Si falta configuración válida, no se habilitan llamadas reales de audio o video. El chat puede funcionar sin TURN cuando el plan lo permite.

Verificar al menos una ruta UDP y una TCP/TLS cuando el proveedor las ofrezca. Probar audio y video entre Wi-Fi y red móvil, y entre dos redes empresariales distintas. Incluir una llamada de más de cinco minutos para comprobar la vigencia del relay hasta el límite de la sesión y probar pérdida de conectividad. No hay reinicio ICE automático; si la red no se recupera, finalizar y volver a llamar. La validación de configuración o de HMAC en una prueba automatizada no demuestra conectividad del relay.

### Notificaciones Android

La configuración FCM de Android no contiene la clave privada de la cuenta de servicio. Esa clave queda exclusivamente en `TIMBRE_FCM_SERVICE_ACCOUNT` del backend. Dar al servicio solamente los permisos necesarios para enviar mensajes del proyecto correspondiente y habilitar FCM HTTP v1. El backend necesita acceso HTTPS a `oauth2.googleapis.com` y `fcm.googleapis.com`.

La inscripción requiere consentimiento del usuario, permiso de notificaciones concedido y una sesión VISO válida. Cada token se atribuye a esa cuenta y dispositivo; al cerrar sesión debe darse de baja y borrarse la configuración local. Los tokens rotados se sincronizan al reanudar. El backend no envía notificaciones a una cuenta que ya no pertenece al Timbre o dejó de ser destinataria.

Los mensajes son `data-only`, de prioridad alta y TTL corto. Contienen identificación opaca de llamada, cuenta receptora y vencimiento, no dirección, teléfono, SDP, ICE ni autorización de cerradura. El aviso abre VISO y vuelve a verificar sesión, licencia, destinatario y estado de llamada. No atiende ni activa micrófono o cámara automáticamente.

No se garantiza recepción con una aplicación detenida por la fuerza. No se implementó continuidad de audio/video con el WebView suspendido o bloqueado. Android 14+ limita los avisos de pantalla completa; se respeta el canal de notificación, No molestar y las decisiones del usuario. No hay aplicación iOS nativa, APNs ni CallKit en este repositorio. El navegador requiere VISO abierto para la recepción interactiva implementada.

### Mercado Pago

Se reutilizan las credenciales y controles del checkout existente:

- `MP_APPLICATION_ID`, `MP_CLIENT_SECRET` y `MP_ACCESS_TOKEN` para la aplicación y la cuenta receptora.
- `MP_COLLECTOR_ID` para verificar el destinatario real del pago.
- `MP_WEBHOOK_SECRET` para autenticar notificaciones.
- `MP_TOKEN_ENCRYPTION_KEY`, una clave de 32 bytes codificada en base64, para las credenciales de vendedores ya existentes.
- `MP_MODE`, coherente con las credenciales y los usuarios de prueba o producción. El código distingue `live` del modo de prueba.
- `SITE_URL` y `CONVEX_SITE_URL` del mismo entorno.

El formulario de credenciales no pertenece a la UI Timbre. Una Public Key del proveedor no reemplaza estos secretos; Checkout Pro redirige al proveedor y el backend confirma el pago.

El callback OAuth existente es `/marketplace/payments/oauth/callback`; el webhook es `/marketplace/payments/webhook`. Mantener las URL HTTPS autorizadas en la aplicación Mercado Pago del entorno. Un retorno exitoso del navegador no emite una licencia: el backend verifica firma, importe, moneda, cuenta receptora, referencia, modo y duplicados.

Los controles `enabled`, `splitApproved` y `policiesAccepted` de la configuración existente siguen siendo obligatorios. Agregar secretos no los activa. El trabajo de Timbre no habilita silenciosamente cobros ni da por aprobada la prueba comercial de split pendiente.

Los pagos únicos en ARS y las placas configuradas tienen reserva e integración con el checkout. Las modalidades mensual y anual cuentan con un adaptador de suscripciones separado en `timbre_recurring.ts`; queda **deshabilitado por defecto y pendiente de validación externa**. Habilitarlo exige `TIMBRE_RECURRING_ENABLED=true`, `MP_MODE=live`, credenciales y controles comerciales existentes completos. No se habilitó esa bandera ni se efectuaron cargos como parte del desarrollo.

Para recurrencia, registrar además el webhook HTTPS `/timbre/payments/webhook` del backend del entorno y los temas `subscription_preapproval`, `subscription_authorized_payment` y `payment`. Se utiliza la firma del proveedor y se comprueba que los identificadores del cuerpo y de la URL correspondan. No redirigir estas notificaciones a un endpoint de activación gratuito ni usar el retorno del checkout como comprobante de pago.

La autorización de la suscripción no concede licencia. El backend consulta los recursos canónicos del proveedor y verifica la suscripción, la factura y el pago del período: modo live, pagador, receptor, aplicación, referencia, moneda, importe y fechas. Solo un período aprobado y verificado aporta cobertura. Las fechas se calculan por meses de calendario —uno o doce según la modalidad—, no como una licencia vitalicia ni por el simple valor configurable `durationDays` de un producto de pago único.

Los períodos se deduplican por factura y pago; no pueden reutilizarse en otra compra. La renovación válida actualiza la misma licencia de suscripción, conservando los QR del inmueble. El vencimiento se aplica en la autorización del backend aunque una pantalla aún mostrara un estado anterior. Devoluciones/contracargos retiran la cobertura afectada; una revocación administrativa no se deshace al recibir un pago posterior. Cancelar exige solicitarlo al proveedor y reconsultar su confirmación; no se declara una baja inexistente. La cobertura ya pagada se conserva hasta su término según el registro verificado.

Una respuesta incierta al crear una autorización no se repite automáticamente: puede existir ya un recurso en Mercado Pago y requiere conciliación. La configuración informa `externallyValidated:false`; tener el adaptador, una bandera activa o pruebas sintéticas no certifica validación del proveedor. Antes de ofrecer cobros recurrentes se requiere una prueba externa autorizada de contratación, primer pago, renovación, rechazo, baja, devolución y reintentos. No presentar una venta de pago único como renovación automática.

## Rutas y contratos principales

| Ruta | Público | Función |
| --- | --- | --- |
| `/timbre` | Cuenta VISO para administrar | Timbres, disponibilidad, integrantes, unidades, QR, historial, catálogo y administración autorizada. |
| `/t/:qr` | Sí | Directorio mínimo de unidades y comunicación del visitante según licencia y disponibilidad. El QR contiene un token aleatorio, no información de la cuenta. |
| `/timbre/call/:callId` | Depende del participante | Sesión de llamada autorizada por la cuenta destinataria o una capacidad temporal del visitante. El identificador de llamada solo no autoriza. |
| `/marketplace` | Navegación existente | Acceso comercial integrado a Timbre; no es otro marketplace. |

El alojamiento web debe servir la aplicación en rutas directas y aplicar el fallback SPA. Mantener HTTPS, WebSocket hacia Convex y las políticas de cámara/micrófono correspondientes al origen. No incrustar la página visitante en un iframe que bloquee `getUserMedia`.

No se agregó una asociación universal de todos los enlaces HTTPS de Timbre a Android. El QR del visitante sigue abriéndose en el navegador. El toque en la notificación nativa usa el adaptador `VisoTimbre` para abrir VISO y revalidar la llamada. Si se incorporan Android App Links después, configurar el dominio, `assetlinks.json`, paquete y huella del certificado real de distribución; no reutilizar la ruta OAuth Google como acceso a una llamada.

### Gestión y autorización de inmuebles

`timbre.workspace` lista los Timbres y membresías del usuario actual. `createSite` exige `licenseId` válido del propietario. `saveSiteSettings` controla disponibilidad, audio/video, chat, mensajes, destinatarios, alternativa, horario y zona horaria. Los horarios admiten franjas nocturnas que continúan al día siguiente (por ejemplo, lunes 22:00 a martes 02:00), sin superposiciones entre días. Un propietario puede desactivar el servicio aunque su licencia haya vencido.

`changeSiteLicense({siteId,licenseId})` permite renovar o mejorar un Timbre conservando sus QR. Solo el propietario puede aplicar otra licencia válida de su misma cuenta. El backend verifica tipo de inmueble, capacidad de la licencia destino y cantidad actual de QR, integrantes y unidades. No modifica beneficios comprados ni reasigna una licencia ajena.

Las cuotas tienen esta semántica:

- `maxSites`: cantidad de Timbres vinculados a una licencia; tope operativo de 100.
- `maxQrs`: QR no revocados por Timbre; pausar un QR no libera la cuota; revocarlo sí. Tope operativo de 1.000.
- `maxMembers`: integrantes por Timbre, incluido el propietario; tope operativo de 1.000.
- `maxUnits`: unidades habilitadas por Timbre; tope operativo de 1.000.

Las licencias conservan una copia de funciones y límites adquiridos. Editar un plan del catálogo no altera retroactivamente esas copias. Audio, video, chat y mensajes se autorizan intersectando el plan comprado con las preferencias actuales del inmueble.

`createQr`, `saveQr`, `rotateQr`, `revokeQr`, `saveQrDesign` y `qrForExport` administran los QR. Pausar o reactivar conserva el enlace impreso; rotar o revocar invalida el anterior. No se puede rotar un QR asociado a una placa en producción o lista para despacho. La revocación de seguridad sigue disponible.

`createUnit`/`saveUnit`, `listMembers`/`saveMember`/`removeMember` y las invitaciones administran hogares y edificios. Las invitaciones usan tokens aleatorios de un solo uso, guardados como hash, con duración de 1 a 168 horas. Las dirigidas a un correo requieren esa cuenta y un correo verificado. La aceptación vuelve a comprobar licencia, cupo, unidades y autoridad actual de quien invitó. Un responsable no puede otorgar o modificar al propietario ni otros responsables. Al quitar un integrante se eliminan sus destinatarios asignados.

`publicQr` devuelve solamente nombres públicos de acceso/inmueble/unidades, funciones y disponibilidad. No entrega teléfonos, correos, destinatarios, identificadores de licencia ni cuentas. Un token de QR no permite editar el inmueble, recibir una llamada como residente o abrir una cerradura.

### Comunicación y notificaciones

`timbre_calls.startCall` valida QR, unidad, plan, disponibilidad y límites; crea una capacidad de visitante guardada como hash. `accept` resuelve quién atendió primero. `session`, `signals`, `sendSignal`, `getRtcConfiguration`, `chat`, `sendMessage`, `heartbeat` y `end` comprueban al participante; `incoming` es autenticada. La revocación de acceso se revalida sin impedir la limpieza de una llamada.

Los límites por QR siguen aplicándose aunque el cliente cambie su identificador local. Ese identificador se almacena como hash acotado al inmueble. Las mutaciones Convex no ofrecen una IP de origen confiable al código de la aplicación: no se declara protección por IP. Un despliegue de mayor volumen requiere evaluar controles adicionales de abuso en un perímetro confiable, sin aceptar una IP arbitraria enviada por el visitante.

El timbrado vence a los 90 segundos. Las llamadas tienen un máximo de 20 minutos y leases de presencia de 90 segundos; necesitan heartbeat. El backend programa limpieza de señalización, mensajes y llamadas. Mensajes e historial tienen retenciones limitadas; consultar el módulo de llamadas para el contrato exacto vigente antes de definir una política comercial de conservación.

El arbitraje de presencia comparte un episodio por cuenta entre telefonía, agenda y Timbre. La llamada aceptada usa `En llamada`; una modificación manual invalida la restauración automática de ese episodio. Se reutilizan los adaptadores de estados y luces. La agenda representa un evento programado y la telefonía del sistema no equivale a detección universal de WhatsApp/Meet. Ver las limitaciones nativas antes de anunciar esas capacidades.

`timbre_push.registerDevice`/`unregisterDevice` requieren sesión; `configuration` informa preparación del servidor. Los endpoints internos de entrega y las credenciales del proveedor no son API del visitante.

`timbre_recurring.configuration`, `mySubscriptions`, `createSubscriptionCheckout`, `refreshSubscription` y `cancelSubscription` exponen a la cuenta su contratación y seguimiento. Las operaciones internas de verificación de períodos no son endpoints del cliente. El webhook firmado obtiene evidencia canónica del proveedor antes de actualizar una licencia.

### Impresión, pedidos y producción

El diseño compartido admite texto, emblemas y PNG/JPEG hasta 700 KiB y 4096 × 4096 píxeles. El backend verifica formato, límites y contraste; no acepta SVG subido por un visitante. La representación de impresión conserva QR oscuro sobre fondo claro, contraste mínimo 7:1, zona silenciosa de cuatro módulos y corrección H. El texto exige contraste 4,5:1. Las dimensiones son de 50 a 300 mm y la sangre de 0 a 5 mm.

El exportador comprueba el QR contra el raster real antes de entregar PNG/SVG/PDF. PNG incluye resolución física de 300 dpi; PDF mantiene el QR vectorial y cajas de corte/sangrado. Esa comprobación digital no sustituye la prueba de impresión sobre el material ofrecido. Una imagen de fondo no debe cubrir la zona del QR.

El administrador configura variantes, precio, material, garantía, instrucciones y envíos reales. No hay un material, transportista, plazo o precio inventado por defecto. Una variante puede incluir una licencia explícita; una placa sin ese beneficio exige un QR de una cuenta licenciada. La compra conserva una copia del diseño, variante, precio y condiciones.

`productionExport` exige un pedido pagado, QR propio y licencia válida. El token se fija al pedido: un cambio previo requiere volver a adjuntar la versión actual antes de fabricar. El PDF generado se sube mediante un URL de carga autorizado y `recordProductionFile` comprueba el token esperado, metadatos y estado del pedido antes de archivarlo. Desde producción no se reemplaza ese archivo. No se permite marcar manualmente un pago como aprobado.

Transiciones de producción permitidas: pagado → producción → listo → despachado → entregado. Para comenzar hacen falta pago confirmado, QR y archivo; para despachar se registran transportista y seguimiento reales. Reintegros y contracargos se concilian con el proveedor y pueden revocar el beneficio de licencia. No se implementó emisión fiscal automática ni contratación automática de transportistas; deben resolverse según la operación comercial real.

## Secuencia de revisión antes de publicar

1. Revisar el diff de la rama separada y la configuración de esquema; conservar la autenticación y los adaptadores existentes. Ejecutar instalación reproducible con el lockfile.
2. Generar las referencias Convex del código de esta rama para la base de revisión. No apuntar codegen/despliegue al entorno productivo por error. Publicar primero el backend de revisión y después su frontend; una web nueva necesita las API nuevas.
3. Ejecutar comprobaciones locales. Los comandos directos evitan una instalación automática inesperada si el gestor de paquetes no tiene acceso a su almacén:

   ```sh
   node node_modules/typescript/bin/tsc -b --pretty false
   node node_modules/vitest/vitest.mjs run
   node node_modules/eslint/bin/eslint.js . --max-warnings=0
   node node_modules/vite/bin/vite.js build
   ```

4. En revisión configurar TURN y, si se prueba push, FCM real del proyecto de revisión. Confirmar que una cuenta sin licencia sigue bloqueada. No activar pagos productivos para una prueba técnica.
5. Configurar un plan real como administrador y probar el circuito comercial con cuentas y modo correctos. Una licencia de prueba utilizada por pruebas automatizadas no demuestra un pago del proveedor. Verificar callback, webhook, repetición, devolución y revocación.
6. Compilar Android con URLs explícitas del entorno. El script `scripts/build-android.mjs` admite `VISO_ANDROID_CONVEX_URL`, `VISO_ANDROID_CONVEX_SITE_URL`, `VISO_ANDROID_WEB_URL`, modo `--local-test` y `--web-only`. Para una APK con recepción FCM también hace falta `VISO_TIMBRE_FCM_ENABLED=1` y el archivo Firebase local. No distribuir el modo HTTP de prueba ni claves de firma.
7. Confirmar la identidad, firma y versión de la APK y usar el canal de distribución autorizado. No dar por validada la instalación en un Samsung S26 porque se instaló en un S9. Revisar el eventual bloqueo de Play Protect mediante distribución y revisión apropiadas; no basar el procedimiento comercial en desactivar la protección del dispositivo.
8. Completar la matriz física siguiente, registrar resultados y separar lo pendiente. Solicitar la aprobación de publicación sobre el resultado de revisión y los requisitos externos pendientes. No modificar `main` ni desplegar producción sin la autorización correspondiente.

No se efectuó un despliegue de producción ni se cargaron secretos como parte de estas instrucciones. Al autorizar una publicación se deben usar las herramientas del proyecto con el entorno seleccionado explícitamente; los ejemplos de configuración no constituyen autorización de cobro real.

## Matriz de validación física y del proveedor

| Área | Comprobación pendiente fuera de las pruebas unitarias |
| --- | --- |
| QR | Escanear PNG, SVG rasterizado y PDF desde teléfonos distintos; imprimir al tamaño real, medir márgenes y probar sobre cada acabado ofrecido. Verificar el dominio público. |
| Audio/video | Dos cuentas/dispositivos y redes diferentes; conexión por TURN, permiso denegado, audio sin cámara, cambio de red, más de cinco minutos y colgado de ambas partes. |
| Visitante | Acceso sin cuenta, directorio de unidades, datos privados ausentes, horario/silencio/desactivación, mensajes de ausencia y límites de abuso. |
| Android | S9, S26 y tablet; permiso de avisos y micrófono/cámara; primer plano, fondo, bloqueo, proceso eliminado y force-stop; cambio de cuenta, token FCM rotado y aviso tardío. |
| Concurrencia | Dos residentes atendiendo a la vez; usuario eliminado de una unidad; revocación de QR/licencia durante una sesión; telefonía/agenda/Timbre superpuestos y cambio manual de estado. |
| Luces y equipos | Google Home realmente autorizado y luces seleccionadas, Display/Deck y dispositivo físico disponible. Confirmar color y restauración; no prometer drivers nuevos o reacción con proceso cerrado no comprobada. |
| Mercado Pago | Prueba del proveedor en el modo correcto, receptor/importe, pago pendiente/rechazado/aprobado, callback sin webhook, webhook repetido, devolución/contracargo y activación única de hardware elegible. |
| Placas | Dirección/envío real configurado, copia del diseño, token inmutable durante fabricación, archivo archivado, fabricación, seguimiento y entrega. |
| Regresión | Inicio Google/password, vínculo Google Home, editor completo del Deck, contenido de páginas, Display, marketplace y estados existentes. |

Registrar para cada prueba fecha, versión, dispositivo/navegador, entorno, resultado y evidencia sin secretos. Hasta completarlas, describir audio/video entre redes, recepción nativa y fabricación como pendientes de validación externa, aunque las pruebas de autorización y estado pasen.

## Operación y recuperación

Pausar un QR o el Timbre conserva el material impreso; revocarlo lo invalida. Para renovar, aplicar una licencia pagada válida con `changeSiteLicense`. Para una cuenta comprometida, revocar las sesiones y dispositivos de notificación correspondientes, además del QR cuando sea necesario; no usar un nuevo enlace público como reemplazo de un cambio de credenciales.

Conservar una copia de seguridad antes de cambios de producción. Si se revierte el frontend, no borrar tablas, licencias, pedidos ni archivos pagados. Mantener los endpoints necesarios para colgar y limpiar sesiones activas. Una reversión de software no equivale a cancelar una suscripción en el proveedor ni reintegrar una compra.

Revisar consumo de TURN, errores FCM y colas de pago/fabricación sin registrar claves, capacidades de visitante o SDP completos. Las imágenes de diseño están acotadas por documento y separadas de los listados. Antes de aumentar los topes operativos, incorporar paginación de directorios e historial y revisar los presupuestos de lectura, almacenamiento, notificaciones y relay; no anunciar una escala que no se haya probado.

Las cerraduras no tienen un proveedor conectado en esta entrega. La opción comercial de acceso no habilita una acción física. Incorporar una cerradura exige registro de dispositivo, autenticación del residente, autorización explícita por inmueble/unidad, auditoría y prueba física independiente. El QR público nunca es una orden de apertura.
