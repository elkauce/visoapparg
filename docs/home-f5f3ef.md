# Home VISO — diseño aprobado #F5F3EF

El usuario aprobó las propuestas completas de escritorio y celular y pidió aplicar el cambio el 19 de octubre de 2026. Implementado sobre `fix/viso-deck-reference-layout`, conservando `main`.

- Fondo cálido `#F5F3EF`, logo original visible y botones naranja. El resplandor central cambia suavemente con la demo de estados y respeta movimiento reducido.
- Se conservan las teclas y su animación de pulsación. Los estilos nuevos se aplican exclusivamente al home; no cambian el componente compartido de teclas ni Deck/Display.
- Escritorio incluye presentación, demo, funciones, luces compatibles con Google Home/Alexa y los tres productos. Display ocupa el centro.
- Celular mantiene la vista de app: cuenta, carrusel manual de productos con Display inicial, teclas, luces, productos, acceso y barra inferior con zona segura.
- Sin cambios en cuentas, OAuth, backend, APK, sincronización ni dispositivos.

Validación: compilación TypeScript/Vite correcta; ESLint de los tres componentes modificados correcto; 384 pruebas existentes correctas. 76 comprobaciones Playwright en 320, 390, 768 y 1280 px verifican ausencia de desbordamiento, demo, resplandor, carrusel por gesto táctil, flechas y puntos, navegación, diálogos de productos, acceso a cuenta y movimiento reducido. Sin errores de ejecución ni intentos de mutación. Las capturas de página completa muestran la barra fija en la posición de la ventana de captura; su comportamiento real sigue fijo abajo.

Publicado en https://viso-deck-android.vercel.app mediante el proyecto Vercel existente, despliegue `dpl_BLJP9ZppHSFzVPPspdTa8yn6VSVj`. Publicación exclusivamente de archivos estáticos de la compilación verificada. Recuperación: despliegue anterior `dpl_FoqVh69NXTpk9BTdTii2mWndJCKB` conservado en Vercel y fuente anterior en Git.

Las mismas 76 comprobaciones se repitieron sobre el dominio público y pasaron sin errores ni intentos de mutación. El índice, JavaScript y CSS servidos coinciden con la compilación local; `/deck` y `/android/display` continúan respondiendo.

## Accesos, productos y panel

El usuario pidió completar el mismo diseño en los accesos Crear mi deck/Abrir panel/Configurar mis luces, fichas Mini/Display/Matrix y panel autenticado. `WebSurfaceTheme` aplica variables claras al documento únicamente en la ruta web `/`, para que los portales Radix hereden fondo cálido, texto oscuro y botones naranjas. Limpia el atributo al salir de la ruta; no afecta Deck, editor completo, Display ni Android. El panel conserva las acciones y componentes existentes dentro de tarjetas claras adaptables al celular.

Compilación y ESLint correctos; 384 pruebas correctas. Se comprobaron 11 recorridos de diálogos en escritorio y móvil. Con una cuenta técnica en backend local, panel y editor de estados son legibles y no desbordan; navegar al Deck/editor/Display restaura el tema oscuro y volver al panel recupera la paleta clara. No se iniciaron sesiones ni modificaron datos de usuarios o luces en producción.

Publicado el 19 de octubre de 2026 en el mismo dominio mediante despliegue `dpl_BSH2h7ZRFXzcpQa6gpKvryDbpMJL`; índice, JavaScript y CSS públicos coinciden con la compilación comprobada. Recuperación anterior: `dpl_BLJP9ZppHSFzVPPspdTa8yn6VSVj`. No requiere backend ni APK nuevos.
