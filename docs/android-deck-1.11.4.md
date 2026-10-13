# VISO Deck 1.11.4 — publicación verificada

Publicada con autorización explícita del usuario el 13 de octubre de 2026 en https://viso-deck-android.vercel.app. Backend compartido vivid-nightingale-785 actualizado. main no modificada; APKs anteriores conservadas.

## Resultado

Deportes sigue las referencias ampliadas: tarjeta con hendidura superior y recorte inferior central, selector de tres días, escudos del proveedor e iniciales de respaldo, filas compactas con celdas laterales para tiempo/estado real y navegación inferior de cinco acciones. Marca VISO conservada; no simula barra de teléfono ni funciones de noticias/video sin fuente.

Contenido deportivo compartido: competición, fecha, vista, filtro y favoritos múltiples persistidos por página en la cuenta. Parches parciales, validación y propiedad; guardar apariencia no pisa la selección. El cambio de página con gestos sigue local a cada Deck. La APK debe actualizarse para utilizar la nueva selección compartida.

Marcadores, historial, tablas y estadísticas provienen de ESPN; F1 conserva Jolpica y se actualiza desde su consulta al refrescar. Búsqueda filtra equipos/partidos de competición y fecha actuales. Detalle incluye Información, Alineaciones, Tabla y Estadísticas. Información muestra posición actual y porcentaje de victorias calculado de PJ/G publicados, con — cuando faltan; no lo presenta como forma histórica ni posición live de aquel partido.

Alineaciones leen rosters del summary oficial autenticado con liga e identificador numérico validados. Campo solo con once titulares y posiciones reconocibles; agrupación por posición, sin inventar coordenadas tácticas ni seguimiento en vivo. Lista fuente conservada. Posiciones Left Back/Right Back reconocidas como defensores. Ausencia de cobertura informada.

Clima: nubes más contrastadas con desplazamiento ±85 px, ondas curvas de agua ±40 px, rayos solares giratorios y pulsación, lluvia/nieve más visibles. Datos existentes conservados. Pausa cuando página inactiva y respeto a movimiento reducido del sistema.

## Evidencia

- 377 pruebas en 39 archivos; TypeScript frontend/backend y compilación APK/web correctas.
- Chromium: movimiento de nubes entre cuadros y pausa en página inactiva.
- Dos sesiones de navegador en revisión y producción: competición/fecha/vista sincronizadas en ambas direcciones. Campo de alineación renderizado con fuente real.
- Proveedor cloud autenticado: liga argentina 2025-11-09 devuelve cinco partidos, dos plantillas del partido probado y 46 jugadores entre titulares/suplentes. NBA siete partidos; sin plantillas publicadas en este endpoint.
- Archivos web en producción idénticos a compilación verificada; descarga APK con hash coincidente.
- Cuenta técnica aislada; no se modificaron cuentas ni luces del usuario. Prueba física Android pendiente; no se afirma resuelto Play Protect S26.

Capturas en android-deck-1.11.4-evidence/: sports-portrait/desktop usan respuesta histórica real registrada para revisión visual (no conexión en vivo); iniciales por bloqueo de imágenes en entorno de pruebas. lineups-online corresponde a prueba real del proveedor después de publicar backend.

## APK

com.viso.deck, versión 1.11.4, versionCode 21, Google Home SDK oficial 1.10.1. Firma SHA1 conservada F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6.

SHA256: 48bf6828b74f96efe5f99f6a050b0cad6ac437f997ef3b8e696359b82c8940d3.

Descarga: https://raw.githubusercontent.com/elkauce/visoapparg/c1a71cc/downloads/VISO-Deck-1.11.4-debug.apk
