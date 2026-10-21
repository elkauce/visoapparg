# Cobros del marketplace con Mercado Pago Argentina

La integración queda preparada y desactivada. Agregar las credenciales y configurar el panel no requiere modificar el código ni compilar otra APK. La habilitación comercial de split/OAuth de Mercado Pago y su prueba completa siguen pendientes: las pruebas automatizadas usan respuestas simuladas, no cargos reales.

## Configuración segura del servidor

Crear una aplicación de Mercado Pago Argentina para VISO y configurar estas variables **en el backend Convex que usa la web y la APK**. No colocar tokens en variables `VITE_*`, en archivos públicos, productos, capturas ni mensajes.

| Variable                  | Contenido                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `MP_APPLICATION_ID`       | ID de la aplicación de Mercado Pago. No es la public key.                                                                 |
| `MP_CLIENT_SECRET`        | Client secret de esa aplicación; se usa para vincular las cuentas de los creadores.                                       |
| `MP_ACCESS_TOKEN`         | Access token de la cuenta de VISO para sus productos propios.                                                             |
| `MP_COLLECTOR_ID`         | ID de usuario/cobrador de la cuenta de VISO, para verificar el destinatario de sus ventas. No es el ID de la aplicación.  |
| `MP_WEBHOOK_SECRET`       | Secreto de firma de las notificaciones de la aplicación.                                                                  |
| `MP_TOKEN_ENCRYPTION_KEY` | Clave aleatoria de 32 bytes codificada en base64. Cifra las autorizaciones de los creadores con AES-GCM.                  |
| `MP_MODE`                 | `test` al comenzar; `live` únicamente después de completar las pruebas y habilitación comercial. Si falta, se usa `test`. |
| `MP_REDIRECT_URI`         | Opcional: URL HTTPS exacta del callback. Si falta se deriva de `CONVEX_SITE_URL`.                                         |

También deben estar correctas las variables existentes `CONVEX_SITE_URL` y `SITE_URL`. `SITE_URL` es la web VISO; `CONVEX_SITE_URL` es el dominio HTTP del backend. Mantener la clave de cifrado en un gestor seguro: reemplazarla sin una migración impide leer las autorizaciones existentes y obliga a reconectar las cuentas.

Para el backend actual, el callback que se registra en la aplicación de Mercado Pago es:

```
https://vivid-nightingale-785.convex.site/marketplace/payments/oauth/callback
```

Debe coincidir exactamente con `MP_REDIRECT_URI`, si se define. Las autorizaciones duran diez minutos, son de un solo uso y pertenecen al usuario VISO que las inició. Se admite inicialmente una cuenta de cobro argentina por creador, sin compartirla entre usuarios VISO.

El endpoint de notificaciones es:

```
https://vivid-nightingale-785.convex.site/marketplace/payments/webhook
```

Cada preferencia de Checkout Pro envía su propia `notification_url`, agregando `?order_id=...`. Hay que comprobar en la prueba del proveedor que ese parámetro se conserva y que llegan `data.id`, `x-signature` y `x-request-id`. Un evento global sin esa referencia no concede recursos.

## Preparar vendedores y comisiones

1. En el panel de administración del marketplace, definir los porcentajes para digital y hardware por separado. No hay un porcentaje impuesto: un campo vacío deja esa categoría sin cobro. Se aceptan dos decimales.
2. Cada creador aprobado entra en su espacio y elige **Conectar Mercado Pago**. Autoriza en el sitio oficial del proveedor y vuelve a VISO; nunca entrega su contraseña a VISO. En Android puede regresar a la app después de autorizar: el vínculo pertenece a su cuenta y aparece al recuperar la conexión.
3. Confirmar con Mercado Pago que la aplicación tiene habilitado split 1:1/OAuth en Argentina. No basta con tener una cuenta de Mercado Pago ni con haber completado las variables.
4. Definir y publicar las reglas de devoluciones, contracargos, soporte y facturación. Informar quién absorbe el costo del procesador y de una devolución. Un archivo ya descargado no puede retirarse del dispositivo; VISO registra los estados devuelto/contracargo sin borrar páginas o archivos personales de forma silenciosa.
5. Marcar las dos confirmaciones del panel y habilitar **pagos de prueba**. La activación real utiliza la misma pantalla, después de cambiar `MP_MODE` a `live` y completar las verificaciones.

Las comisiones de VISO se guardan en cada pedido. Cambiar un porcentaje afecta a las compras futuras; no recalcula pedidos anteriores. Los productos propios de VISO llevan comisión VISO cero. Mercado Pago puede cobrar una tarifa adicional, por lo que el importe mostrado al creador antes de esos costos es una estimación y no una liquidación garantizada.

Los recursos gratuitos se agregan sin checkout. Los enlaces de afiliado y las compras externas se pagan en el sitio externo y **no** llevan comisión ni split VISO. Los cobros integrados de esta primera etapa usan ARS y una compra contiene un único vendedor. **El checkout integrado de hardware permanece bloqueado**, incluso al cargar credenciales: primero necesita un flujo de entrega, garantía y soporte. Se puede vender hardware por enlace externo; su porcentaje queda configurable para una futura incorporación de ese flujo.

## Verificación obligatoria antes de cobrar en real

La documentación oficial del proveedor no pudo consultarse desde este entorno por su política de red. Antes de habilitar `live`, revisar el contrato vigente y realizar la prueba en la aplicación real de Mercado Pago. Comprobar especialmente:

- OAuth `/authorization`, canje y renovación `/oauth/token`, identidad `/users/me` y habilitación para cuentas de Argentina.
- Que Checkout Pro acepte `marketplace_fee` con el token OAuth del vendedor, y que el reparto y los costos reales coincidan con el pedido. Confirmar los campos de comisión del pago devuelto por el proveedor; actualmente VISO comprueba importe, moneda, cobrador, referencia y modo, pero la liquidación de la comisión debe contrastarse en esta prueba.
- Que el proveedor respete `notification_url` por preferencia y el parámetro `order_id`.
- Firma del webhook y vigencia del timestamp. La implementación utiliza el manifiesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y HMAC SHA-256. Rechaza firmas ausentes o vencidas y consulta después `/v1/payments/:id` con autorización del vendedor; no confía en el estado recibido en el cuerpo ni en la vuelta del navegador.
- Medio aprobado, pendiente, rechazado, cancelado, reintento después de rechazo, devolución y contracargo. Un pago de prueba nunca debe confirmar un pedido creado en modo real ni al revés.
- Reenvío de la misma notificación, cambio de estado y notificación fuera de orden. La biblioteca se concede una sola vez y conserva la versión adquirida, aunque el producto se edite mientras el comprador paga.
- Un creador no puede acceder a la cuenta ni a los pedidos de otro. Las credenciales cifradas no aparecen en las consultas del cliente.
- Desvincular impide crear ventas nuevas y conserva autorización cifrada sólo para comprobar pedidos ya creados. Si el creador revoca el permiso directamente en Mercado Pago, una notificación anterior puede requerir que vuelva a autorizar para verificarse.

Las pruebas de código verifican estos controles con un proveedor simulado. No acreditan la aprobación comercial de Mercado Pago, una liquidación real ni el tratamiento fiscal de las ventas. No activar cobros reales hasta cerrar esta lista con las cuentas de prueba del proveedor.

## Operación

- Las compras aparecen en **Mi biblioteca → Mis compras** con el estado confirmado por el servidor.
- Volver del checkout no cambia por sí solo un pedido a pagado.
- La entrega digital sólo ocurre tras la confirmación consultada al proveedor y validada contra el pedido guardado. No se ejecuta código subido por creadores.
- Los tokens de creadores se renuevan desde el servidor. Si una autorización fue revocada en el proveedor, pedir al creador que la conecte nuevamente desde su espacio.
- Para pausar ventas nuevas, desactivar cobros desde el panel. Los pedidos existentes conservan sus datos y las notificaciones siguen comprobándose.
- Mantener las variables del proveedor sólo en el backend y evitar registrar cuerpos de OAuth, notificaciones completas o cabeceras de autorización.

Documentación oficial para la habilitación y condiciones vigentes: [Mercado Pago Developers Argentina](https://www.mercadopago.com.ar/developers/es/docs).

Validación del 21 de octubre de 2026: [circuito simulado al 10 %, comprobación del webhook publicado y requisitos pendientes de la prueba externa](mercado-pago-validation-2026-10-21.md). Los cobros siguen desactivados; no se acredita una liquidación de Mercado Pago con pruebas simuladas.
