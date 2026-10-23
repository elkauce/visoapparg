# Conectar las llamadas de Timbre con Cloudflare

Esta guía configura el transporte de audio y video entre el visitante y el residente. No activa cobros, no crea licencias y no configura las notificaciones de Android. Una cuenta sin licencia sigue sin poder usar Timbre. Cloudflare no reemplaza la cuenta VISO del usuario.

## 1. Crear el servicio

1. Crear o iniciar sesión en [Cloudflare](https://dash.cloudflare.com/sign-up).
2. Seleccionar la cuenta y abrir [Realtime / Calls](https://dash.cloudflare.com/?to=/:account/calls).
3. En el servicio **TURN**, crear una **TURN key** para VISO Timbre. La ubicación o los textos del menú pueden variar; la [guía oficial de credenciales](https://developers.cloudflare.com/realtime/turn/generate-credentials/) enlaza al panel correspondiente.
4. Conservar el **TURN Key ID** y el **API token de esa clave TURN** en un gestor de contraseñas. No es el token global de Cloudflare, una contraseña de la cuenta ni un secreto coturn. No enviarlos por chat, correo, capturas ni formularios públicos de VISO.

Según la [tarifa oficial consultada el 23 de octubre de 2026](https://developers.cloudflare.com/realtime/turn/faq/), el servicio incluye 1.000 GB antes de empezar a cobrar y el tráfico de salida cuesta USD 0,05 por GB. La documentación consultada no especifica en ese apartado el período de renovación del cupo. Confirmar las condiciones vigentes y cualquier requisito de facturación en el panel antes de aceptarlos. Crear una cuenta o configurar VISO no autoriza una contratación de pago por parte del agente.

## 2. Guardar las credenciales en el backend correcto

En **Timbre → Administración → Conexión de llamadas**, el administrador VISO tiene el listado de variables pendientes y un botón que abre la configuración privada de Convex del backend compilado. El panel informa la configuración guardada; no revela las claves ni afirma que una llamada real haya sido probada.

También se puede abrir directamente [las variables del backend compartido](https://dashboard.convex.dev/d/vivid-nightingale-785/settings/environment-variables). Seleccionar el proyecto `c4-maguilar/visoapparg`, despliegue **`vivid-nightingale-785`**, y abrir **Settings → Environment Variables**. Es el backend compartido actualmente por la web y la APK; no usar el antiguo `useful-egret-915`.

Agregar estas variables, sin prefijo `VITE_`:

| Nombre                             | Valor                                       |
| ---------------------------------- | ------------------------------------------- |
| `TIMBRE_TURN_PROVIDER`             | `cloudflare`                                |
| `TIMBRE_CLOUDFLARE_TURN_KEY_ID`    | El TURN Key ID creado en el paso anterior.  |
| `TIMBRE_CLOUDFLARE_TURN_API_TOKEN` | El API token de esa clave TURN. Es privado. |

Este modo requiere la versión del backend que incluye el adaptador Cloudflare. No copiar el API token a `TIMBRE_TURN_SECRET`: esa variable pertenece al modo coturn y usa otro protocolo de autenticación. No poner valores privados en Vercel, archivos públicos, URLs, QR ni configuración de la APK.

Los lugares vacíos están documentados también en `.env.example`. Ese archivo es una plantilla y no carga variables en el servidor. Después de guardar las tres variables reales en Convex, volver a la sección de configuración y comprobar su estado. No hace falta modificar código ni recompilar la web por cambiar estas credenciales del backend. La publicación del frontend, las licencias comerciales y la compilación Android compatible se gestionan por separado.

El 23 de octubre de 2026 se crearon en `vivid-nightingale-785` los campos de Cloudflare y `TIMBRE_FCM_SERVICE_ACCOUNT`: proveedor `cloudflare`, Key ID vacío, API token vacío y cuenta de servicio vacía. No se reemplazaron variables previas. Este paso deja los lugares preparados y no habilita audio/video, notificaciones ni cobros. El propietario debe editar esos campos desde Convex con sus datos reales.

El servidor pide credenciales temporales para cada participante autorizado a la API oficial `https://rtc.live.cloudflare.com/v1/turn/keys/{TURN_KEY_ID}/credentials/generate-ice-servers`. La app recibe esas credenciales temporales, nunca el API token. La vigencia queda limitada por el vencimiento de la llamada y un margen de un minuto. La conexión utiliza relay y descarta el puerto 53, que puede bloquear el navegador.

Si el entorno de desarrollo usa una política de red restringida, las pruebas de esa API necesitan una regla para `rtc.live.cloudflare.com`; la prueba de conectividad TURN necesita también acceso real al relay y sus puertos. No desactivar TLS ni el proxy para evitar esas restricciones. La configuración de red del entorno de desarrollo no modifica la red del teléfono o del backend alojado.

## 3. Comprobar una llamada real antes de promover la web

1. Usar un entorno de revisión y una cuenta con una licencia autorizada para ese entorno. Los datos sintéticos de laboratorio no son ventas ni habilitan producción.
2. Crear un Timbre y su QR apuntando al dominio de revisión correcto; abrir VISO con la cuenta destinataria.
3. Escanear desde otro teléfono conectado a datos móviles mientras el residente usa otra red. Permitir micrófono y cámara al iniciar o atender.
4. Probar audio en ambos sentidos, video, rechazo, colgado, llamada perdida, varios destinatarios y una sesión de más de cinco minutos. Comprobar que los candidatos ICE seleccionados sean relay.
5. Comprobar estados y luces con los equipos reales, además de la restauración al finalizar y el respeto de los cambios manuales.
6. Revisar los datos de uso del servicio y el manejo de errores antes de aprobar el pase público. Tener las variables guardadas no demuestra conectividad ni equivale a una prueba de llamada.

### Comprobación privada del proveedor

El operador con acceso administrativo al despliegue puede ejecutar `convex run timbre_setup:verifyCloudflare '{}' --deployment vivid-nightingale-785 --codegen disable --typecheck disable`. Es una acción interna: no se publica como un endpoint para visitantes, no impersona una cuenta VISO y no requiere recuperar las claves del servidor.

El diagnóstico solicita credenciales con vigencia menor a 90 segundos y revoca inmediatamente cada usuario temporal distinto. Devuelve únicamente estado y cantidad de direcciones relay: nunca el Key ID, el API token, usuarios o contraseñas temporales, ni el cuerpo de errores del proveedor. No crea llamadas, licencias ni tráfico multimedia. Si la revocación no se confirma, lo informa y las credenciales caducan pronto.

El 23 de octubre de 2026 Cloudflare aceptó los datos reales guardados por el propietario, emitió credenciales con seis direcciones relay y confirmó su revocación. El [registro sin secretos](validation/timbre-cloudflare-check.json) conserva ese resultado. **Esto comprueba la API de credenciales; no demuestra audio/video ni conectividad entre dos redes.** Los planes, las licencias y la configuración Firebase se comprueban por separado.

### Prueba interna autorizada

El propietario autorizó expresamente una prueba de siete días para su cuenta administradora existente: audio y video, un inmueble y un QR, sin cobros ni acceso gratuito para otros usuarios. El operador del despliegue puede otorgarla con la mutación interna `timbre_trial:grantApprovedTrial`, indicando el correo exacto autorizado. No es una función pública ni permite impersonar una sesión VISO. El correo sólo identifica una cuenta cuyo ID ya debe pertenecer a la lista inmutable de administradores.

El comando crea una licencia con origen `internal_trial`, un plan deshabilitado sin precio, el inmueble «Timbre de prueba», su membresía de propietario y un QR «Prueba VISO». No crea compras ni pagos. Repetirlo conserva el vencimiento y el QR; una prueba vencida o revocada requiere revisión y no se renueva automáticamente. El enlace devuelto se entrega únicamente al propietario y no se incorpora a este repositorio ni a los informes públicos.

Para probar, el propietario debe ingresar a [Timbre](https://viso-deck-android.vercel.app/timbre) y mantener VISO abierto. En otro dispositivo y, preferentemente, otra red, abrir el enlace del QR y tocar **Llamar** o **Videollamar**, permitiendo micrófono/cámara. En la sesión propietaria, abrir **Ver llamada** y tocar **Atender**. Comprobar audio en ambos sentidos, video y finalización. La disponibilidad del QR y las credenciales aceptadas por Cloudflare no reemplazan esa prueba entre dispositivos reales.

El 23 de octubre de 2026 se otorgó la prueba individual aprobada, con vencimiento el 30 de octubre a las 16:01 de Argentina. Se verificaron la licencia, membresía y destinatario, un inmueble y un QR, disponibilidad pública de audio/video y transporte configurado. El [registro de validación](validation/timbre-internal-trial.json) omite la identidad y el enlace del propietario. No se originaron llamadas ni se activaron cobros. La recepción con VISO cerrado continúa pendiente de Firebase y una compilación Android compatible.

## Recepción con Android en segundo plano

Cloudflare transporta audio/video; no despierta la app. Para recibir avisos con VISO en segundo plano faltan Firebase Cloud Messaging, su cuenta de servicio privada en Convex y una APK nueva compilada para ese proyecto. El envío de avisos FCM es gratuito; seguir [la preparación de Firebase](timbre-firebase.md) y [las capacidades nativas](timbre-native-capabilities.md). La web abierta puede recibir el aviso implementado sin FCM. No se garantiza recepción después de forzar la detención de la app ni continuidad de una llamada con el WebView suspendido.

## Rotación y reversión

Si una clave se expone, revocarla en Cloudflare y crear otra; reemplazar sus valores en Convex. Eliminar el token o usar un proveedor incompleto deja audio/video no disponible, sin convertirlo a un servicio público anónimo. El modo coturn existente puede seguir utilizándose con sus propias URI y secreto; no mezclar credenciales entre proveedores.
