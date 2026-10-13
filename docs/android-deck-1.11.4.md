# VISO Deck 1.11.4 — movimiento visible en clima

Versión preparada, no publicada. Nubes más contrastadas, desplazamiento ±85 px en 7 segundos; ondas de agua curvas, más contrastadas y desplazamiento ±40 px; sol con rayos giratorios y pulsación; lluvia y nieve más visibles. Datos de clima existentes sin cambio. Movimiento reducido del sistema y pausa de páginas inactivas conservados.

TypeScript y compilación APK pasaron. Verificación real en Chromium: matriz de transformación de nubes cambia entre cuadros separados por un segundo y se pausa al desactivar la escena. Pruebas existentes de presentación meteorológica pasaron. Falta prueba física en teléfonos y confirmación perceptual del usuario.

APK versionCode 21, com.viso.deck, versión 1.11.4. Firma SHA1 conservada F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6. SHA256 e98d1a16ab615c41786eff8f3489e7a68efdb8599d0b5ef05a557a3edaf75308.

## Contenido deportivo compartido

La competición seleccionada, fecha, vista y filtro eran estado React local y no se persistían. Ahora forman parte de screenSettings por página en la cuenta. Cambios se guardan mediante configureScreen con parches parciales, validación de competiciones/fechas/vistas/filtros y control de propiedad ya existente. Guardar preferencias del diálogo no pisa la selección hecha desde los controles de contenido. Equipos y competiciones configuradas se conservan. El gesto de pasar a otra página sigue siendo local a cada Deck; este cambio comparte el contenido de la misma página deportiva, no obliga a todos los dispositivos a cambiar de pantalla.

Validación final: 376 pruebas en 39 archivos, TypeScript frontend/backend y APK compilada. Prueba real de dos sesiones de navegador aisladas (escritorio y tamaño móvil) mostró cambios de competición/fecha/vista en ambas direcciones. Test servidor verifica lectura desde otra sesión, conservar equipos, rechazo de cuenta ajena y fecha imposible. Prueba física Android todavía pendiente. Web/backend publicados siguen 1.11.3: la nueva sincronización requiere autorización y actualización del servidor, web y APK.

## Diseño deportivo final

Referencia del usuario aplicada: fondo negro/carbón, tarjetas gris oscuro con degradado, acentos rojos, favoritos amarillos, cabecera compacta, barra de fecha, marcador destacado, listado compacto y navegación inferior. No agrega marcos de teléfono ni barra de sistema simulada. Adaptación vertical en escritorio y móvil; panel central hasta 520 px.

Datos: conserva ESPN y Jolpica reales, añade búsqueda de equipos/partidos dentro de la competición/fecha actual, favoritos múltiples guardados por cuenta, historial/tabla/marcadores y estadísticas. Favoritos y selección sincronizan por parches del servidor. Nueva acción autenticada matchLineups lee roster del summary oficial, valida liga e identificador numérico, limita tamaño y no inventa jugadores. Vista de campo solo aparece si la fuente publica once titulares con posiciones reconocibles: agrupación por posición, no coordenadas tácticas ni seguimiento en vivo. Si falta cobertura muestra mensaje explícito. Alineaciones contractualmente probadas con fixtures; verificación del endpoint nuevo en cloud pendiente de autorización de publicación. No se afirma cobertura universal.

Verificación final: 377 pruebas en 39 archivos; TypeScript frontend/backend y APK compilada. Dos sesiones de navegador verifican selección compartida. Vista aislada y controles de búsqueda/favoritos probados en Chromium con respuesta histórica real de ESPN registrada (liga argentina, 2025-11-09); esa captura no es una conexión en vivo ni prueba Android. Descarga de imágenes del proveedor bloqueada en entorno de pruebas: las capturas muestran iniciales de respaldo. Prueba física del teléfono pendiente. Evidencias en android-deck-1.11.4-evidence/.

Servidor y web de producción todavía 1.11.3. Publicación requiere autorización explícita. SDK, paquete, firma y funciones existentes conservados.
