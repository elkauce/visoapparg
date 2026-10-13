# VISO Deck 1.11.4 — movimiento visible en clima

Versión preparada, no publicada. Nubes más contrastadas, desplazamiento ±85 px en 7 segundos; ondas de agua curvas, más contrastadas y desplazamiento ±40 px; sol con rayos giratorios y pulsación; lluvia y nieve más visibles. Datos de clima existentes sin cambio. Movimiento reducido del sistema y pausa de páginas inactivas conservados.

TypeScript y compilación APK pasaron. Verificación real en Chromium: matriz de transformación de nubes cambia entre cuadros separados por un segundo y se pausa al desactivar la escena. Pruebas existentes de presentación meteorológica pasaron. Falta prueba física en teléfonos y confirmación perceptual del usuario.

APK versionCode 21, com.viso.deck, versión 1.11.4. Firma SHA1 conservada F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6. SHA256 38a1cb9c1d4962b5af4b55eeceb56d73f52b21573f4ecf863f09f36b777f47d7.

## Contenido deportivo compartido

La competición seleccionada, fecha, vista y filtro eran estado React local y no se persistían. Ahora forman parte de screenSettings por página en la cuenta. Cambios se guardan mediante configureScreen con parches parciales, validación de competiciones/fechas/vistas/filtros y control de propiedad ya existente. Guardar preferencias del diálogo no pisa la selección hecha desde los controles de contenido. Equipos y competiciones configuradas se conservan. El gesto de pasar a otra página sigue siendo local a cada Deck; este cambio comparte el contenido de la misma página deportiva, no obliga a todos los dispositivos a cambiar de pantalla.

Validación final: 376 pruebas en 39 archivos, TypeScript frontend/backend y APK compilada. Prueba real de dos sesiones de navegador aisladas (escritorio y tamaño móvil) mostró cambios de competición/fecha/vista en ambas direcciones. Test servidor verifica lectura desde otra sesión, conservar equipos, rechazo de cuenta ajena y fecha imposible. Prueba física Android todavía pendiente. Web/backend publicados siguen 1.11.3: la nueva sincronización requiere autorización y actualización del servidor, web y APK.
