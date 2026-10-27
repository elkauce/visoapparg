# Te Aviso · producto web independiente

Web publicada: https://teaviso-manuelhaguilar8-4981s-projects.vercel.app/ .
Timbre digital de instalación mediante QR, con panel, WhatsApp, visitas y reservas.
Comparte cuentas, Google, inmuebles, licencias y llamadas con VISO. La compilación y
la publicación del frontend son independientes de la web y APK VISO.

## Desarrollo

Desde la raíz del repositorio, instalar las dependencias y ejecutar:

- `npm run teaviso:dev`: desarrollo en puerto 5174.
- `npm run teaviso:build`: TypeScript y salida `apps/teaviso/dist`.
- `npm test`: pruebas de ambos productos y backend.

No copiar esta carpeta sola sin extraer también los componentes y backend que
comparte. El informe actual está en [la entrega actual](../../docs/te-aviso-sober-release.md).

## Identidad

**Te Aviso**, sin firma «por VISO». Mensaje **Tu timbre, en un QR.**
Símbolo original de cuatro colores `public/brand/viso-icon.png`. Fondo `#F5F3EF`,
blanco, grafito y naranja `#E84300`, tipografía Arial y controles sobrios.

## Rutas principales

| Ruta | Función |
| --- | --- |
| `/`, `/soluciones`, `/planes`, `/equipos` | Presentación y condiciones de las cuatro propuestas |
| `/login` | Registro/ingreso con cuenta VISO y Google |
| `/panel` | Resumen del espacio seleccionado |
| `/panel/nuevo`, `/panel/entradas` | Alta y edición de entradas, horarios y QR |
| `/panel/agenda` | Servicios, profesionales, reservas y bloqueos |
| `/panel/portal` | Motivos, mensajes y avisos de visitas |
| `/panel/dispositivos` | Estado de compatibilidad; sin apertura física |
| `/panel/whatsapp`, `/panel/business`, `/panel/admin` | Recorridos anteriores compatibles |
| `/timbre`, `/timbre/call/:callId` | Gestión y atención Digital existentes |
| `/w/:token`, `/e/:token` | Portal público estable; admite QR WhatsApp anteriores |
| `/t/:qr` | Visitante Digital y selección de unidad |
| `/reserva/:id` | Comprobante con capacidad privada en fragmento de URL |

Un visitante no necesita instalar ni registrarse. Los propietarios usan la misma
cuenta VISO; las sesiones son propias de cada origen y no se transfieren por URL.
Un QR pausado o eliminado no resuelve. WhatsApp requiere confirmar el envío y deja
visible el número; no se promete central ni transferencia de llamadas WhatsApp.
La web debe estar abierta para recibir llamadas. La APK VISO sigue compatible;
una APK propia Te Aviso permanece pendiente.

## Variables y despliegue

Ver `.env.example`. Variables públicas:

- `VITE_CONVEX_URL`: `https://vivid-nightingale-785.convex.cloud`.
- `VITE_CONVEX_SITE_URL`: `https://vivid-nightingale-785.convex.site`.
- `VITE_TEAVISO_PUBLIC_URL` y `VITE_PUBLIC_APP_URL`: origen HTTPS de Te Aviso.
- `VITE_VISO_ORIGIN`: `https://viso-deck-android.vercel.app`.

Nunca colocar secretos en variables VITE. En el backend, `TEAVISO_WEB_ORIGIN`
controla el callback Google exacto y el regreso de Business. `SITE_URL` conserva el
origen VISO para sus recorridos. Mercado Pago, TURN y FCM mantienen sus credenciales
privadas existentes; no se activan cobros por publicar el frontend. Administradores
mediante `MARKETPLACE_ADMIN_USER_IDS`, con ID inmutable.

Publicar en el proyecto Vercel **teaviso**, ID `prj_hEhkg9sAvj5fdk2CWK1fw61oe2nC`,
comando `npm run teaviso:build`, salida `apps/teaviso/dist`, rutas SPA según
`apps/teaviso/vercel.json`. **La configuración raíz `.vercel` corresponde a VISO**;
no usarla para publicar este producto. Ambos usan el backend `vivid-nightingale-785`,
por lo que sus cambios deben mantener compatibilidad con los clientes anteriores.

Para un dominio propio, comprobar propiedad, DNS y HTTPS, actualizar orígenes y
mantener los dominios anteriores para los QR impresos. No se presume propiedad de
teaviso.com ni se realizó una migración de servidor.

## Límites comerciales y físicos

No se inventaron tarifas ni se habilitaron cobros en esta entrega. Las reservas y
plantillas públicas requieren su prestación en la licencia. El básico WhatsApp
conserva su mensaje gratuito. Business con número dedicado requiere preparación
manual y pago verificado antes de asignación; guardar una oferta no activa cobros.
Los equipos y cerraduras siguen pendientes de validación; no hay control físico.

Ver [entrega y comprobaciones](../../docs/te-aviso-sober-release.md) y
[validación de producción](../../docs/validation/te-aviso-sober-production.json).

Carteles: `/carteles`, `/panel/carteles` y `/panel/admin/carteles`. Se reciben solicitudes de presupuesto; no se activaron cobros o fabricación. [Detalle de la entrega](../../docs/te-aviso-sober-release.md).
