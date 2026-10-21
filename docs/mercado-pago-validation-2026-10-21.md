# Comprobación de Mercado Pago — 21 de octubre de 2026

La configuración de VISO y la lógica de compra se comprobaron. **El reparto efectivo de Mercado Pago sigue pendiente de una prueba con el proveedor.** No se activaron cobros, no se crearon pedidos en el servidor compartido y no se modificaron credenciales de producción durante esta validación.

## Circuito comprobado

La prueba integrada usa exclusivamente cuentas técnicas locales, claves falsas y respuestas simuladas de Mercado Pago. Recorre una compra de ARS 100 con comisión VISO del 10 %: la preferencia solicita `marketplace_fee: 10` y el pedido conserva ARS 90 para el vendedor antes de los costos del procesador.

Una notificación sin firma recibe HTTP 401. Una notificación firmada consulta el pago al proveedor simulado y concede el recurso sólo después de comprobarlo. Repetirla conserva un único recurso en la biblioteca. Cambiar el producto o la comisión durante la compra no altera el contenido, precio ni comisión guardados en ese pedido. El comprador puede consultar la compra aprobada.

También se verificaron los controles existentes de moneda, importe, cobrador, referencia, modo, estados fuera de orden, aislamiento de credenciales y rechazo de checkout con cobros desactivados. Los resultados y sus límites están en `mercado-pago-validation-2026-10-21.json`.

En el servidor compartido, una solicitud de diagnóstico con firma inválida recibió HTTP 401. Esa solicitud no consultó un pago al proveedor ni creó un pedido o una entrega. Las consultas de configuración confirmaron comisión del 10 %, cobros desactivados, modo predeterminado `test` y ausencia de pedidos.

## Prueba externa pendiente

Una consulta sin credenciales a `https://api.mercadopago.com/users/me` recibió HTTP 403. El entorno actual no incluye los dominios de Mercado Pago en su lista permitida. El borrador de configuración conserva los dominios existentes y agrega `sandbox.mercadopago.com.ar`; la herramienta confirmó `status: saved` y `requires_publish: true`. Guardar ese borrador no aplica el permiso al entorno actual.

Para continuar, aplicar la configuración de red del entorno de Codex y preparar las cuentas de prueba que admita la aplicación de Mercado Pago. Las credenciales cargadas por el propietario son de producción. `MP_MODE=test` selecciona el checkout de prueba y valida el modo del pago, pero no transforma una credencial de producción en una de prueba. No se sustituyeron esas credenciales ni se solicitaron secretos por chat.

La prueba del proveedor debe usar un vendedor de prueba distinto del comprador y un producto digital de un creador que no sea administrador. Los productos propios de VISO no llevan `marketplace_fee`, por lo que su compra no comprueba el split. Antes de afirmar que el reparto funciona, contrastar la comisión recibida por VISO, el importe del vendedor, los costos del procesador, el webhook firmado y la entrega única.

La autorización OAuth exitosa y la coincidencia del ID configurado con la cuenta vinculada no sustituyen esa comprobación. También queda pendiente contrastar el dueño del Access Token configurado mediante la API del proveedor. No se publicó una nueva web, backend ni APK en esta validación.
