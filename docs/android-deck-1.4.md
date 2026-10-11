# VISO Deck Android 1.4: navegación manual

Continúa la versión 1.3 en `fix/viso-deck-reference-layout`. Se conserva el diseño, las tres pantallas, los seis estados, los controles multimedia, las fotografías y preferencias de Standby, la sincronización y los ajustes existentes. No se modifica `main`, STATUS, la web alojada ni el backend.

El número pequeño de la esquina superior izquierda muestra únicamente **01**, **02** o **03**. Es un indicador: no abre un menú y no muestra nombres de páginas. La estrella superior derecha sigue abriendo Ajustes.

Las páginas se desplazan con el dedo, también cuando el gesto comienza sobre un botón. Deslizar **a la derecha** avanza **01 → 02 → 03 → 01**; deslizar **a la izquierda** retrocede **01 → 03 → 02 → 01**. No hay avance automático. Un toque corto conserva la acción del botón; un arrastre no cambia el estado ni dispara un control musical. Las otras páginas permanecen montadas para conservar su estado, pero no aceptan interacción mientras están fuera del área visible.

Una traza del navegador detectó un desplazamiento nativo que consumía el toque siguiente después del arrastre. Se cancela `touchmove` únicamente cuando el deslizamiento horizontal ya fue reconocido. Los botones conservan sus clics nativos; los controles y diálogos ajenos al carrusel conservan sus gestos. La comparación verificó exactamente una acción por toque, sin agregar una espera artificial.

Los diálogos de Ajustes y Personalizar Standby conservan sus controles propios. Los deslizamientos y las flechas del teclado dentro de esos diálogos no cambian la página detrás del diálogo.

La APK de prueba utiliza `com.viso.deck`, versionCode **5**, versionName **1.4.0** y el mismo certificado de las versiones 1.2 y 1.3:

`F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`

Se instala sobre la versión anterior. La [APK 1.3 de recuperación](https://raw.githubusercontent.com/elkauce/visoapparg/1669d762658947a3ad3332d8b5d3385fa826b149/downloads/VISO-Deck-1.3-debug.apk) se conserva. No es una actualización de `com.statusmini.app`.

## Google Home

La integración y el SDK oficial 1.10.1 se conservan. Esta actualización corrige la navegación; no acredita el consentimiento de Google ni el control de luces físicas. El propietario debe verificar el cliente Android para `com.viso.deck` y el certificado anterior dentro de **STATUS**, la audiencia de prueba y la autorización de la casa. El cliente de `com.statusmini.app` se conserva. No se crea otro proyecto ni se modifican dispositivos.

## Validación

TypeScript, ESLint, formato y las **299 pruebas web** aprobaron. La compilación Android final incluye el carrusel y el SDK real; se verificaron paquete, versión y firma v2. El checksum acompaña a la APK en `downloads/VISO-Deck-1.4-debug.apk.sha256`.

Las pruebas táctiles de navegador usan los componentes reales de la aplicación con fixtures externos explícitos, sin escribir en el backend alojado. Esas pruebas no sustituyen una prueba física de Android, Spotify o Google Home.

APK final: **16180648 bytes**, SHA-256 `ec42b3fd86c14e9f12cd1d84e04ef6b256f62b43472734a0ddc228ab89085fba`. [Metadatos](android-deck-1.4-evidence/apk-metadata.json) y [diagnóstico táctil](android-deck-1.4-evidence/input-pipeline-diagnosis.json).

Validación final: **589 comprobaciones** y **18 vistas** en 360×800, 800×360, 320×568, 568×320, 720×1280 y 1280×720, con cero fallos y cero errores de React. Se prueban los dos sentidos desde cada botón, los toques, el arrastre visible, los ciclos, la cancelación, la rotación, la activación accesible y los diálogos. [Informe](android-deck-1.4-evidence/browser-report.json), [Estados horizontal](android-deck-1.4-evidence/800x360-states.png), [Estados vertical](android-deck-1.4-evidence/360x800-states.png) y [arrastre en curso](android-deck-1.4-evidence/360x800-drag-halfway.png).
