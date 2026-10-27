# Te Aviso · home y planes publicados

Publicado el 27 de octubre de 2026, con autorización expresa «Publica la web».

- Web: https://teaviso-manuelhaguilar8-4981s-projects.vercel.app/ .
- Planes: https://teaviso-manuelhaguilar8-4981s-projects.vercel.app/planes .
- Mi plan: `/panel/plan`.
- Administración de consultas: `/panel/admin/consultas`.

## Resultado

El home aprobado se integró como componentes React con estilos aislados. Conserva
fondo #F5F3EF, naranja #E84300, icono original y marca Te Aviso, foto ilustrativa del
cartel, latido suave y movimiento reducido. La navegación se adapta a móvil. Se
retiró la descarga de fuentes Google que el diseño Arial no utiliza y se aislaron
reglas antiguas que reducían/ocultaban el nombre de la marca.

Se separan WhatsApp propio y Digital; después Hogares, Negocios y Edificios. Los
carteles se presentan como productos físicos. Planes detalla QR, mensajes generales
y preparados, chat, audio/video, historial, horarios, silencio, ausencia, contactos
alternativos, integrantes, agenda/reservas, unidades/residentes y complementos.
La comparación y las condiciones de recepción/historial son desplegables.

Los importes de Avisos, Videollamada y Familia se muestran como **referencias** de
ARS 36.000 / 48.000 / 80.000. La duración, cupos, placas y envío se confirman mediante
propuesta antes de contratar. No se configuraron estos paquetes como planes
cobrables ni se activaron cobros, renovaciones o licencias. Negocios, Edificios y
adicionales conservan su consulta/cotización correspondiente.

La cercanía en Hogares figura expresamente **En preparación**, también en la
portada y las preguntas frecuentes. No se recoge ubicación ni se bloquea hoy el
QR por distancia. El paquete Avisos solo chat todavía necesita adaptar el filtro
de alta de Digital y configurar una licencia compatible antes de comercializarlo.
Las cerraduras y prestaciones físicas futuras no se anuncian como activas.

## Botones y contratación

Los botones tienen destinos reales: alta WhatsApp, consulta del plan elegido,
solicitud de número dedicado, catálogo/personalización de carteles, cuenta y
privacidad. Se quitaron los diálogos ficticios usados en la maqueta.

Mi plan muestra WhatsApp básico, consultas y los beneficios ya contratados. El
componente comercial compartido admite una vista de cuenta que mantiene licencias,
suscripciones y pedidos anteriores, sin duplicar un catálogo de adquisición ni
mostrar ofertas de prueba como opciones nuevas al cliente. VISO conserva el modo
completo original de ese componente.

Las nuevas consultas no realizan cargos ni conceden prestaciones. El cliente elige
la opción y puede agregar un mensaje; ve la recepción y la respuesta en Mis
consultas. El administrador autorizado revisa y responde desde Consultas de planes.
Se verifican sesión, propietario, catálogo permitido, longitud, reintentos
idempotentes, una consulta abierta por opción, límite diario y versión de respuesta.
Se guarda auditoría. No se envían correos, WhatsApp ni mensajes externos.

## Publicación y comprobación

Fuente `2a15f54`. Vercel Te Aviso `dpl_2ydzxTioh5X48kp1gnjwmAnPEGqu`, READY,
proyecto `prj_hEhkg9sAvj5fdk2CWK1fw61oe2nC`. Se verificó el alias canónico usado por
el callback Google. Backend compatible `vivid-nightingale-785` actualizado con tabla
y funciones de consulta nuevas. No hay migración de cuentas, QR o licencias.

Pasaron 1.006 pruebas en 111 archivos; 11 pruebas enfocadas volvieron a pasar tras
corregir tipos del test de la vista de cuenta. TypeScript raíz/backend, compilación
Te Aviso y ESLint correctos. Navegador local con React real y funciones Convex reales
mediante `convex-test`: 320, 390, 768 y 1440 px, enlaces, pestañas, tabla, menú,
consulta, respuesta administrativa, aislamiento entre usuarios y acceso anónimo.
Sin errores JS ni solicitudes externas. Las identidades fueron ficticias.

Producción verificada por HTTPS con TLS válido: 26 archivos comparados por SHA-256
y 26 rutas correctas. Los nuevos endpoints de consultas y administración rechazan
solicitudes sin sesión. Google continúa configurado. No se crearon usuarios o
consultas de prueba en producción ni se hicieron pagos, llamadas o pruebas físicas.

VISO mantiene el frontend `dpl_9DVS5zTpqMAb1MV918Xh7zue8zZx`; no se reconstruyó
la APK. No se modificaron credenciales ni facturación. Convex continúa informando
que los proyectos superan límites gratuitos; la publicación y las consultas de
verificación finalizaron correctamente.

Las [capturas de home](te-aviso-home-evidence/home-1440.png) y
[planes](te-aviso-home-evidence/plans-1440.png) corresponden a componentes reales en
el navegador local, no a una sesión autenticada de producción.

[Informe de publicación](validation/te-aviso-home-planes-production.json).
