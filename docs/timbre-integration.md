# VISO Timbre — mapa de integración y alcance

Fecha de auditoría: 22 de octubre de 2026. Rama: `feat/viso-timbre`.

## Arquitectura encontrada

| Área | Implementación existente | Conexión de Timbre |
| --- | --- | --- |
| Identidad | Convex Auth, usuarios VISO, acceso Google web/Android | Misma identidad y sesión; sin cuentas duplicadas |
| Datos/API | Convex, esquema en `convex/schema.ts` | Tablas aditivas y autorización por sitio, unidad y rol |
| Navegación | React/Vite, PanelLayout, Capacitor Android | Una entrada Timbre en el panel y en la app existente |
| Marketplace | Catálogo, biblioteca, creadores y administración | Ofertas de Timbre en el marketplace actual |
| Pagos | Mercado Pago, checkout por producto, verificación servidor, OAuth vendedor | Licencia únicamente por pago verificado y beneficio comercial explícito |
| Hardware y envíos | Catálogo físico informativo; checkout físico general bloqueado | Variantes y pedidos de placas separados, configurables; no se presuponen proveedores |
| Estados | `setActiveStatus`, revisiones y eventos para dispositivos | Arbitraje de fuentes para llamadas concurrentes y restauración segura |
| Telefonía | Android TelephonyManager y servicio de presencia | Se conservan permisos y comportamiento; Timbre es otra fuente |
| Meet/Zoom | Presencia por agenda, no confirmación de participación | No se atribuye detección directa inexistente |
| WhatsApp | No se encontró detector fiable de llamadas WhatsApp | No se anuncia una capacidad que el código actual no tiene |
| Luces | Google Home nativo, webhooks y mecanismos actuales de sincronización | Se reutilizan estados y eventos; sin reescribir controladores |
| Mini/Matrix/Display | Estado compartido y endpoints ya existentes | Señalización por esos mecanismos; validación física pendiente |
| Notificaciones | Sin infraestructura FCM/APNs ni service worker de llamadas | Avisos con VISO abierto; recepción con app cerrada necesita proveedor y configuración |
| Audio/video | Sin infraestructura WebRTC previa | Señalización Convex, capacidades por sesión, TURN con credenciales temporales |
| Facturación fiscal | No se encontró integración fiscal | No se presenta el comprobante de pago como factura fiscal |
| Cerraduras | Sin proveedor de apertura compatible verificado | No habilitar apertura; autorización y adaptador requeridos antes de ofrecerla |

La consulta a bellify.io fue rechazada por la política de red del entorno (HTTP CONNECT 403). Se trabaja con el alcance funcional suministrado, sin copiar sus recursos.

## Reglas de integración

1. Timbre no se activa por registrarse ni por adquirir cualquier recurso del marketplace.
2. La licencia debe estar vigente en el servidor. Un error, ausencia de pago o precio sin configurar nunca concede acceso.
3. Hardware o placas sólo conceden licencia cuando el beneficio está configurado explícitamente y el pago ha sido verificado.
4. Precio, periodicidad, materiales, stock comercial, transportista y plazos se administran; no se cargan valores inventados.
5. El QR es un identificador público aleatorio revocable, no una credencial del propietario ni una autorización de apertura.
6. Visitantes acceden sin registro. Las acciones privadas requieren la sesión VISO y permisos correspondientes.
7. Los módulos se integran sin añadir navegación permanente a las vistas de Deck y Display de pantalla completa.
8. Los contratos de renovación automática requieren integración real con el proveedor; guardar una periodicidad no programa cobros.

## Fases y verificación

| Fase | Trabajo de código | Validación necesaria |
| --- | --- | --- |
| Base | Licencias, sitios, integrantes, unidades, QR y página pública | Acceso sin licencia, aislamiento de cuentas, revocación y límites |
| Comunicación | Audio/video, señalización, chat, historial y aviso entrante | Dos contextos de navegador; dos dispositivos/redes y TURN fuera del laboratorio |
| Dispositivos | Estados y concurrencia con telefonía | Pruebas automáticas de restauración; Google Home y hardware reales |
| Comercio | Editor, archivos imprimibles, variantes, pedidos y beneficios | Decodificación QR, medidas PDF; impresión y pago de prueba verificado |
| Ampliadas | Invitaciones, familias, unidades, horarios y permisos | Caducidad, roles, destinatarios y aislamiento entre departamentos |

El registro final de pruebas y las limitaciones se completan en la documentación de entrega. La existencia de una tabla o una pantalla no se considera prueba de que una integración externa esté operativa.

## Despliegue seguro

Los cambios son aditivos y no exigen convertir usuarios existentes en clientes de Timbre. Publicar primero en un entorno de revisión con su propia base de datos. Configurar un origen público HTTPS para los QR; las direcciones de desarrollo no sirven para una placa vendida. Configurar TURN REST con credenciales temporales antes de habilitar llamadas. Probar pagos en el modo correcto, sin conceder licencias por una respuesta del navegador.

No ejecutar despliegues a producción ni emitir licencias a cuentas reales durante las pruebas locales. La publicación requiere aprobación del usuario después de los controles. Antes de publicar se debe revisar también la política de privacidad, conservación del historial, uso de cámara/micrófono y el tratamiento de direcciones de envío.
