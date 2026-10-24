# Te a Viso — propuesta de identidad y placas, publicada

Revisión publicada el 24 de octubre de 2026 tras la autorización «Publica todo».
URL: https://teaviso-manuelhaguilar8-4981s-projects.vercel.app .

## Comunicación e identidad

Portada centrada en la experiencia de recibir visitas. Modalidades Esencial,
Digital y Asistido. Se retiran el generador anónimo directo de la portada y las
menciones reiteradas a “gratis” y WhatsApp; la creación se realiza desde la cuenta.
La modalidad Esencial mantiene su precio cero y la configuración continúa
identificando WhatsApp y advirtiendo que el número será visible. No se presenta
como tecnología de llamadas propia un chat de un tercero.

Paleta solicitada de VISO: fondo `#F5F3EF`, texto `#17191D`, blanco y naranja `#E84300`. El símbolo original de cuatro colores se muestra desde el PNG suministrado, sin modificar sus píxeles, junto al nombre **Te a Viso**. Para impresión y favicon se utiliza su representación vectorial de cuatro colores.
Logo, portada, panel, formularios y selector comparten la nueva identidad.

## Diseños de placas

- Minimal: vertical, blanco y tipografía oscura.
- Noche: vertical, grafito y acentos VISO.
- Señal: vertical, naranja VISO y contraste alto.
- Urbano: horizontal, composición dividida.

La misma representación SVG genera la vista previa y la descarga SVG/PNG.
Las placas incluyen marca, indicación para escanear, nombre del lugar y QR real,
sin mostrar el teléfono o explicar la integración. SVG incluye tamaño de 90 ×
120 mm o 120 × 80 mm; PNG exporta 1800 × 2400 o 2400 × 1600 píxeles. Al imprimir
PNG, seleccionar el tamaño deseado en el diálogo de impresión. El código conserva
cuatro módulos de zona de silencio y siempre contrasta oscuro sobre blanco.

La selección se guarda por entrada en la cuenta; se usa un campo opcional para
mantener compatibilidad con los QR existentes, cuyo diseño inicial es Minimal.
Guardar diseño no cambia el destino ni token del QR. Cada propietario solo puede
modificar sus entradas; Business requiere servicio activo y pago aprobado.

## Verificación

935 pruebas en 98 archivos correctas. Compilación de Te a Viso, TypeScript de
backend y ESLint correctos. 30 comprobaciones de navegador en anchos 1440, 390 y
320, sin desbordamiento. Los cuatro PNG y cuatro SVG descargados fueron leídos
con jsQR y devolvieron el enlace original. Navegador con cuentas sintéticas,
sin acceso a producción, mensajes ni cobros. Capturas en
`artifacts/teaviso/redesign/`.

## Latido y colores del cuadro principal

El cuadro del hero muestra un doble latido de luz cada 3,2 segundos. Recorre los
seis colores de `VISO_STATES` en un ciclo de 36 segundos con transiciones suaves:
Libre, Ocupado, Reunión, Llamada, No molestar y Ausente. Es una demostración visual;
no modifica estados, luces, llamadas ni datos de la cuenta. No usa temporizadores
JavaScript. Con movimiento reducido se desactivan ambas animaciones.

Verificación real en Chromium: 22 comprobaciones en escritorio y móvil, incluyendo
los seis colores exactos, cambio de luminosidad, ausencia de desbordamiento y
movimiento reducido. Vista animada local en `artifacts/teaviso/heartbeat/latidos.gif`.
Publicado con la identidad y las placas aprobadas.

## Comprobación posterior a la publicación

23 archivos estáticos coincidieron con la compilación; 8 rutas y 51 comprobaciones
de navegador en 1440, 390 y 320 px correctas. Los seis colores reales, el latido,
movimiento reducido, registro y botón Google están presentes. El endpoint para
guardar diseños exige sesión. Cobros deshabilitados; web y APK VISO conservadas.
Informe: `docs/validation/teaviso-redesign-production.json`.
