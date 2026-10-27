# Te Aviso 2 · entrega publicada

Web: https://teaviso-manuelhaguilar8-4981s-projects.vercel.app/ .
Publicación autorizada expresamente por el propietario con «Publica la web».

## Producto e identidad

Te Aviso presenta el timbre digital de instalación mediante QR como producto
principal. Usa el símbolo original VISO, firma «por VISO», fondo `#F5F3EF`, blanco,
grafito y naranja `#E84300`. El inicio tiene latidos y colores VISO, con respeto por
la preferencia de movimiento reducido. El panel tiene barra lateral en escritorio
y navegación inferior en móvil.

La portada, soluciones, planes, equipos, ingreso, alta guiada, entradas, agenda y
portal son páginas propias. Las cuentas, Google, llamadas, QR y licencias existentes
siguen usando el backend compartido `vivid-nightingale-785`. No se migran usuarios.

## Funciones implementadas

- Crear entradas para casa, negocio, consultorio/oficina o edificio, con nombre,
  zona horaria, WhatsApp y horarios; activar o pausar y descargar QR PNG/SVG.
- Adoptar un QR WhatsApp existente conservando su enlace y respetando su pausa.
- Configurar un portal con motivos, mensajes e imágenes propias. El mensaje básico
  WhatsApp es gratuito; varias plantillas públicas requieren la prestación de pago.
- Enviar un aviso explícito al panel. WhatsApp abre el mensaje para que el visitante
  confirme su envío; no envía mensajes automáticamente ni oculta el número.
- Vincular una entrada con un inmueble/QR Digital y una licencia propia. Los motivos
  autorizados se resuelven en el servidor y pueden acompañar una llamada real.
- Reservas por servicio y profesional, horarios semanales, duración, anticipación,
  horizonte y bloqueos. Agenda con día/semana/lista, confirmación, reprogramación,
  cancelación, completado y ausencia. La licencia debe incluir reservas.
- Comprobante privado sin cuenta del visitante y cancelación según la política
  guardada. La capacidad privada viaja en el fragmento de URL y no en su consulta.
- Protección de doble reserva, reintentos idempotentes, vencimiento de solicitudes
  pendientes, límites de solicitudes y aislamiento por propietario. Reprogramar a
  un horario ocupado conserva la reserva original.
- Carga de imágenes del portal autenticada, limitada a 2 MB, con comprobación de
  bytes y pertenencia. No requiere crear un perfil de vendedor del Marketplace.

Los inmuebles Digital y entradas vinculadas consumen un único cupo de licencia;
los elementos independientes sí consumen cupos distintos. Los clientes VISO
anteriores conservan las prestaciones nuevas cuando editan un plan sin conocerlas.

## Condiciones comerciales y límites

Las cuatro propuestas son WhatsApp básico, negocios/reservas, hardware VISO
elegible y edificios con asistencia. Los importes nuevos, modelos participantes y
condiciones del beneficio de hardware siguen pendientes. Elegir una opción en la
interfaz no concede licencias. No se activaron cobros, se modificaron credenciales
ni se realizaron pagos reales durante esta entrega.

Un número dedicado requiere preparación manual. No existe una central de llamadas
WhatsApp. La web del propietario debe estar abierta para recibir; la recepción
Android utiliza la APK VISO compatible y sus permisos. No se creó una APK propia
Te Aviso ni una aplicación iOS. Los avisos simples nuevos llegan al panel web; no se
implementó un nuevo canal de notificaciones en segundo plano para esos avisos.
Los comprobantes no envían recordatorios por correo ni SMS.

Luz Tapo L535E Matter sigue en evaluación; cerradura, controlador y sensor no están
seleccionados. La página Dispositivos informa ese estado: no controla accesos ni
ofrece apertura de puerta mediante el QR. No se probaron dispositivos físicos.

## Publicación y verificación

Frontend independiente Vercel `teaviso`, despliegue
`dpl_A43wMPVjspangPa5HaxuE5zKJR9T`, estado READY. Salida `apps/teaviso/dist`,
publicada desde un directorio de despliegue separado del proyecto VISO. Se publicó
también el backend compatible en `vivid-nightingale-785`. El frontend VISO sigue en
`dpl_9DVS5zTpqMAb1MV918Xh7zue8zZx`; no se recompiló ni distribuyó una APK.

- 975 pruebas en 106 archivos correctas; TypeScript, ESLint de los archivos
  modificados y compilación de producción correctos.
- 46 comprobaciones de navegador en 320, 390, 844 y 1440 px. Componentes React y
  funciones Convex reales mediante un puente local con `convex-test` e identidades
  sintéticas. Se comprobó reserva, reprogramación, cancelación, aviso de visita,
  alta, edición y aislamiento de cuentas, sin errores de ejecución ni desbordamiento.
- Producción: HTTPS con validación TLS, comparación de archivos con la compilación,
  rutas SPA, configuración pública y rechazo del acceso anónimo al listado privado.
  No se completó un nuevo consentimiento Google, pago o llamada real en producción.

El navegador del entorno no confía en la CA del proxy HTTPS. Se conservó la
validación de certificados: navegador local para interacción y cliente HTTPS del
sistema para comprobar la entrega pública. Convex informó límites de su plan
gratuito durante la publicación; las funciones se publicaron correctamente.

Informe reproducible: [validación de producción](validation/te-aviso-v2-production.json).
Alcance aprobado: [propuesta original](te-aviso-v2-propuesta.md).
