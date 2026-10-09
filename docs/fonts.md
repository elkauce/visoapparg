# Fuentes originales incluidas en la APK

La versión del repositorio y `viso-codigo (2).zip` usan `Bricolage Grotesque` como primera familia sans y `Geist Mono` como primera familia monoespaciada. El enlace original de Google Fonts solicita Bricolage con peso 300–800 y tamaño óptico 12–96; Geist Mono con peso 100–900. Estas familias se incluyen ahora en `public/fonts/` y se declaran con los mismos nombres y rangos en `src/fonts.css`. `src/index.css` importa ese archivo y conserva sus variables de familia, tamaños, colores y estilos.

Se incluyen únicamente los subconjuntos latin y latin-ext normales, suficientes para el contenido español original. Los archivos Bricolage `opsz` conservan los ejes variables `opsz` y `wght`, con ancho fijado al normal, como el enlace original. Los archivos `wght` de Geist Mono conservan el peso variable. No se renombró ni modificó el contenido binario de las fuentes. Los rangos Unicode corresponden a los CSS originales del paquete Fontsource. Las familias adicionales del enlace web original mantienen su comportamiento existente.

## Procedencia y licencia

- `@fontsource-variable/bricolage-grotesque@5.3.0`: fuente Google Fonts v9, modificación de upstream indicada en sus metadatos: 2025-09-11.
- `@fontsource-variable/geist-mono@5.3.0`: fuente Google Fonts v6, modificación de upstream indicada en sus metadatos: 2026-06-08.
- Descarga: tarballs públicos de `registry.npmjs.org`, el 2026-10-09. No se añadieron dependencias ni se modificó el lockfile.
- Licencia: SIL Open Font License 1.1, distribuida íntegra con su atribución en `bricolage-grotesque-OFL.txt` y `geist-mono-OFL.txt`.

`public/fonts/provenance.json` registra las URLs de metadatos y tarballs, versiones, integridad npm SHA-512, hashes SHA-256 de cada archivo, tamaños y ejes leídos del binario con fontTools. Antes de extraer cualquier archivo se descargó la metadata por HTTPS y se comparó `base64(sha512(tarball))` con `dist.integrity`; ambas verificaciones coincidieron. Los cuatro WOFF2 se abrieron con fontTools para confirmar los ejes variables y sus rangos.

La compilación Vite copia `public/fonts/` a `dist/fonts/`; `cap sync android` incorpora esos archivos a los recursos locales de la APK. No requiere descargar fuentes para renderizar el Deck original en Android. La validación visual debe esperar a que `document.fonts.ready` resuelva y comprobar que las familias se cargaron. La identidad de familias y ejes está verificada; una comparación binaria contra el CDN actual de Google Fonts queda limitada por su bloqueo de red en este entorno.

Validación realizada: Vite compiló correctamente y los cuatro archivos copiados coincidieron con sus hashes SHA-256. Chromium cargó ambos subconjuntos de las dos familias con toda petición externa bloqueada; `CSS.getPlatformFontsForNode` confirmó glifos de fuentes personalizadas Bricolage Grotesque y Geist Mono, sin recurrir a fuentes de sistema en texto español y latin-ext. El informe de ejecución se guardó en el directorio local de evidencia de validación Android como `font-offline-report.json`.
