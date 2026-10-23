# Timbre: contratación, licencias y suscripciones

## Estado de esta implementación

El código integra Timbre en la cuenta, el marketplace y el proveedor Mercado Pago existentes. No se hicieron cargos, cambios de credenciales ni publicaciones en producción. Las llamadas al proveedor en las pruebas son simuladas.

Los planes no traen precios, materiales, existencias, transportistas o plazos inventados. Un administrador debe configurar los datos comerciales reales. Tener una cuenta VISO o adquirir un recurso gratuito de la biblioteca no concede una licencia Timbre.

El adaptador de suscripciones está implementado y **desactivado por defecto**. Su contrato se comprobó contra el SDK oficial de Mercado Pago; falta validar la integración con una aplicación de Mercado Pago y su configuración real de notificaciones. La propiedad `configuration.externallyValidated` se devuelve como `false` para dejar constancia de esta comprobación externa pendiente.

## Configuración necesaria

Se reutilizan las variables del proveedor existente, sin exponerlas al navegador:

| Variable o ajuste | Uso |
| --- | --- |
| `MP_ACCESS_TOKEN` | Solicitudes del servidor a la cuenta receptora de VISO. |
| `MP_APPLICATION_ID` | Identificación de la aplicación, validada contra cada preapproval. |
| `MP_COLLECTOR_ID` | Cuenta receptora, validada también contra los pagos. |
| `MP_CLIENT_SECRET` | Configuración existente de Mercado Pago. |
| `MP_TOKEN_ENCRYPTION_KEY` | Cifrado existente de credenciales de vendedores. |
| `MP_WEBHOOK_SECRET` | Verificación HMAC de las notificaciones. Debe corresponder a la configuración real del webhook. |
| `MP_MODE=live` | Timbre sólo concede derechos por pagos reales verificados. Los pagos de prueba nunca activan el servicio. |
| `SITE_URL` | Origen HTTPS público. El retorno del checkout es exactamente `/timbre`. |
| `CONVEX_SITE_URL` | Origen HTTP del backend, usado por los pagos únicos y sus notificaciones. |
| `TIMBRE_RECURRING_ENABLED=true` | Habilitación explícita del checkout recurrente. Ausente o cualquier otro valor lo mantiene apagado. |
| Ajustes de cobro del marketplace | Deben seguir habilitados y tener las políticas y la habilitación del split confirmadas. El nuevo código no cambia estos ajustes. |

Configurar en la aplicación de Mercado Pago la URL HTTPS del backend:

```text
https://<backend>.convex.site/timbre/payments/webhook
```

Seleccionar los eventos `subscription_preapproval`, `subscription_authorized_payment` y `payment`. El endpoint acepta únicamente estos tipos y verifica su firma. El cuerpo de creación de preapproval no inventa un campo `notification_url`: la recepción recurrente depende de esta configuración en Mercado Pago. El webhook existente de pagos únicos se mantiene separado y conserva su comportamiento.

No habilitar la bandera como sustituto de revisar la cuenta receptora, la firma, las notificaciones, los ciclos, los reintegros y la cancelación en el entorno comercial correspondiente. Las credenciales se cargan en el servidor; no se incluyen en archivos públicos, la APK, capturas o documentación.

## Recorrido y evidencia de pago

1. El usuario autenticado elige un plan mensual o anual. El servidor toma de la configuración su importe en centavos, moneda ARS, vendedor, beneficios y límites; el cliente no decide el precio ni el titular.
2. El servidor reserva una suscripción con una copia de esos términos y crea `POST /preapproval/`, en estado `pending`, sin tarjeta recibida por VISO y sin período gratuito. Usa frecuencia de uno o doce meses y el correo de la cuenta VISO.
3. El resultado se consulta de nuevo mediante `GET /preapproval/{id}`. Deben coincidir la aplicación, el receptor, la referencia interna, el correo y el ciclo/precio. Sólo entonces se entrega el enlace HTTPS oficial de autorización correspondiente a ese preapproval.
4. La autorización, el retorno a `/timbre`, una pantalla de éxito o una consulta de estado **no activan una licencia**.
5. La notificación firmada inicia una consulta canónica de la suscripción, de `GET /authorized_payments/{id}` y de `GET /v1/payments/{id}`. Deben coincidir suscripción, factura, referencia, receptor, titular, importe, moneda y un pago `live_mode=true` aprobado.
6. Se guarda un período pagado por factura/pago. Los índices e invariantes impiden usar el mismo pago en otra factura o compra. Sólo esta evidencia concede o renueva la licencia del servicio, separada de la biblioteca de descargas.

Un POST con resultado desconocido queda marcado para conciliación y no se repite automáticamente: el proveedor podría haber creado la suscripción aunque se haya perdido su respuesta. Esta situación necesita localizar la contratación en Mercado Pago y conciliarla antes de iniciar otra, para evitar cargos duplicados. El checkout pendiente cuya respuesta sí se guardó se reutiliza.

## Períodos, reintegros y cancelación

- Los términos adquiridos permanecen en `planSnapshot`; editar un plan no cambia una suscripción ya contratada.
- Se utiliza `debit_date` de la factura y el ciclo mensual/anual verificado. Para establecer el primer período se requiere la próxima fecha de cobro canónica del proveedor. Se conserva el día de anclaje para los días 29, 30 y 31; cuando la próxima fecha corresponde al mismo ciclo se utiliza esa fecha real. Una fecha de un ciclo posterior nunca extiende una factura antigua a través de meses no pagados. Si faltan datos o difieren del ciclo, se detiene la activación para revisión.
- No se utiliza una duración ficticia de treinta días para un mes o de 365 días para una anualidad. El cálculo de calendario conserva hora UTC y ajusta el día al último día del mes cuando corresponde.
- La cobertura sólo une períodos pagados contiguos o superpuestos. Un mes impago sigue sin acceso aunque exista un período futuro ya pagado. Un trabajo programado recalcula los inicios y vencimientos de esa cobertura sin necesitar otro webhook; el trabajo no crea evidencia de pago.
- La política implementada revoca la cobertura de una factura ante un reintegro confirmado, incluso parcial cuando Mercado Pago conserve `status=approved`. Comisiones y valores netos de liquidación no se tratan como reintegros. Un contracargo también revoca la cobertura. Otra cobertura pagada válida puede mantenerse.
- Las notificaciones atrasadas no revierten reintegros o contracargos. Una revocación administrativa marcada `revokedByAdmin` tampoco se revierte mediante una renovación.
- **Revocar una licencia no cancela automáticamente los futuros cobros del proveedor.** Para terminar la facturación se debe cancelar también la suscripción mediante la acción de cancelación y confirmar el resultado. Esta separación evita declarar una cancelación que no ocurrió.
- La cancelación solicita `PUT /preapproval/{id}` y vuelve a consultar al proveedor. Se conserva el período ya pagado hasta su vencimiento. Una falla no se presenta como cancelación confirmada.

La firma incorpora el identificador del recurso, el identificador de solicitud y la marca de tiempo. Se normalizan los identificadores alfanuméricos, se limita la antigüedad de la firma y se leen como máximo 8 KiB del cuerpo mediante streaming. Las recepciones equivalentes se deduplican con una reserva temporal; las fallidas admiten reintento y las filas de recepción caducan después de diez minutos. Ninguna respuesta HTTP contiene credenciales ni datos financieros completos.

## Pagos únicos, hardware y placas

`timbre_commerce.catalog` devuelve siempre las cuatro ofertas Digital, Personalizado, Hardware y Edificios. Los pagos únicos se cobran mediante el checkout de Mercado Pago existente, con una copia inmutable del beneficio en `timbreOrderBenefits`. El hook se ejecuta dentro de la transacción del pago ya verificado. Un pago sandbox, pendiente o fallido no activa Timbre; un reintegro o contracargo revoca el beneficio sin borrar recursos antiguos descargados del marketplace.

Un producto físico sólo incluye una licencia si un administrador configuró explícitamente su elegibilidad antes de reservar la compra. Las compras genéricas, los afiliados y los recursos gratuitos no califican. El checkout físico antiguo permanece bloqueado; no se ha habilitado por el hecho de agregar Timbre.

Las placas usan un flujo separado: variante real, diseño, precio, dirección y condiciones de entrega quedan registrados al crear el pedido. Una variante puede incluir expresamente la licencia; el usuario podrá crear y vincular su QR después del pago, antes de fabricar. Sin licencia incluida se requiere un QR propio con licencia activa.

La producción exige pago aprobado, QR activo, copia de su token y archivo PDF/SVG/PNG en almacenamiento independiente. Se valida el token esperado al registrar el archivo, se guarda su SHA256 y se bloquea su sustitución al comenzar producción. Una rotación previa del QR exige volver a adjuntarlo y regenerar el archivo. El despacho exige transportista y seguimiento reales. Los diseños completos se guardan aparte para no descargar imágenes pesadas al listar pedidos.

Las licencias pueden reasignarse explícitamente a un sitio mediante `timbre.changeSiteLicense`, verificando propietario, beneficios y cuotas actuales. Esto permite renovar o mejorar un plan sin cambiar el QR y sin modificar los beneficios históricos comprados.

## API y almacenamiento

| Módulo | Entradas principales |
| --- | --- |
| `timbre_commerce` | Catálogo, planes, licencias, descuentos, elegibilidad de hardware, contratos externos documentados, variantes, envíos, pedidos y producción. |
| `timbre_recurring` | `configuration`, `createSubscriptionCheckout`, `mySubscriptions`, `refreshSubscription`, `cancelSubscription`; los registros canónicos y la conciliación de períodos son internos. |
| `timbre_recurring_http` | Webhook firmado aislado. |
| `timbreSubscriptionPeriods` | Facturas, pagos, períodos y reintegros verificados. |
| `timbreRecurringEvents` | Dedupe temporal de recepciones del webhook. |
| `timbreSubscriptions` | Titular, términos adquiridos, referencias del proveedor, anclaje y próxima revisión de cobertura. |

Los contratos pagados por fuera de Mercado Pago sólo los registra un administrador con referencia, importe positivo y fecha real. Son evidencia manual documentada, no una comprobación automática del banco. No hay licencias gratuitas implícitas. Los descuentos de servicio no pueden alcanzar 100% y conservan la asignación de cupones de checkouts pendientes para no exceder el límite por una suposición de caducidad local.

## Referencias oficiales utilizadas

Contrato del SDK oficial de Mercado Pago, consultado mediante su repositorio público; el sitio web de documentación no era accesible desde este entorno. No se realizaron consultas a cuentas de clientes ni solicitudes a la API de pagos real.

- [Preapproval: campos y respuestas](https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/preApproval/commonTypes.ts).
- [Creación de preapproval](https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/preApproval/create/index.ts).
- [Actualización/cancelación de preapproval](https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/preApproval/update/index.ts).
- [Factura de suscripción: campos](https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/invoice/commonTypes.ts).
- [Consulta de authorized payment](https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/invoice/get/index.ts).

Las pruebas cubren la separación entre autorización y pago, sandbox, titular/receptor/aplicación, importes, términos históricos, reutilización de pagos, renovaciones, intervalos sin pagar, anclajes de calendario, reintegros, cancelaciones, cargas inciertas, cuerpos acotados y repeticiones firmadas. Esa verificación local no sustituye la validación externa pendiente con Mercado Pago.
