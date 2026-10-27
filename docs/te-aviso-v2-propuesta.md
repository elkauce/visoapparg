# Te Aviso · propuesta de web y funcionamiento

Propuesta aprobada por el propietario. Conserva el alcance de diseño acordado;
el estado real de implementación y sus límites se documentan en
[la entrega Te Aviso 2](te-aviso-v2.md). Las imágenes iniciales contienen datos de
ejemplo. El nombre visible nuevo es **Te Aviso**.

## 1. Identidad y relación con VISO

- Símbolo original de cuatro colores VISO, acompañado de «Te Aviso» y firma discreta
  «por VISO». Fondo `#F5F3EF`, blanco, grafito `#17191D` y naranja `#E84300`.
- Inicio con resplandor y latido de los colores VISO; desactivar animaciones si el
  dispositivo tiene movimiento reducido. La demostración visual no cambia estados reales.
- Web adaptable a escritorio y celular. Panel móvil con navegación inferior; panel
  de escritorio con una sola barra lateral. El visitante tiene navegación breve propia.
- Conservar el proyecto `apps/teaviso`, backend `vivid-nightingale-785`, cuentas,
  autenticación Google/contraseña, licencias y timbres existentes. El cambio de marca
  no requiere renombrar tablas, crear otra base ni duplicar usuarios.
- Conservar los enlaces de QR ya emitidos, permisos, historial y retorno de pagos.
  Un futuro dominio propio necesita conservar también los orígenes anteriores.
- La web VISO, Deck, Display, Marketplace y Google Home conservan sus recorridos.

## 2. Oferta de cuatro opciones

| Opción | Alcance | Condición comercial |
| --- | --- | --- |
| Negocios y reservas | Timbre Digital, horarios, servicios, profesionales, agenda, reservas y avisos de llegada | Pago; importe y periodicidad pendientes. Mensual/anual es una recomendación, no una tarifa aprobada. |
| WhatsApp | QR al número propio y mensaje general; diseños descargables y administración del QR | Básico gratuito. Mensajes preguardados por motivo/empresa y número dedicado son mejoras de pago, independientes o combinables. |
| Con hardware VISO | Beneficio Timbre expresamente incluido con equipos participantes | Incluido en una compra elegible; modelos, funciones, cupos y duración todavía por definir. No equivale a todas las funciones gratuitas sin límite. |
| Edificios con asistencia | Unidades, responsables, residentes, destinatarios, horarios y acompañamiento | Mensual; tarifa y alcance de asistencia pendientes. Precio por edificio/unidades es una recomendación. |

El número dedicado es un servicio operativo: preparación, asignación y coordinación
manual. Hay que definir titularidad de la línea, costos posteriores y mantenimiento.
No es una central compartida, un número personal oculto mediante WhatsApp, ni un
aprovisionamiento automático de cuentas.

La selección de tipo de lugar es independiente del plan: casa, departamento,
negocio, consultorio, oficina o edificio. El portal puede ofrecerse a cualquier
usuario con la mejora correspondiente; no es exclusivo de edificios.

No mostrar importes inventados ni un botón de pago operativo mientras falten
configuración comercial, condiciones y habilitación del proveedor. Una selección
de plan del navegador no concede prestaciones pagas.

## 3. Páginas y navegación

| Página | Objetivo y recorrido |
| --- | --- |
| Inicio | Presentación, cuatro soluciones, cómo funciona, ejemplos de QR, equipos y preguntas frecuentes; crear espacio o ingresar. |
| Soluciones | Detalle de negocios/reservas, WhatsApp, hardware y edificios; beneficios, alcance y acceso a configuración. |
| Planes | Comparación de prestaciones; básico gratis; mejoras y condiciones de cada opción paga; precio desde servidor cuando exista. |
| Equipos | Lista de compatibilidad validada, beneficio incluido e instalación. Diferenciar un equipo validado de uno en evaluación. |
| Ingreso/registro | Cuenta VISO existente, Google y contraseña; retorno al destino que originó el ingreso. |
| Alta guiada | Tipo y nombre del lugar, zona horaria, modalidad, horario/contacto, configuración necesaria, prueba y QR. |
| Mi panel | Espacio seleccionado, avisos, próximos turnos, QR y estado/configuración de entrada. Datos reales o estado vacío. |
| Mis entradas | Crear, editar, activar/pausar, elegir diseño, descargar PNG/SVG y compartir enlace estable. |
| Agenda | Día/semana, reservas, servicios, duración, profesionales, disponibilidad, bloqueos y cancelaciones. |
| Portal de visitas | Habilitar motivos, ordenar opciones, nombre/logo, mensajes, destino y destinatarios permitidos. |
| Dispositivos | Alta autorizada, modelos compatibles, conexión, prueba, luz y acceso según permisos y compatibilidad. |
| Mi plan | Contratación, prestaciones, vencimiento, renovaciones, cancelación y compras que incluyen beneficio. |
| Configuración | Cuenta, lugares, integrantes, roles, notificaciones y privacidad. |
| Administración | Oferta, precios, términos, prestaciones, hardware elegible, servicios dedicados y solicitudes de asistencia. |
| Visitante | Entrada pública desde QR/enlace; acciones habilitadas para ese lugar: avisar, llamar, reservar y horarios. |

Las páginas de visitante no exigen instalar la app ni iniciar sesión como propietario.
Para la atención del propietario se mantiene la limitación actual: la web debe estar
abierta; la recepción Android usa la APK compatible y sus permisos. Una APK propia
Te Aviso y la recepción nativa iOS son trabajos separados pendientes.

## 4. Portal y mensajes

1. El propietario activa su portal para la entrada, elige motivos y establece
   cuáles requieren mensaje o permiten llamada. Hay opciones de visita particular,
   Mercado Libre, correo, delivery y otras configurables.
2. Logos e imágenes son administrables. La selección identifica la declaración del
   visitante, no una asociación oficial ni la identidad verificada de un repartidor.
3. El visitante selecciona motivo y, si corresponde, unidad. Revisa el mensaje y
   confirma la acción. Abrir el QR o seleccionar una tarjeta no genera avisos por sí solo.
4. En WhatsApp, continuar abre el mensaje preparado para que el visitante lo envíe.
   La web no promete enviarlo automáticamente ni oculta el número visible en WhatsApp.
5. En Digital, confirmar envía un aviso de visita a destinatarios autorizados o inicia
   una llamada según la acción elegida y la licencia. Conservar audio/video/chat existentes.
6. El aviso incluye lugar, unidad si aplica, motivo y texto seguro. Ejemplo: «Un
   visitante indicó una entrega de Mercado Libre en la entrada principal».
7. El propietario puede atender o utilizar respuestas predefinidas si esa función
   está habilitada. Los avisos quedan en el historial con acceso por lugar/unidad.

El mensaje general gratuito de WhatsApp existente se conserva. La mejora paga
habilita varias plantillas por motivo/empresa; no se convierte retroactivamente el
mensaje básico existente en una prestación paga.

El backend debe resolver texto y destinatarios desde configuración autorizada. El
cliente público no decide usuarios receptores, estado de pago, permisos o número de
servicio. Conservar límites por QR/visitante, protección contra abuso, horarios y pausa.
Los avisos sin llamada necesitan un evento de notificación propio; no fabricar llamadas
ni reutilizar una notificación de llamada como si existiera una sesión de audio/video.

## 5. Reservas y agenda

### Configuración del negocio

Servicios con nombre, duración y profesionales habilitados; horarios semanales en
zona IANA, descansos, excepciones y bloqueos por fecha. Establecer anticipación,
horizonte de reserva y política de cancelación. Los precios de servicios al cliente,
si se muestran, son distintos del abono que cobra Te Aviso al negocio.

### Recorrido del visitante

Servicio → profesional disponible o cualquiera → día/hora → nombre y contacto privado
→ aceptación de condiciones → confirmación de disponibilidad → comprobante.

Consultar disponibilidad no expone nombres ni contactos de otras reservas. El enlace
de gestión de una reserva necesita una capacidad privada y limitada; el QR público
del local nunca permite consultar o cancelar turnos ajenos. No prometer correos/SMS
automáticos o verificación telefónica hasta tener ese proveedor y su circuito configurados.

### Operación y concurrencia

- Guardar inicio/fin en UTC y la zona horaria aplicable. Respetar cambios de horario
  y días no disponibles; no reservar fuera de los horarios del profesional.
- El servidor calcula la duración y vuelve a consultar ocupación dentro de la
  transacción final. Dos visitantes no pueden confirmar el mismo recurso/franja.
- Contemplar servicios de diferente duración y solapamientos, no solo horas iguales.
- Reintentar una confirmación con la misma clave no crea dos reservas.
- Modelar solicitud pendiente, confirmada, cancelada, realizada y no asistió.
  Definir por negocio si confirma automáticamente o requiere aprobación.
- Una solicitud que bloquea cupo tiene vencimiento explícito; al vencer/cancelarse
  libera capacidad. Reprogramar debe comprobar y reservar el nuevo horario de forma
  atómica antes de liberar el anterior.
- Los avisos se generan después de guardar la operación y admiten reintento sin duplicados.
- Disponibilidad, licencia y permisos se verifican en el servidor. Vencer un plan
  no debe causar pérdida silenciosa de reservas ya existentes; se define una política
  de consulta/gestión y se bloquean nuevas prestaciones no contratadas.

## 6. Edificios y roles

El responsable registra el edificio y configura las unidades. Los residentes se unen
por invitación autenticada; ingresar una dirección no concede administración de un
edificio existente. El QR común permite elegir unidad; un QR de unidad puede llevarla
preseleccionada. El directorio público muestra solo los identificadores necesarios.

Los roles existentes propietario, responsable y residente conservan sus alcances.
Un residente recibe y consulta avisos de sus unidades autorizadas. La gestión de bajas,
cambios y destinatarios debe preservar el QR estable cuando sea posible. La asistencia
es una prestación comercial con canal, horario y alcance por definir; no anunciar
atención permanente sin operación preparada.

## 7. Compras, mejoras y hardware incluido

Precios, límites, duración y prestaciones provienen del servidor. Cada compra conserva
una copia de sus condiciones. Retornar de Mercado Pago no activa una licencia: se usa
la verificación de pago existente, con renovación, cancelación y reintegro coherentes.

Los mensajes preguardados y el número dedicado son mejoras independientes. Asignar
un número requiere pago confirmado, servicio preparado y prueba de configuración.
Vencer o pausar un número dedicado no redirige visitas al teléfono personal sin una
elección explícita del propietario.

El beneficio de hardware utiliza la elegibilidad y las compras verificadas de VISO,
o una asignación administrativa con evidencia; no basta marcar «tengo hardware».
Una compra afiliada o un producto cualquiera no concede automáticamente el beneficio.

## 8. Luz y apertura

La luz actual Akira no se selecciona como kit de referencia. **Tapo L535E con Matter**
es candidata a evaluar, no compatibilidad acreditada. Confirmar versión regional,
vinculación y recuperación ante cortes antes de ofrecer un modelo oficial.

El controlador y la cerradura no están elegidos. La selección depende del tipo de
puerta y se valida con instalación, sensor y operación física. El beneficio Timbre
del hardware no activa automáticamente una cerradura ni un permiso de apertura.

La apertura se reserva a usuarios autenticados y autorizados para el dispositivo,
con acción explícita, comando acotado, caducidad y registro. Un QR público, motivo de
visita, reserva o cambio de estado nunca abre la puerta. Separar «comando aceptado»,
«apertura ejecutada» y estado real del sensor; no mostrar «puerta abierta» sin evidencia.
Conservar salida manual independiente de la app/Internet.

Durante el diseño, cualquier control físico no validado se identifica como pendiente.
No publicar un botón operativo de apertura conectado a un relé de prueba.

## 9. Mapa de implementación

| Base existente | Ampliación necesaria |
| --- | --- |
| Registro/Google y cuentas compartidas | Marca Te Aviso en todas las superficies, alta guiada y retorno por opción. |
| QR propios, diseños, pausa y número editable | Navegación nueva, páginas de producto/planes y configuración unificada. |
| Llamadas, unidades, roles, horarios, historial y push de llamada | Portal por motivos, mensajes por empresa, avisos sin llamada y sus permisos. |
| Mercado Pago, licencias, suscripciones y hardware elegible | Configuración comercial de las cuatro opciones y mejoras; pruebas de contratación reales. |
| Solicitudes Business y asignación manual | Presentación como mejora de número dedicado y condiciones completas de operación. |
| Estados y Google Home | Kit RGB validado, asociación de dispositivo y compatibilidad publicada. |
| Sin agenda de reservas actual | Servicios, profesionales, disponibilidad, reservas, estados y gestión privada. |
| Sin apertura física actual | Selección/validación del equipo y protocolo autorizado con confirmación y sensor. |

La implementación debe añadir tablas y campos compatibles; no reemplazar el backend
con una copia vieja del otro chat. Las dos webs comparten servidor: revisar siempre
VISO y Te Aviso antes de publicar. La aprobación visual no autoriza cobros, compra de
hardware, apertura real ni publicación en producción.

## 10. Entrega y validación por etapas

1. Aprobar imágenes y navegación. Las tarifas y funciones físicas pendientes siguen
   sin inventarse en la presentación comercial.
2. Implementar marca, páginas, alta y planes sobre la cuenta compartida.
3. Implementar reservas y portal con pruebas de permisos, solapamientos, reintentos,
   pausa, vencimiento de prestaciones y notificaciones.
4. Verificar web móvil/escritorio, visitante Android/iPhone y recepción de propietarios
   con las plataformas realmente admitidas. Publicar sus límites de compatibilidad.
5. Validar compra, activación, renovación, cancelación y devolución sin afectar VISO.
6. Integrar equipos solo después de pruebas físicas; no bloquear el portal básico
   por la selección pendiente de una cerradura.
7. Generar revisión concreta y solicitar autorización de publicación. Mantener las
   cuentas y QR existentes; actualizar documentación y descargas en la versión aprobada.
