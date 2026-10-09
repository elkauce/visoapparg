# Validación de VISO Deck Android

El material de referencia es el código de `2a515f5dd564bad5a939f10643d69757137c1a7b`, anterior a la rama Android. La auditoría del ZIP y las coincidencias de los componentes originales están en [android-audit.md](android-audit.md). La comparación usa los mismos datos y la misma cuenta de prueba de un backend Convex local; no crea ni modifica cuentas de producción.

## Referencia visual

Estas capturas pertenecen a la interfaz original, a 1280 × 720 y 720 × 1280. Se cargaron mediante el botón original «Cargar estados básicos» y se activó «Libre». Las siete teclas ocupadas conservan el orden original: Libre, Ocupado, En reunión, En llamada, Almuerzo, Ausente y Apagar. El resto de las quince posiciones permanece vacío.

![Deck original horizontal](android-evidence/original-deck-landscape.png)

![Deck original vertical](android-evidence/original-deck-portrait.png)

Los colores de los estados se toman del código original y no se sustituyen por una paleta nueva. La comparación también registra los colores calculados, el brillo, el radio de las teclas y la fuente realmente renderizada, además del número de píxeles que cambian. Una adaptación de la cuadrícula a vertical puede cambiar la colocación sin modificar esos rasgos.

## Reproducción local

El proceso necesita el backend local configurado para email/contraseña y Chromium. Los paquetes de la herramienta de navegador se instalan en un directorio auxiliar, fuera del repositorio:

```sh
mkdir -p /workspace/.visoapparg-setup/android-validation/browser-tools
cd /workspace/.visoapparg-setup/android-validation/browser-tools
npm install --ignore-scripts --no-audit --no-fund \
  --cache /workspace/.visoapparg-setup/npm-cache \
  playwright@1.55.1 pngjs@7.0.0 pixelmatch@6.0.0
```

Se extrae la referencia con `git archive`, sin cambiar de rama ni crear un worktree. Se sirve en un puerto distinto al de la rama actual. Ambas configuraciones deben usar exclusivamente `http://127.0.0.1:3210` como URL Convex y `http://127.0.0.1:3211` como URL HTTP de Convex.

```sh
node scripts/android-validation/capture-deck.mjs http://127.0.0.1:5175 original
node scripts/android-validation/capture-deck.mjs http://127.0.0.1:5176 android-web
node scripts/android-validation/compare-deck.mjs
```

El script rechaza frontends que no sean de loopback y bloquea peticiones a los dominios de Convex en la nube. Genera una cuenta de prueba local, guarda sus credenciales y el estado del navegador con permisos `0600` en el directorio auxiliar y no los imprime ni los añade a Git.

## Estado de las comprobaciones

| Comprobación | Evidencia actual |
| --- | --- |
| Referencia extraída sin modificar `main` | `git archive` de `2a515f5` fuera del repositorio |
| Registro e inicio de sesión propios | Confirmados contra el backend local |
| Teclas y estado activo de referencia | Capturas originales y reporte del navegador |
| Comparación visual de la rama Android | Pendiente de finalizar los componentes Android |
| Instalación e inicio del APK | Pendiente de compilación y arranque completo del emulador |
| Retrato, paisaje y persistencia de sesión | Pendiente de ejecución del APK |
| Sincronización de dos dispositivos y offline | Pendiente de ejecución del APK |
| Google Home, reproducción de otra app y luces físicas | Requieren configuración externa y dispositivos reales; no se presentan como verificadas |

El emulador disponible es x86_64, Android API 36 con Google APIs, con TCG y SwiftShader. Este entorno carece de `/dev/kvm`; el arranque y la interacción resultan más lentos que en un equipo con virtualización. La evidencia de un emulador no sustituye la validación de hardware, cuentas OAuth ni permisos de aplicaciones de terceros en un dispositivo físico.
