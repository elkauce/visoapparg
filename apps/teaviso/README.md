# Te a Viso — producto web independiente

Web con identidad propia, registro, panel y QR a WhatsApp, vinculada a las cuentas
y al servicio de llamadas existentes de VISO. Proyecto dentro del repositorio para
reutilizar código sin duplicar cuentas, inmuebles ni licencias. Publicado en https://teaviso-manuelhaguilar8-4981s-projects.vercel.app tras autorización del propietario.
Se actualizaron las funciones del backend compartido. La APK y la web VISO de producción se conservaron; no se habilitaron cobros.

## Ejecutar desde la raíz del repositorio

- `npm run teaviso:dev`: web de desarrollo en puerto 5174.
- `npm run teaviso:build`: TypeScript y compilación en `apps/teaviso/dist`.
- `npm test`: pruebas de VISO y Te a Viso.

Instalar dependencias desde la raíz: los componentes y el backend se comparten.
La carpeta no debe copiarse sola a otro repositorio sin extraer también sus
componentes compartidos. Compilación y despliegue de la web son independientes.

## Identidad

**Te a Viso**, firma **por VISO**, mensaje **Tu puerta. Estés donde estés.**
Logo vectorial original `public/symbol.svg`. Verde `#123E36`, lima `#D8F279`,
fondo `#F7F6F0`. Manrope y DM Sans, con alternativas del sistema. Las fuentes
locales heredadas conservan sus licencias en `public/fonts`.

## Rutas

| Ruta                   | Función                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `/`                    | Portada propia y generador anónimo de QR directo a WhatsApp                   |
| `/panel`, `/login`     | Registro e ingreso propios; cuenta compartida con VISO                        |
| `/panel/whatsapp`      | QR gratuitos de la cuenta, edición, pausa, eliminación y descarga             |
| `/panel/business`      | Solicitudes, condiciones, contratación y seguimiento Business                 |
| `/panel/admin`         | Precio, condiciones y configuración de Business; solo administradores         |
| `/timbre`              | Panel de llamadas con inmuebles, unidades, integrantes y licencias existentes |
| `/t/:qr`               | Visitante de un timbre digital; no requiere registro                          |
| `/w/:token`            | Visitante de WhatsApp; enlace permanente resuelto en el servidor              |
| `/timbre/call/:callId` | Atender con cuenta autorizada                                                 |

El QR de la cuenta conserva el enlace al editar el teléfono/mensaje. El QR anónimo
directo de la portada contiene el número y requiere reimpresión si se cambia.
Un QR pausado o eliminado deja de resolver. Los visitantes no instalan una app.
El número es visible en WhatsApp; no se promete ocultarlo ni iniciar una llamada
sin interacción. No hay central ni transferencia de llamadas de WhatsApp.

## Cuenta y llamadas

El formulario de correo/contraseña usa el mismo Convex Auth que VISO: no crea una
segunda cuenta al ingresar. Los tokens se almacenan por origen, nunca se comparten
por URLs. Se vuelve a iniciar sesión al cambiar de dominio. Para Google, el servidor
admite únicamente el callback exacto del origen expresamente configurado.

El workspace, visitante y sesión de llamada son los mismos componentes y funciones
autorizadas de VISO, con marca Te a Viso por contexto. Se conservan licencias,
permisos, disponibilidad, TURN y políticas de notificación. No hay migraciones de
propietarios ni licencias gratuitas implícitas. La web requiere estar abierta para
recibir avisos; no se implementó Web Push. La APK VISO 1.16.1 ya publicada sigue
siendo compatible. **No se construyó ni distribuyó una APK independiente Te a Viso.**
Para esa etapa hay que definir paquete Android, firma y cliente Firebase propios,
y adaptar los enlaces nativos sin sobrescribir la APK VISO.

## WhatsApp Business pago, con preparación manual

1. El cliente registra una solicitud privada con teléfono de coordinación.
2. Un administrador define importe ARS y condiciones desde `/panel/admin`.
3. El cliente acepta las condiciones y el importe actual antes de ir a Mercado Pago.
4. El pago se verifica por el flujo de webhook existente, incluyendo importe,
   moneda, comprador/orden, receptor, modo y duplicados.
5. Solo después del pago confirmado, un administrador asigna el número ya
   preparado, carga el mensaje y confirma que probó la configuración.
6. El QR se activa y el cliente puede descargarlo, pausarlo y editar el mensaje.
7. Reembolso o contracargo desactiva el servicio público.

No se provisionan líneas de teléfono o cuentas de WhatsApp automáticamente. Nunca
se piden contraseñas o códigos de WhatsApp por el formulario. La operación debe
preparar número, perfil y configuración con el cliente. La oferta es un **pago único
por configuración**; las condiciones deben aclarar titularidad del número,
mantenimiento, costos posteriores, alcance, plazos y cancelación. No hay renovación
mensual automática Business ni precios inventados.

Los controles existentes de cobro permanecen intactos: guardar una oferta no
habilita Mercado Pago, split o cobros. Sin condiciones/importes/dominio y proveedor
preparados, solo se registra interés sin cobrar ni activar nada. No se probaron
pagos reales ni se enviaron mensajes o llamadas a terceros.

## Configuración y publicación

### Web, variables públicas

Ver `.env.example`. `VITE_CONVEX_URL` apunta al backend compartido autorizado.
`VITE_TEAVISO_PUBLIC_URL` y `VITE_PUBLIC_APP_URL` deben apuntar a la URL HTTPS de
Te a Viso aprobada antes de imprimir códigos. En desarrollo se usa el origen local.
`VITE_VISO_ORIGIN` es el enlace al ecosistema VISO. Nunca colocar secretos en VITE.

### Backend

- Despliegue correcto: **vivid-nightingale-785**. No usar el proyecto antiguo.
- `TEAVISO_WEB_ORIGIN`: un único origen HTTPS aprobado, sin rutas, consultas o hash.
  Controla callback Google y regreso del pago al panel Business.
- Google reutiliza el proveedor existente; callback de Te a Viso permitido solo
  cuando coincide exactamente con el origen configurado.
- `SITE_URL` debe seguir siendo el de VISO para preservar sus callbacks y pagos.
- Mercado Pago y TURN/FCM reutilizan las variables privadas actuales. No copiar
  credenciales a la web ni activar flags de cobro durante la publicación.
- `MARKETPLACE_ADMIN_USER_IDS` sigue definiendo los administradores por ID inmutable.

Crear un proyecto de hosting **distinto** del de VISO. Directorio raíz del repositorio,
comando `npm run teaviso:build`, salida `apps/teaviso/dist`; aplicar la configuración
de referencia `apps/teaviso/vercel.json` a ese proyecto. Mantener intacta la
configuración raíz de publicación VISO. Primero acordar la URL independiente,
configurar los orígenes y publicar el backend compatible, luego la web.

Cuando el propietario controle teaviso.com, asociar DNS, HTTPS y redirección www,
actualizar variables y mantener los dominios antiguos para los QR ya impresos.
No se presume disponibilidad ni propiedad de teaviso.com. No se migró servidor.

La rama `feat/teaviso-product` excluye la integración Telegram que no se autorizó;
la implementación previa permanece en su rama anterior, sin publicar.

## Verificación

- TypeScript de ambos proyectos y backend, build de producción y ESLint.
- Pruebas de aislamiento por cuenta, consentimiento, edición sin rotar token,
  eliminación, límites, acceso admin, reserva idempotente, precio/condiciones,
  pago verificado, preparación del servicio, pausa, reembolso y OAuth acotado.
- Pruebas de interfaz de ingreso/registro, edición, mensajes y aceptación de términos.
- Chromium en 1440/390/320 px: navegación, formularios, QR, panel, Business,
  administración y workspace, sin desbordamiento. Fixtures sintéticas y sin red
  externa; no equivalen a un ingreso Google, pago ni llamada reales en producción.
- PNG descargado decodificado y comprobado contra el enlace esperado; SVG comprobado.
- Capturas e informe local en `artifacts/teaviso/`, ignorados por Git.

## Publicación del 24 de octubre de 2026

Web pública: https://teaviso-manuelhaguilar8-4981s-projects.vercel.app .
Proyecto Vercel independiente: `teaviso`, ID `prj_hEhkg9sAvj5fdk2CWK1fw61oe2nC`.
Despliegue `dpl_CpJQCkvRH8K47Z1K1nSDvWZg2vvj`. Google y callback del origen
aprobado configurados. 22 archivos estáticos comparados, 8 rutas y 27 comprobaciones
de navegador publicadas correctas. No se creó usuario de prueba ni se completó
consentimiento Google, pago o llamada real. Oferta Business sin precio configurado
y cobros globales deshabilitados. Informe: `docs/validation/teaviso-production.json`.
Convex informó límites del plan gratuito; las funciones se publicaron y respondieron.

## Revisión visual publicada

Publicada el 24 de octubre de 2026 con autorización «Publica todo»: identidad y
símbolo VISO con nombre Te a Viso, comunicación simplificada, cuatro placas con
selección guardada y cuadro principal con latidos y colores de los estados.
URL vigente: https://teaviso-manuelhaguilar8-4981s-projects.vercel.app .
Detalles en `docs/teaviso-redesign.md`; verificación en
`docs/validation/teaviso-redesign-production.json`. Cobros deshabilitados.
