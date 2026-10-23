# VISO Timbre — registro de validación de la revisión

Rama: `feat/viso-timbre`. Base: `97195af`. Controles de esta revisión: 22 y 23 de octubre de 2026. No se publicaron funciones ni datos en producción, no se habilitaron cobros y no se realizaron cargos.

## Resultados

| Control | Resultado | Alcance |
| --- | --- | --- |
| Suite completa Vitest | 871 pruebas aprobadas en 92 archivos | Funcionalidad anterior y ampliación Timbre, con proveedores simulados en las pruebas de pagos y push. |
| TypeScript frontend y backend | Aprobado | Compilación de la aplicación y comprobación del esquema/API Convex. |
| Vite web y paquete web Android | Aprobado | Rutas, componentes y recursos empaquetados. Una compilación no valida el backend productivo ni publica la aplicación. |
| Capacitor y Gradle | `testDebugUnitTest` y `assembleDebug` aprobados; 27 pruebas JUnit, cero fallos | Variante Android normal con el SDK Home existente y FCM explícitamente no disponible sin configuración. |
| ESLint sobre todos los archivos TypeScript/JavaScript modificados y nuevos | Aprobado, sin avisos | Incluye backend, rutas, editor, pagos, push, pruebas y conexiones con presencia existente. |
| ESLint global del repositorio | 13 errores y 4 avisos previos en 10 archivos | Todos esos archivos son idénticos a la base `97195af`; se conservaron para respetar el alcance. No se presenta el lint global como aprobado. |
| `git diff --check` | Aprobado | Sin errores de espacios en el cambio. |
| Exportación QR en Chromium | 15 exportaciones verificadas | PNG/SVG/PDF; vertical y horizontal; código solo y diseño completo; imágenes propias y Unicode. Se decodificaron también los PDF rasterizados finales. |
| Llamada de audio/video real con TURN | Aprobado en laboratorio local | Dos contextos Chromium aislados, interfaz VISO, backend Convex local y coturn por TCP; audio y video bidireccionales con candidatos relay en ambos extremos. |
| Navegación y diseño | Revisado en escritorio y móvil | Capturas y resultado en `docs/validation/`; datos sintéticos locales. |

Los comandos de verificación usaron los ejecutables instalados en `node_modules` directamente. En este entorno `pnpm exec` intentaba abrir un almacén SQLite fuera del espacio disponible; eso no impidió ejecutar TypeScript, Vitest, ESLint, Vite, Capacitor y Gradle.

## Qué cubren las pruebas nuevas

- Licencia pagada vigente, propiedad, funciones, cuotas y separación entre usuarios; una cuenta, una autorización de suscripción o un pago sandbox no activan Timbre.
- Sitios, horarios diurnos y nocturnos, unidades, permisos, destinatarios, invitaciones verificadas, caducidad, pausa, rotación y revocación de QR.
- Sesiones de visitante con capacidades opacas, límites de frecuencia, autorización de señalización, primer destinatario que atiende, mensajes, avisos alternativos, expiración y limpieza.
- Superposición de telefonía, agenda, timbre entrante y llamadas atendidas; restauración sin sobrescribir una selección manual, incluso del mismo estado.
- Pedidos y licencias idempotentes, condiciones compradas inmutables, devolución parcial o total, contracargo, cupones, renovación por calendario, períodos futuros y huecos sin pagar, cancelación y notificaciones firmadas repetidas.
- Archivo de producción asociado al QR y diseño correctos, hash, bloqueo de sustitución y seguridad de rotación durante fabricación.
- Registro push asociado a sesión, cuenta y dispositivo, cambio de cuenta, caducidad, revocación y transporte FCM simulado. Las claves RSA de las pruebas se generan localmente.
- Vistas sin licencia, usuarios invitados, historial vencido, diseño de placa coincidente con la vista previa y cambio de QR sin conservar el borrador de otro acceso.
- Cámara y micrófono sólo después de una acción explícita; cierre de medios, rutas de llamada y sesiones simultáneas en distintas pestañas.

## Evidencia de integración

El [registro RTC](timbre-rtc-validation.md) explica el recorrido real y contiene enlaces a los informes portables. La prueba utilizó medios sintéticos y datos locales, no cuentas ni información personal de producción. Confirmó audio/video recibidos, candidatos `relay`, estados, señalización real, colgado sincronizado, pistas detenidas y restauración de la base.

Esa prueba no equivale a dos celulares físicos ni dos redes independientes. Tampoco demuestra entrega FCM, compra real, impresión o respuesta física de Google Home, Mini o Matrix.

## Pendientes antes de comercializar

1. Configurar TURN público con TLS y probar dos dispositivos y redes independientes, permisos, llamadas prolongadas, desconexión y finalización.
2. Configurar el mismo proyecto Firebase en backend y APK; compilar la variante FCM y comprobar recepción real en primer plano, fondo, bloqueo, cierre de sesión y cambio de cuenta. No hay continuidad de medios con el WebView suspendido ni aplicación iOS nativa.
3. Configurar precios, límites, variantes, condiciones y envíos reales desde administración. Verificar la aplicación Mercado Pago y sus notificaciones antes de habilitar contratación recurrente. La bandera queda desactivada.
4. Probar en equipos reales las transiciones y restauración de las luces y dispositivos ya vinculados. No se reescribieron sus controladores ni se certifica firmware que no se probó físicamente.
5. Aprobar e imprimir archivos sobre los materiales ofrecidos, escanear el resultado y validar el proceso real de fabricación y despacho. No hay transportistas ni plazos inventados.
6. Resolver por separado una integración de cerradura compatible si se ofrece apertura: no hay un proveedor ni una acción de apertura funcional en esta revisión. El QR público nunca abre una puerta.

La [matriz de alcance](timbre-status.md) identifica otros límites, como facturación fiscal, carrito general y detección universal de llamadas de aplicaciones externas.

## Incidencia del entorno de prueba

Un intento de configurar un entorno local mediante el CLI creó un proyecto remoto vacío llamado `viso-timbre-local-validation-8a99c`. Se detuvo inmediatamente antes de subir funciones, esquema, variables o datos. No se modificó la configuración raíz ni el proyecto productivo. El proyecto vacío no se utilizó para estas pruebas y no se eliminó automáticamente. Después se usó directamente el binario local aislado. La incidencia fue comunicada al usuario.
