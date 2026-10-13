# VISO Deck 1.11.0 — versión preparada

Publicada con autorización explícita del usuario el 13 de octubre de 2026. Servidor vivid-nightingale-785 actualizado; web https://viso-deck-android.vercel.app promovida desde la versión de revisión verificada. Se conserva 1.10.0 como recuperación.

## Cambios

Deck ocupa el área disponible sin número, estrella ni controles superpuestos. Doble clic/doble toque abre ajustes; las teclas siguen funcionando. Los controles de audio y clima están dentro de ajustes. Deportes tiene diseño vertical, cabecera violeta/naranja y tarjetas claras, con competiciones de Argentina y Latinoamérica; no agrega login, pagos ni datos inventados.

Vúmetro: escala uniforme para agujas, dial y pivote; marco pintado a dimensiones reales; respuesta independiente de la frecuencia de cuadros. Ganancia editable de −30 a +30 dB. Audio Android utiliza Visualizer AS_PLAYED y micrófono VOICE_RECOGNITION para reducir normalización automática. Permisos existentes conservados.

Nuevas consultas autenticadas de tablas y estadísticas ESPN con rutas fijas y validación de identificadores. F1 existente conservada. Orientación Android solicita vertical para Deportes y automática al salir. El navegador presenta una columna vertical sin prometer bloquear la orientación del sistema.

## Verificación

- 372 pruebas pasaron en 38 archivos; comprobación TypeScript frontend/backend y compilación web completadas.
- APK compilada con Google Home SDK oficial 1.10.1, paquete com.viso.deck, versionCode 17.
- Prueba de navegador con cuenta técnica local: controles ocultos, apertura por doble clic, audio continúa al cerrar ajustes y capturas horizontal/vertical. Micrófono de prueba de Chromium, no prueba física.
- Tablas/estadísticas nuevas verificadas con fixtures y consultas autenticadas reales: Argentina 30 equipos, Brasil 20, NBA 30; estadísticas de dos equipos en cada competición.
- Firma SHA-1 conservada: F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6.
- SHA-256 APK: 5286c455686b792f578a6cf4e0fa87dd09496f528021c18a440169b503c4779a.

Prueba física pendiente: sensibilidad del audio del teléfono, captura de música permitida por cada aplicación y orientación vertical. Google Home no fue probado físicamente en esta versión. El backend ya está actualizado para las nuevas consultas y rango de ganancia.

Evidencias: android-deck-1.11-evidence/. La captura de Deportes local documenta diseño, no valida resultados deportivos online.

## Publicación verificada

Prueba de navegador pasada en revisión y producción con cuenta técnica aislada: editor, nuevas páginas, doble clic, audio activo sin controles visibles y configuración deportiva. No se modificaron cuentas ni luces del usuario. Descarga pública comprobada; SHA-256 idéntico al archivo compilado.

APK: https://raw.githubusercontent.com/elkauce/visoapparg/a5001e5/downloads/VISO-Deck-1.11.0-debug.apk
