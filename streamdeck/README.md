# Actualización 1.2.1: iconos personales

La descarga desde VISO genera un PNG de 72 y 144 px por estado, usando el mismo símbolo y color del estado en la app. APAGAR usa el símbolo de encendido. La plantilla pública continúa sin cuenta y se convierte a ZIP32 verificado antes del build.

El manifest personal asigna cada PNG a la acción por ID estable. Al actualizar, el plugin corrige imágenes de teclas existentes una vez por cambio del PNG; guarda una huella en sus ajustes, conserva los demás ajustes y no vuelve a sobrescribir una personalización manual si el PNG del instalador sigue igual. Instalar la actualización y reiniciar Stream Deck conserva las acciones y posiciones.

Verificado con el SDK oficial: migración del icono en teclas existentes y ausencia de sobrescritura en apariciones posteriores; los estados siguen activándose con sus IDs. La descarga real en Chromium verifica PNGs de 72/144 px dentro del paquete generado. La apariencia en el hardware queda pendiente de prueba del usuario. La versión anterior queda como `downloads/VISO-Elgato-1.2.0-recovery.streamDeckPlugin`.

# VISO para Elgato Stream Deck 1.2

## Descarga personal lista para usar

En la web VISO, ingresá con tu cuenta y abrí Deck → estrella → Elgato Stream Deck → **Descargar mi plugin configurado**. La descarga se prepara en tu navegador con tus estados, nombres y acceso personal. No se envía el token a un servicio de empaquetado.

Abrí Mi-VISO.streamDeckPlugin en tu computadora y aceptá actualizar VISO. La categoría VISO Deck incluye tus controles personales ya vinculados: arrastralos a las posiciones que prefieras. No tenés que importar JSON, pegar URLs ni seleccionar otra vez el estado de cada tecla. El instalador conserva las acciones anteriores para perfiles existentes; no reemplaza la distribución de teclas del usuario.

**El instalador personal contiene acceso revocable a tu cuenta: no lo compartas.** Renovar el token requiere descargar e instalar uno nuevo. Para cambios en tus estados, descargá nuevamente tu plugin. La versión pública es una plantilla sin credenciales y no vincula cuentas por sí sola.

El instalador lee account.json al iniciar, valida los estados, persiste la configuración con el SDK oficial y recuerda la huella de esa descarga. Los controles personales usan el ID real del estado, evitando confusiones entre estados con el mismo nombre. El paquete requiere Stream Deck 7.1+, Windows 10+ o macOS 12+. Node24 viene incluido con Elgato. La prueba física sigue pendiente.

El botón de descarga requiere la nueva web. La APK actual conserva su exportación anterior hasta una actualización; por ahora usá la web desde la computadora. No se desplegaron cambios de backend ni se cambió Google Home.

## Compatibilidad: flujo anterior 1.1

Instalador: `downloads/VISO-Elgato-1.1.streamDeckPlugin`. Requiere Stream Deck **7.1 o posterior**, Windows 10+ o macOS 12+. Usa el SDK oficial Elgato 3.0.2 y Node.js 24 incorporado en Stream Deck.

## Instalación y vinculación

1. Abrí el instalador en tu computadora y aceptá actualizar VISO Deck.
2. En el programa Elgato, expandí **VISO Deck** y arrastrá LIBRE, OCUPADO, REUNIÓN, LLAMADA, NO MOLESTAR o AUSENTE a las teclas que quieras. También están APAGAR y **Estado VISO**, para tus estados personalizados. Instalar el plugin no rellena ni reemplaza tu distribución de teclas.
3. Entrá con tu cuenta en https://viso-deck-android.vercel.app, abrí el Deck y la estrella → **Elgato Stream Deck** → **Descargar mi configuración para el plugin**. También podés exportar desde la app y transferir el JSON a tu computadora.
4. Seleccioná una tecla VISO en Elgato e importá ese JSON **una sola vez**. Los controles nuevos comparten la configuración. En Estado VISO elegí tu estado personal y, opcionalmente, cambiá el nombre visible de la tecla.
5. Pulsá una tecla. La confirmación aparece cuando el servidor acepta el cambio; la app y los displays usan la sincronización existente. APAGAR quita el estado activo de tu cuenta.

Los estados deben existir en tu cuenta. Si falta uno, agregalo en VISO y volvé a exportar/importar la configuración. El plugin no inventa estados ni URLs. Podés personalizar imágenes, nombres, páginas y perfiles desde Elgato.

La acción Estado VISO anterior conserva su identidad y sus URLs configuradas. Renovar el token exige importar el nuevo JSON; las teclas antiguas con URL explícita necesitan actualizar esa URL o elegir un estado desde la configuración compartida.

El instalador público no contiene credenciales. El JSON y los perfiles contienen acceso personal revocable: no los compartas. Solo se aceptan URLs HTTPS del endpoint VISO existente y una misma cuenta/backend por importación. No modifica dispositivos ni permisos Google Home. No requiere otra APK ni cambios de la web. No incluye todavía controles OBS.

La versión 1.0 queda disponible en `downloads/VISO-Elgato-1.0.streamDeckPlugin` como recuperación.

## Desarrollo y verificación

Desde `streamdeck/`: `npm ci`, `npm test`, `npm run pack`. Dependencias fijadas en package-lock.json. El build genera bin/plugin.mjs y ui/configuration.js. Para validación oficial con proxy, usar NODE_USE_ENV_PROXY=1; no omitir validación.

Verificado: 10 pruebas unitarias, 31 comprobaciones del bundle con el SDK oficial y 8 comprobaciones del inspector en Chromium. Los protocolos Elgato de estas pruebas son fixtures. Además, los seis estados y APAGAR se comprobaron contra el servidor real con una cuenta técnica aislada y se restauró su estado inicial. El instalador fue validado con la CLI oficial. **Queda pendiente probar la instalación y las teclas en Elgato físico.**

Opcional: `npm run test:ui` y `node generate-icons.mjs` requieren Playwright/Chromium. VISO_PLAYWRIGHT_MODULE permite indicar el módulo instalado y VISO_CHROMIUM_EXECUTABLE el ejecutable. Son herramientas de desarrollo; el usuario no las necesita.
