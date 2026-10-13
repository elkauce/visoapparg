# VISO Deck 1.10.0 — diseño de medidores y Deportes

Se continúa sobre fix/viso-deck-reference-layout, sin modificar main. Versión 1.9.0 de recuperación conservada. No se publicó esta nueva versión en producción.

## Diseño

Ocho estilos añadidos inspirados en las cinco referencias del usuario: aguja ámbar, aguja azul, doble aguja blanca, dorada y verde, doble LED, espectro multicolor y espectro LED multicolor. Se conservan los cinco estilos existentes y sus ajustes; el color libre sigue aplicándose a los estilos clásicos. Las paletas de los nuevos estilos corresponden a las referencias. Todos se seleccionan dentro de la misma página de Vúmetro.

Canvas ocupa el viewport completo salvo los márgenes de seguridad del dispositivo. Sin barra de título ni pie permanente; activación de audio y configuración flotan sobre el medidor. Se conservan el pequeño número de página, la estrella, los gestos manuales y las funciones de pantalla encendida. Los pares muestran NIVEL (RMS) y PICO, no canales L/R ficticios: las fuentes actuales del mezclador/micrófono pueden ser mono. Escalas digitales dBFS, sin afirmar calibración acústica ni 0 VU analógico calibrado.

Los espectros emplean bandas logarítmicas calculadas de audio real: FFT de Web Audio, FFT del efecto Visualizer Android, y análisis de frecuencias del PCM del micrófono. Las etiquetas usan frecuencias reales de los bins, limitadas por la frecuencia de muestreo. RMS y pico se calculan del bloque completo, evitando errores por submuestreo de la onda visual. Silencio produce nivel cero, no animación inventada.

Deportes adopta una composición inspirada en Apple Sports: superficie clara, filtros segmentados, competiciones desplazables, tarjetas de partidos, escudos suministrados por la fuente (iniciales si no existen o no cargan), marcadores grandes, navegación de fechas, favoritos y detalle desplegable. Se conservan ESPN, Fórmula 1/Jolpica y los ajustes compartidos. No se recibió una captura específica de Apple Sports, así que no se afirma una réplica exacta de una pantalla concreta.

## Evidencia

367 pruebas pasaron en 37 archivos. Typechecks frontend/backend y compilación APK pasaron. Backend local Convex real y dos navegadores verificaron los ocho estilos nuevos, preferencias compartidas, tamaño del canvas mayor de 830×380 en viewport 844×390, cambio a vertical 390×844, captura Web Audio con dispositivo de prueba de Chromium, parada de audio y eliminación de página. Capturas de revisión en android-deck-1.10-evidence. Deportes en capturas locales puede mostrar carga/error por la restricción de acceso a proveedores del entorno; esas capturas no sustituyen pruebas de los marcadores online. Los servicios reales de producción 1.9 fueron comprobados en la entrega anterior.

APK 1.10.0, código 16, paquete com.viso.deck. SHA256 1119c3f0974f69c85249e7128f9450bc49e3a152c84f194847ede2a2b9ef2806, 19981401 bytes. Firma SHA-1 F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6. SDK Home oficial, adaptador existente y plugin de audio verificados en DEX. Sigue pendiente la prueba física en Android de captura del mezclador/micrófono y de Google Home en esta APK; no se cambiaron las integraciones de llamadas, calendario ni Google Home.

Los estilos nuevos requieren actualizar la validación del backend antes de usar esta APK con la cuenta real. El usuario pidió no publicar en producción sin autorización: servidor y web quedan preparados para pedir autorización sobre esta versión concreta.
