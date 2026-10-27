# Te Aviso · panel propio y propuesta simplificada

Estado: revisión, sin publicar. El propietario confirmó que Te Aviso debe resolver
su panel y administración acá, con conexión a VISO solo para clientes que utilizan
o compran un Deck. Después indicó que la portada, planes y vista móvil publicados
son confusos. Se mostró una nueva propuesta visual; su aprobación sigue pendiente.

## Separación implementada para revisión

- Perfil propio `teavisoAccounts`, creado al ingresar a Te Aviso o crear un timbre.
  Abrir VISO no inscribe por sí solo al usuario como cliente de Te Aviso.
- Mi cuenta permite editar nombre y teléfono acá. Conserva su identidad de acceso;
  no cambia los datos del perfil VISO, contraseñas, permisos ni licencias.
- Mis timbres muestra entradas/QR y timbres Digital existentes. Llamadas,
  integrantes y configuración se abren dentro de Te Aviso.
- El workspace Digital autónomo oculta los menús comerciales/admin duplicados.
- Administración local: directorio paginado y búsqueda por nombre/correo dentro
  de los clientes Te Aviso; ficha del cliente, contacto, planes y timbres.
- El administrador puede corregir nombre/contacto y renombrar, pausar o reactivar
  timbres propios del cliente. Se exige motivo, autorización del servidor y versión
  actual; se conserva auditoría. Un cambio no concede licencias ni revive QR borrados.
- Un timbre vinculado sincroniza la pausa con su QR anterior e inmueble Digital.
- El acceso «Mi Deck VISO» requiere páginas Deck existentes o una licencia activa
  por compra de hardware elegible. Se puede ocultar desde Mi cuenta sin eliminar
  el Deck ni afectar su funcionamiento.

El correo de acceso permanece de solo lectura. No se agregó una operación de
eliminación global de identidad, cambio de correo sin verificación ni atribución de
administradores. Los clientes VISO que no usan el servicio Timbre quedan fuera del
directorio. Los permisos administrativos se verifican por ID del servidor.

## Propuesta de diseño, pendiente

[Ver propuesta móvil](design/te-aviso-simplificado-mobile-propuesta.png).
Las tarjetas y visitas del mockup son ejemplos, no datos reales de clientes.

1. Inicio: «Tu timbre, en un QR», una explicación breve, un botón principal y una
   demostración. Cómo funciona resumido en crear, colocar y recibir.
2. Planes por necesidad: personal, negocio y edificio, con prestaciones concretas.
   El QR WhatsApp básico conserva su condición gratuita; los adicionales y contratos
   pagos se distinguen sin inventar importes.
3. Panel centrado en Mis timbres, agregar, configurar/ver QR y últimas visitas.
   Deck es una conexión secundaria; administración es exclusiva del administrador.

No se aplicó esta portada ni una nueva agrupación comercial en producción.
El nombre, precios y alcance final de las tarjetas se confirmarán antes de convertir
la propuesta en planes contratables; no se modifica lo ya comprado.

## Verificación y publicación pendiente

987 pruebas en 108 archivos correctas; 12 pruebas focalizadas repetidas tras ajustar
las versiones de edición. Se comprobó el panel con componentes React y funciones
Convex reales mediante `convex-test` local, en 390/1440 px: 32 comprobaciones, sin
errores de ejecución ni desbordamiento. Incluye edición persistente de perfil,
visibilidad condicional de Deck, directorio restringido y pausa de un QR público.
TypeScript, ESLint de archivos modificados y compilación de Te Aviso correctos.
No se hicieron llamadas o pagos reales. No se compiló una APK.

Antes de publicar: aprobar diseño y alcance, publicar el backend compatible en
`vivid-nightingale-785`, ejecutar la migración paginada interna
`teaviso_accounts:migrateLegacyAccounts` para `spaces`, `whatsapp`, `business`,
`digital` y `members` hasta `done: true` en cada fuente. Conserva perfiles existentes
sin reemplazarlos. Luego publicar únicamente el frontend del proyecto Vercel
`teaviso` y comprobar sus rutas/archivos por HTTPS. No usar el `.vercel` raíz VISO.

[Informe local](validation/te-aviso-panel-local.json).
