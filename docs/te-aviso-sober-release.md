# Te Aviso · diseño sobrio y panel propio publicados

Web: https://teaviso-manuelhaguilar8-4981s-projects.vercel.app/ .
Publicado el 27 de octubre de 2026, con la autorización expresa «publica la web».
Esta autorización reemplaza la pausa solicitada durante las revisiones de diseño.

## Resultado

Portada breve con fondo #F5F3EF, acciones naranja #E84300, tipografía Arial y
controles sobrios. Marca visible **Te Aviso**, sin «por VISO». La placa vertical
instalada se presenta como imagen ilustrativa. Se incluyen demostraciones públicas
identificadas como ejemplos de agenda, llamadas y mensajes, con enlaces para usar
las funciones reales del panel. Los ejemplos no llaman ni envían avisos.

Los planes se presentan por espacio: Personal, Negocio y Edificio. El QR WhatsApp
básico conserva su condición gratuita. Los adicionales y licencias se habilitan por
contratación; no se inventaron tarifas ni cambiaron prestaciones compradas.

El cliente administra cuenta, timbres, integrantes, llamadas, visitas, agenda y
carteles dentro de Te Aviso. Nombre y teléfono del perfil son propios del producto,
sin modificar la identidad de acceso ni el perfil VISO. El acceso «Mi Deck VISO»
aparece solo con páginas Deck existentes o beneficio válido de hardware, y se puede
ocultar localmente. La recepción nativa sigue usando la APK compatible existente.

Administración dentro de Te Aviso: usuarios y timbres, contactos, pausa/reactivación
con motivo y auditoría, planes/licencias, números dedicados y solicitudes de carteles.
El directorio excluye las cuentas que solo utilizan VISO sin el servicio Timbre.
Se incorporaron los clientes anteriores por una migración interna paginada e
idempotente, sin reemplazar perfiles ni conceder licencias.

## Carteles y presupuestos

Tres modelos: Timbre QR, Dirección vertical compacta (12 × 18 cm orientativos), y
Profesional con nombre, profesión, matrícula opcional e información. Acrílico o
aluminio. Personalización con prueba SVG y QR real de una entrada propia.

El cliente revisa los datos y envía una **solicitud de presupuesto**, sin cobro ni
orden de fabricación. Puede ver el estado en Mis carteles. El administrador recibe
la solicitud, revisa datos, material y QR y guarda su seguimiento con notas internas;
esas notas no se incluyen en la respuesta al cliente. Los reintentos no duplican
solicitudes; se verifican propiedad, consentimiento, límites y versión de edición.
No se crean pedidos Mercado Pago ni se conceden licencias al solicitar un cartel.

Las medidas, materiales, fijación, costo, envío y condiciones deben confirmarse
antes de encargar la fabricación. La foto de la placa fue generada para ilustrar
el diseño y no acredita stock fabricado. Los QR de las imágenes de propuesta no se
usan para producir; la vista previa personalizada utiliza el enlace real del usuario.

## Rutas nuevas

- `/carteles` y `/carteles/:model`: catálogo y personalización previa.
- `/funciones/agenda`, `/funciones/llamadas`, `/funciones/mensajes`: ejemplos públicos.
- `/panel/timbres`, `/panel/llamadas`, `/panel/cuenta`: gestión dentro de Te Aviso.
- `/panel/carteles` y `/panel/carteles/:model`: solicitudes propias con QR real.
- `/panel/admin`, `/panel/admin/planes`, `/panel/admin/servicios`,
  `/panel/admin/carteles`: administración autorizada del servicio.

Los enlaces públicos y rutas anteriores siguen funcionando.

## Validación y entrega

991 pruebas en 109 archivos, TypeScript de raíz/backend y compilación Te Aviso
correctos; ESLint de los archivos cambiados correcto. 92 comprobaciones de navegador
con componentes React y funciones Convex reales, por puente local convex-test con
identidades sintéticas, en 320/390/844/1440 px. Se verificaron reservas, reprogramación,
cancelación, aviso de visita, cuentas separadas, personalización, lectura del QR real,
solicitud y revisión del presupuesto. No hubo llamadas, mensajes o pagos reales.

Producción: 26 archivos comparados por SHA-256 y 21 rutas correctas mediante HTTPS
con validación TLS; nuevos límites de sesión comprobados sin crear usuarios de
prueba. Google continúa disponible; Business permanece sin tarifa configurada.
El navegador del entorno no confía en la CA del proxy: la interacción se comprobó
localmente y la entrega pública con el cliente HTTPS del sistema, sin omitir TLS.

Backend compartido `vivid-nightingale-785` actualizado. Vercel Te Aviso READY,
despliegue `dpl_5iZcNau9MNDbUUSw7D43AZJrSUQC`. No se publicó el frontend VISO
ni se compiló una APK. Convex informó límites del plan gratuito; la publicación y
las consultas de comprobación finalizaron correctamente. No se modificó la facturación.

[Informe de producción](validation/te-aviso-sober-production.json).
