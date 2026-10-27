# Te Aviso · configuración guiada de timbres

Estado: corrección implementada y probada para revisión. **Sin publicar**.
El propietario indicó que el producto funciona pero configurar un timbre resulta
confuso. El recorrido anterior mostraba al mismo tiempo licencia, QR interno,
contacto, horarios, reservas y mensajes; permitía terminar con una entrada sin
contacto preparado y dividía los timbres existentes en listas distintas.

## Recorrido propuesto

[Ver capturas reales del recorrido](design/te-aviso-configuracion-guiada.png).
[Ver configuración simple](design/te-aviso-configuracion-simple-editor.png).

1. Elegir WhatsApp o llamadas Te Aviso. La opción WhatsApp básica sigue disponible
   sin plan pago; las llamadas requieren un plan válido con capacidad disponible.
2. Completar nombre, tipo de lugar y contacto. Se muestra el plan por su nombre si
   corresponde. Para combinar llamadas y WhatsApp se marca una opción adicional.
3. El servidor prepara el timbre y su QR. Se puede probar, descargar y configurar.
   Reservas y mensajes personalizados se agregan después, según el plan.

La operación crea/vincula espacio, inmueble Digital, integrante propietario y QR en
una sola transacción. Si falla la licencia o el cupo, no deja registros parciales.
Una clave por intento evita duplicados ante reintentos. En edificios se prepara una
unidad Recepción, que después puede ampliarse con unidades y residentes.

## Editar y reutilizar

Mis timbres muestra una única lista de entradas, WhatsApp anteriores y timbres
Digital. Configurar un timbre anterior lo incorpora al recorrido sin cambiar el
QR impreso ni duplicar el inmueble. Se conservan miembros, permisos y horarios de
los timbres Digital existentes; también se preserva su pausa.

La configuración principal muestra nombre, estado, WhatsApp y QR. Activar llamadas
resuelve automáticamente la conexión; no se eligen identificadores de otro QR.
Las ediciones básicas conservan horarios, mensajes, reservas y preferencias.
Un cambio de número exige consentimiento; un editor desactualizado no sobrescribe
cambios de otra ventana. Activar llamadas no puede retirar reservas/mensajes pagos
que ya estén activos en el espacio.

Ajustes avanzados conserva todas las opciones anteriores, separadas en Datos,
Plan y llamadas, Horarios, Reservas y Mensajes. Se muestra un grupo por vez,
conservando montados los campos para no borrar preferencias al guardar. El QR y
sus diseños se gestionan desde la configuración simple, evitando superponerlos al
formulario de ajustes en celular.

El enlace para pedir un cartel transporta el timbre elegido a la personalización;
no cambia silenciosamente al primer timbre de la cuenta. Los clientes invitados
pueden ver timbres compartidos sin adquirir permisos de propietario.

## Verificación y entrega pendiente

1.001 pruebas correctas en 110 archivos. TypeScript de raíz y backend, compilación
Te Aviso y ESLint de archivos cambiados correctos, sin advertencias de lint.
29 comprobaciones de navegador en 390 y 1440 px con componentes React y funciones
Convex reales sobre un puente local `convex-test` e identidades ficticias. Incluye
creación WhatsApp, descarga PNG, edición, activar llamadas sin selección manual de
QR, guardar mensajes en su sección, creación Digital y bloqueo de planes no válidos.
Se comprobó también que el cartel usa el mismo timbre recién configurado.

No se llamó ni envió WhatsApp a ninguna persona, no se realizaron cobros y no se
publicaron funciones, web ni APK. No se cambiaron credenciales ni facturación.
Para publicar la corrección se requiere la autorización del propietario, actualizar
el backend compatible `vivid-nightingale-785` y únicamente el frontend Vercel
`teaviso`. No necesita migración de registros ni reconstruir la APK VISO.

[Informe de revisión](validation/te-aviso-configuracion-guiada.json).
