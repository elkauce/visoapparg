# VISO Deck 1.11.4 — movimiento visible en clima

Versión preparada, no publicada. Nubes más contrastadas, desplazamiento ±85 px en 7 segundos; ondas de agua curvas, más contrastadas y desplazamiento ±40 px; sol con rayos giratorios y pulsación; lluvia y nieve más visibles. Datos de clima existentes sin cambio. Movimiento reducido del sistema y pausa de páginas inactivas conservados.

TypeScript y compilación APK pasaron. Verificación real en Chromium: matriz de transformación de nubes cambia entre cuadros separados por un segundo y se pausa al desactivar la escena. Pruebas existentes de presentación meteorológica pasaron. Falta prueba física en teléfonos y confirmación perceptual del usuario.

APK versionCode 21, com.viso.deck, versión 1.11.4. Firma SHA1 conservada F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6. SHA256 dc270883d416761046137ad8a8e1c1104f5d2c4b1a84d589318c6f98e61c70bd.

Durante el trabajo el usuario informó que Deportes no muestra la misma página entre web y APK; diagnóstico pendiente para distinguir página ausente del catálogo frente a selección de página local. No se implementó sincronización de selección ni cambios de datos deportivos basados en suposiciones. Web de producción sigue 1.11.3.
