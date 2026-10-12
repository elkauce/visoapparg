# Descarga personal de Elgato: compilación y comprobación

La web de revisión anterior rechazaba la descarga porque la variable del entorno `VITE_CONVEX_SITE_URL` apuntaba al servidor local de pruebas. Vite prioriza variables del proceso sobre `.env.local`; comprobar solamente el archivo no garantiza el endpoint del bundle. El error se reprodujo en Chromium con una cuenta técnica aislada, desde el botón real.

Para esta instalación VISO, compilar la web conservando sus opciones actuales y usando explícitamente los endpoints compartidos:

```sh
VITE_CONVEX_URL=https://vivid-nightingale-785.convex.cloud \
VITE_CONVEX_SITE_URL=https://vivid-nightingale-785.convex.site \
VITE_ANDROID_DECK_PRESETS=false \
VITE_ANDROID_DECK_EXTENSIONS=false \
VITE_ANDROID_PREVIEW=false pnpm build
```

Estos flags conservan la web existente. Android utiliza sus pantallas nativas por `isAndroidNative()`; la APK no fue cambiada. No cambiar a otro backend ni copiar credenciales al artefacto público.

La web incorpora acceso Elgato dentro del Deck y bloquea pulsaciones repetidas mientras prepara el instalador. El instalador personal se genera localmente en el navegador; contiene las URLs de los estados propios y acceso revocable a la cuenta. No compartirlo. El paquete público sigue sin account.json.

Comprobar más que HTTP 200: iniciar sesión con una cuenta técnica, abrir Deck → Elgato → Descargar mi plugin configurado, esperar el evento real de descarga y leer el ZIP. Verificar account.json, las URLs HTTPS de la instalación y una acción personalizada por ID real. No imprimir tokens ni guardar instaladores personales dentro del repositorio. Elgato físico requiere una prueba independiente.

Validación de la corrección: build TypeScript/Vite y 14 pruebas del Deck y personalización. La publicación en producción queda sujeta a la autorización previa del usuario; el despliegue de revisión conserva el backend existente.

La prueba real también detectó incompatibilidad del lector ZIP del navegador con los campos ZIP64 por entrada del archivo producido por la CLI. `scripts/export-elgato-template.py` convierte la plantilla a ZIP32, verifica CRCs y compara todos los archivos antes/después sin modificar sus bytes. Rechaza paquetes personalizados para impedir publicarlos por error. Ejecutar después de empaquetar con la CLI y antes del build web. La personalización y sus pruebas importan explícitamente `fflate/browser`, evitando comprobar accidentalmente otra implementación Node.

```sh
python scripts/export-elgato-template.py /ruta/al/com.viso.deck.streamDeckPlugin
```
