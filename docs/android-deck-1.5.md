# VISO Deck 1.5 y Elgato 1.0

Continuación de `fix/viso-deck-reference-layout`; conserva VISO Deck 1.4 y no modifica `main`, STATUS, la web funcional publicada ni el backend existente. La versión de recuperación es `downloads/VISO-Deck-1.4-debug.apk` y su fuente `1d3e31b8a0444649d1b2feecf4343639814de628`.

## Páginas del usuario

Las tres páginas originales permanecen primero. Las páginas guardadas del usuario se agregan después, en el orden confirmado por el servidor, con el mismo carrusel manual: derecha avanza, izquierda vuelve y los números son indicadores sin menú. No se crean páginas al iniciar, no hay reproducción automática ni navegación al deslizar diálogos. Se conserva el límite existente de ocho páginas guardadas por cuenta, además de las tres originales.

Estrella → **Agregar página** crea una página del usuario y abre el editor existente. **Editar mis páginas y teclas** reutiliza ese editor, con nombres, cuadrículas, carpetas, acciones y contenido ya desarrollado. La presentación del carrusel oculta la cabecera del editor; las teclas siguen ejecutando sus acciones originales. Las carpetas cambian la página del carrusel y las páginas inactivas no reciben interacción. Desmontar una página integrada no saca Android de pantalla completa.

## Elgato

`downloads/com.viso.deck.streamDeckPlugin` se genera con el SDK oficial Elgato 3.0.2 y CLI 1.10.2. Requiere Stream Deck 7.1+, Windows 10+ o macOS 12+; Node.js 24 lo suministra Elgato. El bundle tiene una acción **Estado VISO**, configurable en cada tecla, que acepta una URL personal o un JSON exportado de la cuenta.

Estrella → **Elgato Stream Deck** → **Descargar mi configuración para el plugin** exporta los estados reales por ID y el acceso revocable del usuario autenticado. En Android usa `ACTION_CREATE_DOCUMENT`, sin nuevos permisos de almacenamiento; el guardado/cancelación se confirma desde el resultado nativo. En navegador genera un archivo local. El usuario transfiere el JSON a su computadora, instala el plugin, arrastra la acción e importa/selecciona el estado de cada tecla. Renovar el token existente revoca el JSON y las teclas anteriores.

El archivo público no contiene configuración personal. Los perfiles de Elgato y el JSON contienen un token: no se deben publicar ni compartir. El plugin usa exclusivamente HTTPS hacia el endpoint Convex `/deck/set`, rechaza destinos/credenciales/formatos inválidos, bloquea redirecciones, limita la espera a diez segundos y muestra éxito únicamente con una respuesta confirmada. No hace escaneo LAN ni requiere que el usuario deje la web abierta. No se importa la distribución completa ni acciones Android al hardware: el plugin controla los estados seleccionados de VISO. Los displays y las integraciones existentes reciben el cambio por el servidor compartido.

## Compilación y evidencia

- TypeScript y ESLint: pasaron.
- Vitest: **301 pruebas, 27 archivos**; incluye página elegida por ID, sincronización al pulsar, carpeta hacia el carrusel y preservación de inmersión.
- Android: APK debug 1.5.0, código 6, paquete `com.viso.deck`, compilada con el SDK Google Home original y certificado F3 idéntico a 1.4. **10 pruebas JVM**, sin fallos ni omisiones.
- Carrusel: **589 comprobaciones**, 18 vistas y seis tamaños de pantalla, sin fallos ni errores React. Se usaron gestos Chromium reales con fixtures externos explícitos de Convex/Android.
- Páginas adicionales: **26 comprobaciones** de cinco y seis páginas en vertical/horizontal, navegación circular, tecla guardada sincronizada y creación explícita. Fuera del checkout: `/workspace/.visoapparg-setup/custom-pages-test.mjs`.
- Plugin: cuatro pruebas de política HTTP y cuatro comprobaciones del bundle conectado al protocolo WebSocket oficial (registro, título, confirmación y alerta), con servidor/HTTP de prueba; instalación congelada reproducible con `npm ci` y `npm test` dentro de `streamdeck/`.
- Validación y empaquetado oficial Elgato pasaron; el bundle empaquetado coincide byte por byte con el bundle probado. Se excluyen logs y fixtures.
- Exportación/importación: el chequeo externo `/workspace/.visoapparg-setup/streamdeck-export-test.mjs` prueba el JSON de la cuenta y el inspector real del plugin. El selector Android se reemplaza explícitamente por un fixture: no constituye prueba física del guardado.

Solo se publicaron artefactos genéricos en el proyecto aislado de descargas Vercel, con `--target preview` explícito. Descargas: https://viso-deck-apk-downloads-netb4w55f.vercel.app/ . La APK anterior se conserva allí. Metadatos y hashes en `android-deck-1.5-evidence/artifacts.json` y `downloads/*.sha256`.

**Pendiente físico:** instalación/uso en Windows/macOS con Elgato, selector de guardado Android y autorizaciones/dispositivos Google Home. No se afirma vinculación Google Home ni cambio de color verificado. Se conservan sus permisos, selección de luces, restricciones de actividad de Android y configuración OAuth anteriores; ver `android-three-screens-google-home.md`. No se publicó una nueva versión de la web o del backend en producción.
