# Identidad visual y áreas seguras de Android

El verde oficial ya definido por VISO es `--primary: oklch(0.88 0.22 130)`; las tarjetas Deck y Display del inicio usan ese token y su color de texto `--primary-foreground`, sin modificar el diseño de las teclas.

El propietario entregó `logos.zip` con los dos originales el 9 de octubre de 2026. Se incorporaron sin volver a dibujarlos, recortar, convertir, quitar fondos ni alterar su transparencia o colores:

| Uso | Archivo original | Recurso incorporado | SHA-256 |
| --- | --- | --- | --- |
| Logo completo | `Logo Viso con Icono Colorido (1).png` · RGBA · 1900 × 828 | `public/brand/viso-logo.png` | `706d409be787e977854fbd51e806824d23c44d10ad3c5df319b96555f701dfc1` |
| Icono web y Android | `Ícono 3D de botones coloridos (1).png` · RGBA · 1254 × 1254 | `public/brand/viso-icon.png` y `android/app/src/main/res/drawable-nodpi/viso_icon.png` | `eceeec8d200d10a99fb1a64cdba3bb90cbed6503ad5849a66f8dea8faa6d93a0` |

`VisoBrand` utiliza `/brand/viso-logo.png` por defecto, con la misma altura del encabezado y `object-contain` para mantener la proporción. Sigue admitiendo `VITE_VISO_LOGO_URL` o la prop `logoUrl`; una URL personalizada inválida vuelve al original incorporado. Los dos PNG se empaquetan en la APK y están disponibles sin conexión. El favicon utiliza el icono oficial original.

El launcher de Android mantiene `@mipmap/ic_launcher` y `@mipmap/ic_launcher_round`, sin cambiar el paquete ni la firma de la aplicación. Android 8 o superior aplica su máscara adaptativa a una única copia del icono original, con margen XML de 18 dp y fondo negro; el sistema realiza el escalado sin generar versiones del archivo original. Android 7 conserva un recurso bitmap XML compatible. No se solicita ningún permiso adicional ni se cambia la pantalla de inicio o el diseño de las teclas.

`MainActivity.applyWebViewInsets` publica `--viso-safe-top/right/bottom/left` desde los insets reales de Android, convertidos a unidades CSS. Las pantallas Android y los diálogos respetan esos márgenes. El teclado ajusta solamente el viewport nativo; no se suma una segunda vez al margen inferior CSS. El modo inmersivo conserva el recorte de cámara pero permite ocultar las barras del sistema. La configuración de Capacitor desactiva su segundo tratamiento de insets para evitar consumirlos o duplicar márgenes. En navegador normal se conservan los valores `env(safe-area-inset-*)`.
