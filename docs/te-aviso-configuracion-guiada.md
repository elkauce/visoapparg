# Te Aviso · configuración guiada de timbres

Estado: **publicado** el 27 de octubre de 2026, con autorización expresa del
propietario («si») después de revisar las capturas.

Web: https://teaviso-manuelhaguilar8-4981s-projects.vercel.app/ .
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

## Verificación y publicación

1.001 pruebas correctas en 110 archivos. TypeScript de raíz y backend, compilación
Te Aviso y ESLint de archivos cambiados correctos, sin advertencias de lint.
29 comprobaciones de navegador en 390 y 1440 px con componentes React y funciones
Convex reales sobre un puente local `convex-test` e identidades ficticias. Incluye
creación WhatsApp, descarga PNG, edición, activar llamadas sin selección manual de
QR, guardar mensajes en su sección, creación Digital y bloqueo de planes no válidos.
Se comprobó también que el cartel usa el mismo timbre recién configurado.

No se llamó ni envió WhatsApp a ninguna persona ni se realizaron cobros. Se
publicaron el backend compatible `vivid-nightingale-785` y únicamente el frontend
Vercel `teaviso`: despliegue READY `dpl_3kjZVU1Wdj9z5svbWXK1ZQNmFAoC`,
fuente `28d4520`. No se migraron registros, cambiaron credenciales ni facturación.
VISO conserva su frontend `dpl_9DVS5zTpqMAb1MV918Xh7zue8zZx`; no se reconstruyó
la APK.

La entrega pública se verificó mediante HTTPS con TLS válido: 26 archivos
comparados por SHA-256 y 23 rutas correctas. Los dos nuevos endpoints privados
rechazan solicitudes sin sesión. Google continúa configurado. El recorrido
interactivo se verificó localmente con identidades sintéticas; no se crearon
usuarios de prueba ni timbres en producción para verificar la entrega.

Convex mantiene el aviso de que los proyectos superan los límites del plan
gratuito. La actualización y las consultas finalizaron correctamente; no se
modificó la facturación.

[Informe de revisión](validation/te-aviso-configuracion-guiada.json).
