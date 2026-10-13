# VISO Deck 1.9.0 — fondos y páginas completas

## Cambios

Se conserva el catálogo compartido de 1.8.0: las páginas se agregan, ordenan, duplican, eliminan y personalizan desde el editor de la misma cuenta. No se agregan páginas automáticamente ni se vuelve a crear ninguna página borrada.

- Corrección de la vista previa del fondo de un estado: al eliminarlo se actualiza inmediatamente aunque el formulario conserve el objeto anterior. Un error al borrar mantiene la imagen y muestra el fallo. El editor de teclas también permite quitar el fondo del estado vinculado, diferenciándolo del archivo de la tecla. Quitar el archivo de la tecla conserva nombre, icono, color y contenido; se aplica al guardar.
- Clima: ciudad elegida mediante búsqueda, Celsius/Fahrenheit, condiciones actuales, sensación térmica, humedad, viento y dirección, presión, visibilidad, amanecer/atardecer, UV, próximas 24 horas y pronóstico de 7 días. Fuente Open-Meteo consultada mediante una acción autenticada del servidor, con coordenadas y unidades validadas; actualiza cada 10 minutos con la página activa.
- Vúmetro: micrófono o música, barras con picos, barras reflejadas, radial, onda y LED, color y sensibilidad. Solo se captura audio tras pulsar Activar audio y aceptar los permisos. No se graba ni se transmite audio al servidor. La captura se detiene al cambiar de página, salir de la app o abrir ajustes. Web utiliza Web Audio y permisos de micrófono/compartir audio; Android usa AudioRecord y el efecto oficial Visualizer del mezclador. La captura musical puede estar restringida por Android o por contenidos protegidos: muestra un error y propone micrófono, sin niveles simulados. dBFS es relativo al audio digital, no una medición acústica calibrada.
- Deportes: competiciones seleccionables, fecha, agenda, marcadores, resultados y favorito; incluye Argentina, Libertadores, ligas europeas, NBA y Fórmula 1. ESPN sirve marcadores con actualización cada minuto; Fórmula 1 usa Jolpica para calendario anual, campeonato de pilotos y último GP (cada cinco minutos), sin afirmar telemetría en vivo.

Los ajustes nuevos están ligados al propietario de cada página y se comparten entre web y APK. Se validan las coordenadas, opciones, color, límites y proveedores. Se mantienen las funciones existentes de estados, Google Home, llamadas/calendario, mantener pantalla encendida y Stream Deck. Se preservan las APK anteriores de recuperación.

## Evidencia

- 365 pruebas pasaron en 36 archivos; después del último endurecimiento de proveedores y fechas pasaron las 4 pruebas pertinentes.
- Typecheck frontend y backend pasaron. Compilación Android final con SDK Home 1.10.1: BUILD SUCCESSFUL.
- Dos navegadores y backend Convex local real: cambios de tipo, preferencias de clima y favoritos deportivos compartidos; eliminación reflejada en el Deck. Motor Web Audio comprobado con el micrófono de prueba de Chromium; abrir ajustes detiene la captura. Los datos externos no se simulan en el producto.
- Lecturas reales del servicio deportivo ya publicado mediante una cuenta técnica aislada: Argentina devolvió 1 evento, NBA 5 y Premier 1. No se tocaron cuentas ni luces del usuario. Los contratos de resultados y F1 tienen pruebas con fixtures explícitas. Tras la autorización se consultaron las funciones nuevas del servidor real: Open-Meteo devolvió 7 días/168 horas; ESPN respondió para Argentina, Libertadores, NBA y Premier; Jolpica devolvió 23 carreras, 23 pilotos en campeonato y 22 resultados del último GP. Clima y calendario F1 se renderizaron en la web de revisión conectada al servidor real.
- SDK oficial Home, adaptador existente y plugin nativo de audio comprobados dentro de los DEX de la APK. Se conserva paquete com.viso.deck y firma SHA-1 F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6.
- La captura física de micrófono y mezclador musical de Android sigue pendiente en el teléfono; no se afirma que todos los reproductores permitan esa fuente. Google Home se conserva, pero esta APK nueva no se probó con luces físicas en el entorno.

Versión 1.9.0, código 15. APK: downloads/VISO-Deck-1.9.0-debug.apk. Tamaño 19972871 bytes. SHA256: 72b9deca65bcead66c30e2f41642ea6e4d5fab3900965d3c0cba8235bf4e8c3a.

## Publicación

El usuario autorizó actualizar servidor y web. El servidor compartido vivid-nightingale-785 está actualizado. La web de revisión verificada es https://viso-deck-android-5pg1ws06y-manuelhaguilar8-4981s-projects.vercel.app; se comprobó con dos sesiones autenticadas, pronóstico real, calendario F1 real, configuración compartida y eliminación de página. Se corrigió además el selector de tipo para deshabilitarlo mientras se crea o guarda una página: evita que una elección rápida sea ignorada por la protección existente contra operaciones simultáneas. Producción publicada y verificada en https://viso-deck-android.vercel.app: dos sesiones autenticadas comprobaron creación/cambio/eliminación de páginas, ajustes compartidos, renderizado del pronóstico real de Open-Meteo y calendario F1 real. Descarga final inmutable: https://raw.githubusercontent.com/elkauce/visoapparg/6d3410a/downloads/VISO-Deck-1.9.0-debug.apk (HTTP 200 y SHA256 comprobados).

Build reproducible:

```bash
source /workspace/.visoapparg-setup/android-tools/env.sh
VISO_GOOGLE_HOME_SDK_DIR=/workspace/status-mini-/app/libs node scripts/build-android.mjs
```
