# VISO Deck 1.11.3 — marca en Display, clima animado y barras RGB

Preparada, no publicada. Requiere autorización para actualizar servidor y web. Conserva APKs anteriores.

Barras reflejadas usan RGB por banda. Clima mantiene datos y diseño: nubes derivan, agua ondula, sol/luna cambia brillo y personaje tiene movimiento suave. Animaciones se pausan al ocultar página y respetan movimiento reducido; lluvia/nieve existentes se conservan.

Nueva configuración Imagen o video del Display en panel Abrir display y sección Android Display. Sube imágenes o MP4/WebM hasta 60 MB mediante endpoint autenticado existente. Fondo general por cuenta, independiente de estados/teclas; opción ver completo sin recortar o cubrir, y mostrar estado o solo marca. Quitar fondo restaura medios de estado previos. El video general queda fuera de la transición de estado para no reiniciarlo en cada cambio. Volumen existente conservado y reproducción silenciosa por defecto.

Servidor valida propiedad del archivo mediante registro deckMedia, ignora tipo enviado por cliente y usa tipo validado. Configuración guardada en users.displayBackground y lectura pública expone URL/tipo/ajuste/mostrarEstado sin identificador privado del archivo. No elimina archivos compartidos por otras teclas. No cambia el estado ni envío a luces.

Validación: 375 pruebas en 39 archivos, TypeScript frontend/backend, APK compilada con SDK oficial Google Home 1.10.1. Pruebas de permisos/propiedad de archivos, imagen/video, cambio y eliminación sin cambiar estado activo. Navegador con cuenta local técnica: subidas reales, segunda ventana recibe imagen y video, modo solo marca, video reproducible en bucle y quitar restaura estado. Clima verificado animación de nubes activa/pausada. Audio y teléfonos físicos no probados.

APK com.viso.deck, versión 1.11.3, versionCode 20. Firma conservada F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6. SHA256 5216affba85ae325ca719bb6a0f28f3b2919ef6bb2b9c09096872342e3ba62b1. Nuevas funciones Display requieren servidor actualizado tras autorización. Bloqueo Play Protect S26 no se considera resuelto.

## Incidente de preparación

Un comando dev de verificación tomó por error la selección de deployment cloud de .env.local y actualizó funciones/schema antes de autorización. Se informó al usuario; no modificó registros ni archivos de usuarios. Revertido a código de servidor anterior mediante selección explícita vivid-nightingale-785, con confirmación functions ready. Primera reversión falló typecheck por test nuevo referenciando funciones ausentes; segunda reversión con test fuera del árbol de esa versión fue exitosa. Nueva configuración probada únicamente con backend aislado 127.0.0.1:3210 y claves locales en archivo privado externo. Web publicada no se cambió.
