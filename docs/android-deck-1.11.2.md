# VISO Deck 1.11.2 — vúmetros

Medidor LED y doble barra LED cambian a columnas verticales en retrato y barras horizontales en paisaje. Barras con picos y reflejadas ahora pintan el color configurado después del fondo: antes el color negro quedaba activo, ocultando las barras. Usan amplitud real con escala logarítmica y ganancia existentes. Picos decaen en función del tiempo. Radial RGB por banda y onda con gradiente RGB; onda limitada al área visible. Se elimina el renderizado antiguo duplicado. Historial deportivo 1.11.1 incluido; ninguna nueva integración Spotify o luces musicales.

Validación: TypeScript, seis pruebas de renderizador, canvas real en Chromium con entrada de prueba explícita para los seis estilos en 390x844 y 1280x600, comprobación de píxeles visibles. APK compilada con SDK Google Home oficial y firma existente. Prueba física de audio pendiente; no se afirma que el bloqueo Play Protect S26 esté corregido.

VersionCode 19, versión 1.11.2, com.viso.deck. SHA256 APK: 8a1ded4d154a776b7f0a2ca070300f6139a5c132dd7bf13f386e9f832a28c009. Firma SHA1 F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6.

Web de producción continúa 1.11.0; publicación 1.11.2 pendiente de autorización. Backend no requiere modificación.

Consulta de capacidades: Google Home controla color mediante comandos, no garantiza una transmisión de audio/colores a frecuencia alta ni sincronismo musical. Necesita evaluar latencias y capacidades físicas. Spotify MediaSession actual entrega metadatos y controles, no búsqueda ni videos. Búsqueda requiere integración OAuth/Web API y requisitos vigentes del proyecto Spotify. API pública no ofrece incrustación de videos musicales/Canvas; abrir Spotify es una alternativa externa, no reproducción de video dentro de VISO.
