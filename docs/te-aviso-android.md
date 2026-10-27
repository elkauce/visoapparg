# Te Aviso para Android

Te Aviso tiene un proyecto Android propio en `apps/teaviso/android`, con Capacitor
y el frontend de `apps/teaviso`. Se puede instalar junto con VISO: sus paquetes,
almacenamiento y enlaces de regreso son distintos.

| Dato | Valor |
| --- | --- |
| Nombre visible | Te Aviso |
| Paquete y namespace | `com.teaviso.app` |
| Versión Android | `1.0.0`, código `1` |
| Android mínimo / objetivo | Android 7, API 24 / API 36 |
| Backend compartido | `https://vivid-nightingale-785.convex.cloud` |
| Sitio del backend | `https://vivid-nightingale-785.convex.site` |
| Web pública y destino de los QR | `https://teaviso-manuelhaguilar8-4981s-projects.vercel.app` |
| Regreso Google de esta APK | `com.teaviso.app://oauth/google` |

Las cuentas, timbres, inmuebles, licencias y demás datos siguen en el mismo
backend que VISO. No hay migración ni duplicación de cuentas. Cada aplicación y
origen web conserva su propia sesión; instalar Te Aviso no importa la sesión de
VISO. El visitante abre el QR en la web sin instalar ni registrarse.

## Compilación y Android Studio

Desde la raíz del repositorio, con Node 24 o superior, pnpm `11.19.0` (la versión
fijada), Java 21 y Android SDK 36 disponibles:

```sh
pnpm install --frozen-lockfile
npm run teaviso:android:build
npm run teaviso:android:open
```

El primer comando comprueba TypeScript, genera `apps/teaviso/dist-android`,
sincroniza Capacitor y ejecuta `assembleDebug` y los tests JVM. El segundo abre
`apps/teaviso/android` en Android Studio. La ubicación local del SDK se configura
en `apps/teaviso/android/local.properties`, ignorado por Git.

El script `scripts/build-teaviso-android.mjs` fija los orígenes HTTPS anteriores y
deja la APK y su descripción en `artifacts/teaviso-android/`:

- `Te-Aviso-1.0.0.apk` cuando existe una configuración Firebase válida para Te Aviso.
- `Te-Aviso-1.0.0-preview.apk` sin esa configuración o con `--without-push`.
- `build.json` identifica backend, versión, variante y disponibilidad de FCM.

Opciones útiles desde la raíz:

```sh
npm run teaviso:android:build -- --web-only
npm run teaviso:android:build -- --without-push
npm run teaviso:android:build -- --local-test
```

`--web-only` solo genera la web empaquetable. `--local-test` crea
`Te-Aviso-local-test.apk`, con backend local y HTTP permitido exclusivamente para
`localhost`, `127.0.0.1` y `10.0.2.2`. Admite los orígenes de prueba
`TEAVISO_TEST_BACKEND`, `TEAVISO_TEST_SITE` y `TEAVISO_TEST_PUBLIC_ORIGIN`; requiere
servidores locales accesibles desde el dispositivo. La compilación habitual
mantiene HTTPS, sin contenido mixto ni depuración del WebView.

Las APK generadas usan un **certificado Android Debug para pruebas**. No son una
entrega firmada para Google Play. La firma de publicación y una entrega de tienda
siguen siendo tareas separadas.

## Google y Firebase

Google se abre en el navegador del sistema. Su callback OAuth HTTPS sigue en
Convex; el regreso final usa `com.teaviso.app://oauth/google?attempt=<nonce>`,
propio de Te Aviso. El intento queda ligado a un nonce de 64 caracteres, un
verificador y un vencimiento. La validación rechaza parámetros adicionales,
duplicados y destinos ajenos.

El cambio de backend que admite este regreso exacto está implementado en
`convex/lib/google_auth_redirect.ts` y **todavía no está desplegado**. Debe
conservar el regreso existente de VISO (`com.viso.deck://oauth/google`). El inicio
Google nativo y la vinculación de cuentas requieren verificar ese despliegue y
probar el recorrido en Android; compilar la APK no acredita ese funcionamiento.
La consulta pública de configuración confirma Google web disponible y el regreso
Google Android de Te Aviso todavía sin desplegar.

Una comprobación de solo lectura confirmó que el backend tiene FCM configurado
para el proyecto Firebase **`viso-ad874`**. Te Aviso requiere su propio cliente
Android de ese proyecto para **`com.teaviso.app`**. Su archivo cliente va en:

```text
apps/teaviso/android/app/google-services.json
```

Esa ruta está ignorada por Git. El script valida el proyecto y el paquete antes
de habilitar FCM; el JSON de la APK VISO no sustituye el cliente de Te Aviso. No
copiar credenciales de administración Firebase a la aplicación ni a variables
`VITE_*`. El cliente correcto recibido declara el proyecto **`viso-ad874`** y
contiene los paquetes **`com.teaviso.app`** y `com.viso.deck`. Ya se validó y copió
a la ruta anterior, ignorada por Git y con permisos locales `0600`. Las APK
habitual y local ya se compilaron con FCM habilitado; la entrega real de avisos
sigue pendiente de prueba en dispositivo.

Los avisos con la app cerrada requieren APK compatible, servicio FCM del backend,
Google Play Services, conexión y activación voluntaria por cuenta y dispositivo.
El permiso no se solicita al abrir la app. Desactivar avisos o salir deshabilita
la recepción local y solicita la baja de la inscripción en el backend. Android
puede limitar la entrega por batería o cierre forzado. La configuración compilada
por sí sola no demuestra entrega real de notificaciones.

## Permisos y privacidad

El manifiesto declara Internet, micrófono, cámara, ajustes de audio y
notificaciones. Cámara y micrófono corresponden a las llamadas y requieren el
permiso del usuario; la cámara no es un requisito para instalar. No se solicitan
contactos, ubicación, telefonía ni acceso general al almacenamiento. Los QR PNG y
SVG se guardan mediante el selector de archivos de Android.

Las credenciales de sesión se cifran con AES-256-GCM y una clave de
AndroidKeyStore propia del paquete. La copia de seguridad y la transferencia de
datos están desactivadas. Los avisos comprueban destinatario, sesión y vencimiento
antes de mostrarse; abrirlos vuelve a validar el acceso a la llamada en el
backend. No habilitan por sí mismos cámara, micrófono ni apertura de cerraduras.

## Verificación disponible

Estado documentado el 27 de octubre de 2026. El cliente Firebase correcto está
integrado y las compilaciones con FCM terminaron correctamente:

| Comprobación | Resultado y evidencia local |
| --- | --- |
| Suite completa Vitest | 1014 tests, 112 archivos, aprobados tras el último ajuste; `artifacts/teaviso-android/all-tests-resume.log` |
| Regreso Google nativo | 4 tests focalizados aprobados, incluidos en la suite completa, después de ajustar los destinos seguros de regreso |
| Políticas Android JVM | 4 tests aprobados; `apps/teaviso/android/app/build/test-results/testDebugUnitTest/TEST-com.teaviso.app.TeAvisoPolicyTest.xml` |
| APK actual y metadatos | `Te-Aviso-1.0.0.apk`, 17.170.452 bytes, `pushEnabled: true`; build aprobado en 21 s. `artifacts/teaviso-android/build-fcm.log` y `build.json` |
| APK local con FCM | `Te-Aviso-local-test.apk`, `pushEnabled: true`, build aprobado en 8 s; `artifacts/teaviso-android/local-build-fcm.log` y `local-build.json` |
| Navegador con backend local aislado | Repetición aprobada de las cinco comprobaciones reales: registro, alta de timbre WhatsApp, descargas PNG/SVG, sesión tras recarga y misma cuenta en dos contextos; `artifacts/teaviso-android/browser-report.json` y `browser-qa-resume.log` |
| Firebase | Backend confirmado en `viso-ad874`, servicio configurado; cliente correcto de Te Aviso validado e integrado en la ruta ignorada |
| Servicio FCM empaquetado | Servicio habilitado en el manifiesto de la APK. La entrega de avisos sigue pendiente |
| Ejecución real de la APK | Pendiente: las comprobaciones web y JVM no prueban la app instalada |
| Google nativo y avisos FCM | Pendientes de despliegue compatible y prueba completa en dispositivo |

El emulador aislado completó el arranque, pero las instalaciones ADB con y sin
streaming agotaron sus tiempos de espera (45 s y 90 s). No se confirmó la
instalación ni la ejecución nativa. Antes de una entrega final faltan instalación
y coexistencia con VISO, sesión y cambio de cuenta, regreso Google, exportación
nativa de QR y llamadas/avisos con la app abierta y en segundo plano. No se
publicó en producción ni se desplegó el cambio de callback Google.
