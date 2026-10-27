# Te Aviso · planes con funciones existentes

La versión operativa derivada de esta propuesta ya se publicó con autorización.
Ver [la entrega y sus condiciones activas](te-aviso-home-planes-publicados.md).
El resto del documento conserva el registro de la revisión previa.

27 de octubre de 2026. **Actualización del prototipo, sin publicar.**

El propietario aprobó la propuesta visual del home y pidió incorporar a Planes
lo que ya tenemos, con una definición clara. Se amplió la maqueta de diseño con
`planes.html` y se agregó un enlace desde la sección de planes del home. El código
de aplicación, la configuración comercial del servidor y las cuentas no cambian.

## Organización propuesta

- **WhatsApp propio:** QR básico sin cargo, número propio visible al abrir el chat,
  mensaje general, edición del contacto y diseño, descarga PNG/SVG. El visitante
  confirma el envío en WhatsApp. El número dedicado se cotiza aparte.
- **Portal de visitas:** mejora paga con motivos y mensajes preparados, textos
  configurables y entrada por el mismo QR. Requiere la prestación `templates` en
  una licencia válida. No supone que cada QR gratuito ya la tenga habilitada.
- **Digital / Hogares:** paquetes Avisos, Videollamada y Familia, con precios,
  integrantes y placas expresamente propuestos. Se explican chat, mensajes,
  registro de comunicaciones, horarios, silencio, ausencia, contactos alternativos,
  invitaciones, permisos, atención Android/web y descargas. Una tabla desplegable
  compara doce características, sin esconder los adicionales dentro de un paquete.
- **Negocios:** propuesta según actividad con agenda, servicios, profesionales,
  horarios, bloqueos, gestión de reservas y portal. La cotización debe definir
  modalidad de atención, prestaciones, cupos, importe y período. Las llamadas
  requieren audio/video en la licencia, no se conceden solo por tener agenda.
- **Edificios:** abono mensual a cotizar por edificio, directorio de unidades,
  residentes autorizados, roles, invitaciones, QR general/por unidad y asistencia
  de alcance acordado. No se definen cupos ilimitados ni asistencia 24 h.
- **Complementos:** beneficio de hardware VISO elegible, carteles físicos y número
  dedicado con preparación manual. No se presenta hardware como una licencia
  universal ni se promete una central de llamadas WhatsApp.
- **Servicio actual:** propuesta de resumen por timbre con plan, prestaciones,
  límites, vigencia y compras adicionales. Corresponde al diseño futuro del panel;
  esta entrega no sustituye la pantalla de licencias publicada.

## Funciones contrastadas con código existente

| Función | Fuente | Condición relevante |
| --- | --- | --- |
| QR WhatsApp y contacto editable | `convex/teaviso.ts`, `apps/teaviso/src/qr.tsx` | El número se revela al abrir WhatsApp; no es una llamada anónima. |
| Mensajes por motivo de visita | `convex/teaviso_spaces.ts` | Requiere `templates`, portal activo y licencia válida. |
| Horarios, silencio y ausencia | `convex/timbre.ts` / `saveSiteSettings` | Se aplican a la entrada Digital y a sus prestaciones. |
| Contactos principales y alternativos | `convex/timbre.ts`, `convex/timbre_calls.ts` | Contactos integrantes habilitados y licencia vigente. |
| Audio/video | `convex/timbre_calls.ts` | Licencia, permisos y TURN configurado. |
| Chat y mensajes dejados | `convex/timbre_calls.ts` | Chat de comunicación aceptada; mensajes según capacidad de la licencia. |
| Historial | `convex/timbre_calls.ts` / `history`, `messages` | Panel: hasta 100 comunicaciones de últimos 90 días; mensajes hasta 30 días. No es grabación de audio/video. |
| Invitaciones, integrantes, permisos | `convex/timbre.ts` | Cupo y `families` en hogares; unidades autorizadas en edificios. |
| Avisos Android | `convex/timbre_push.ts`, APK compatible | Permisos, inscripción del dispositivo y restricciones del sistema. No se promete una app iOS propietaria. |
| Agenda y reservas | `convex/teaviso_spaces.ts` | `bookings`, servicios/profesionales y disponibilidad configurados. |
| Unidades y residentes | `convex/timbre.ts` | `buildings`, cupos y roles de la licencia. |
| Hardware incluido | `convex/timbre_commerce.ts` | Producto y plan elegibles expresamente, prestaciones y vigencia de esa compra. |
| Señalización VISO | `convex/timbre_presence.ts`, `convex/timbre.ts` | Propietario, configuración de estados y dispositivos compatibles. No control universal de luces/cerraduras. |
| Número dedicado | `convex/teaviso.ts`, `apps/teaviso/src/business.tsx` | Oferta, contratación y preparación/asignación manual, no provisión automática. |
| Carteles personalizados | `convex/teaviso_signs.ts`, `apps/teaviso/src/sign-pages.tsx` | Solicitudes de presupuesto; sin stock, fabricación o envío garantizados. |

## Propuestas todavía pendientes

Los importes ARS 36.000, 48.000 y 80.000 y los cupos 3/3/6 integrantes y 1/1/2
placas no configuran tarifas ni licencias. La vigencia y la sostenibilidad del pago
deben definirse; no se promete una licencia perpetua. Negocios, Edificios y número
dedicado quedan a cotizar, con condiciones antes de contratar.

**Avisos es un nuevo paquete comercial propuesto, no un plan ya listo para cobrar.**
El chat existe, pero el asistente `teaviso_setup.options` filtra actualmente las
licencias de Digital por audio o video. Para lanzar Avisos sin audio/video habrá
que adaptar y probar ese recorrido de alta/activación. Además, cualquier paquete
de hogar con varios integrantes debe tener `families` y cupos compatibles. La
licencia de cada combinación debe configurarse y probarse antes de comercializar.

La geolocalización de Hogares sigue marcada **En preparación**. No se ejecuta ni
se cobra como prestación activa por esta entrega. Cerraduras, control físico y
otras integraciones futuras no aparecen como beneficios activos de los planes.

Las llamadas del propietario en web requieren el panel abierto. Android requiere
la APK compatible y permisos/registro de avisos. No se promete recibir llamadas
en una pestaña cerrada ni contar con una nueva APK propia de Te Aviso.

## Revisión visual

- [Catálogo completo en computadora](design/te-aviso-home-modelos/planes-1440-completo.png).
- [Catálogo completo en celular](design/te-aviso-home-modelos/planes-390-completo.png).
- [WhatsApp](design/te-aviso-home-modelos/planes-1440-whatsapp.png).
- [Digital](design/te-aviso-home-modelos/planes-1440-digital.png).
- [Funciones adicionales](design/te-aviso-home-modelos/planes-1440-funciones.png).
- [Comparación desplegada](design/te-aviso-home-modelos/planes-1440-comparacion.png).
- [Negocios](design/te-aviso-home-modelos/planes-1440-negocios.png).
- [Edificios](design/te-aviso-home-modelos/planes-1440-edificios.png).
- [Complementos](design/te-aviso-home-modelos/planes-1440-complementos.png).

Se comprobaron 320, 390, 768 y 1440 px, enlaces desde el home, desplazamiento
contenido de la tabla, detalles, navegación móvil, diálogo de propuesta, carga de
imágenes, ausencia de desbordamiento horizontal y de errores JavaScript. El
prototipo solo consulta recursos locales: sin Convex, pagos, llamadas, ubicación
ni modificación de datos de usuarios.

[Informe del prototipo](validation/te-aviso-planes-funciones.json).
