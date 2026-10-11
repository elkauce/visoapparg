# Home responsive de VISO

El home público conserva el acceso por correo y contraseña. Los botones de estado son una demo local: no envían cambios a la cuenta ni a sus luces. El carrusel manual Mini / Display / Matrix mantiene su producto al cambiar el color de la demo. Las tarjetas abren información del producto; no existe una tienda configurada. «Configurar mis luces» abre el acceso a la cuenta existente.

El panel autenticado, `/deck`, los displays, las rutas Android, el backend, las credenciales y las integraciones existentes no se modifican. Google Home y Alexa se presentan para luces compatibles; estas verificaciones del home no certifican su funcionamiento físico.

## Validación

Ejecutar `pnpm build`, `pnpm test` y `pnpm lint`. Iniciar `pnpm dev --host 0.0.0.0 --port 5173` con las variables públicas de Convex correspondientes al sitio que se está revisando. No intercambiar los backends de las distintas instalaciones.

Con Playwright disponible, ejecutar:

```sh
node scripts/web-validation/home-responsive.mjs
```

Si Playwright está instalado fuera del proyecto, definir `VISO_PLAYWRIGHT_MODULE` con el módulo instalado. `VISO_CHROMIUM_EXECUTABLE` permite elegir Chromium; por defecto usa `/usr/bin/chromium`. `VISO_REVIEW_URL` cambia la URL revisada; por defecto usa el servidor local. `VISO_SCREENSHOT_DIR` cambia la carpeta de capturas; por defecto usa `/tmp/viso-home-review`.

La prueba verifica 62 condiciones en anchos de 1440, 768, 390 y 320 px: ausencia de desbordamiento horizontal, acceso por correo, detalles del Display, selección de los seis estados, color del carrusel, navegación por flechas y puntos, gesto táctil real y conservación del estado al deslizar. No crea usuarios ni modifica datos de cuentas.

La versión previa del home se conserva en el commit `af69800c1cfa9d284a893205ee1cf015b7678f2a`. Los cambios se mantienen en `fix/viso-deck-reference-layout`, sin modificar `main`. Revisar la vista previa y solicitar autorización antes de publicar en producción, conforme a la instrucción del usuario.
