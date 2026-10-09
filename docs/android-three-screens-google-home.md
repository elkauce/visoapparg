# Tres pantallas VISO y Google Home: estado comprobado

Consulta de fuentes oficiales realizada el **9 de octubre de 2026, 18:20 de
Buenos Aires (21:20 UTC)**. Este informe se limita a la integración de luces
Google Home solicitada junto con ESTADOS VISO, SPOTIFY y STANDBY. No se creó un
proyecto Google Cloud, no se autorizó una casa, no se probaron lámparas físicas
y no se publicó ningún cambio en producción durante esta investigación.

## SDK recuperado del proyecto STATUS

La primera investigación pública encontró que **no era solo autorización OAuth:
faltaba un SDK compilable en el entorno**. La información posterior del usuario
permitió revisar su repositorio STATUS autorizado y **resolver ese impedimento**.
No se debe seguir presentando el SDK como ausente.

Se revisó el repositorio privado existente `elkauce/status-mini-`, especialmente
la rama `viso-safe`, commit `bb33306a4669ae18e45e5e98eb53d11918b1bb62` del
7 de octubre de 2026. Contiene `GoogleHomeBridge.kt`, `HomeLinkActivity.kt` y los
dos AAR oficiales ya utilizados por STATUS. Los blobs AAR de esa rama son
idénticos a los de `main`, commit `75752a3d414f16bfc3ff772e148e3e8f4844085b`.
Se descargaron mediante lectura autorizada de GitHub, fuera del checkout VISO;
no se modificó STATUS.

| Artefacto recuperado | Tamaño | SHA-256 |
| --- | --- | --- |
| `play-services-home-17.1.0.aar` | 5.180.129 bytes | `dd088a22a0fc16886ee8a81bb86db9efc254378cf68b5cf4d59c5a7c1405b02b` |
| `play-services-home-types-17.1.0.aar` | 24.978.601 bytes | `4eda000761e067ec5b009a1b2cf6fce67f32dbf15628d1dcf8846db58f303003` |

Se comprobaron los archivos ZIP, clases `Home`, `HomeClient` y
`ExtendedColorControl`, firmas públicas con `javap`, manifiestos y metadata AAR.
Ambos manifiestos declaran **minSdk24**; no es necesario subir el mínimo general
de VISO para enlazarlos. Declaran metadata Kotlin **2.3.0**, que se usa al
compilar la integración. La ejecución Home APIs se restringe a Android 10+ y
servicios Google Play disponibles, según los requisitos oficiales.

La [guía oficial del SDK][sdk] indica que las bibliotecas de esta beta deben
descargarse y alojarse localmente. La página sin sesión exige iniciar sesión en
Google Home Developers y no expone un enlace público al archivo:

> “To download the Home APIs Android SDK, you must first be signed into Google
> Home Developers.”

El [ejemplo oficial de Google][sample] consultado corresponde al commit
[`aeba7528fe6e4085d6e3c84def38dfe72094558f`][sample-commit], del 5 de octubre
de 2026. Declara `com.google.android.gms:play-services-home:17.1.0` y
`com.google.android.gms:play-services-home-types:17.1.0`, con `mavenLocal()`
para resolver las bibliotecas descargadas.

El usuario informó que trabajó con **Google Home SDK 1.10.1**. La
[publicación oficial `v1.10.1`][release-1101] menciona “Google Home Platform SDK
v1.10.1”; su [catálogo][versions-1101] también declara las coordenadas Maven
17.1.0. La versión distribuida no debe confundirse con esas coordenadas ni darse
por incorrecta. Se reutilizaron los artefactos concretos de STATUS.

| Comprobación de lectura | Resultado observado |
| --- | --- |
| [Metadata pública de `play-services-home`][maven-home] | HTTP 200; solo enumera `16.0.0-beta1` y `16.0.0`. |
| [POM público de `play-services-home:17.1.0`][maven-home-pom] | HTTP 404. |
| [Metadata pública de `play-services-home-types`][maven-types] | HTTP 404. |
| Árbol completo del repositorio oficial del ejemplo | No incluye SDK, AAR ni archivos ZIP; el único JAR encontrado es el Gradle Wrapper. |
| [Publicaciones del ejemplo][releases] | Las nueve publicaciones devueltas, incluida `v1.11.0`, no tienen assets descargables. |
| AAR oficial público `play-services-home:16.0.0` | Inspeccionado en memoria: no contiene `com/google/home/Home.class` ni `HomeClient.class`; contiene APIs de Matter commissioning. |

La versión pública 16.0.0 **no sustituye** las Home APIs de descubrimiento y
control de luces. No se usaron SDK de terceros, enlaces inferidos, credenciales
de infraestructura ni métodos para eludir una descarga autenticada. Se reutilizó
la distribución oficial ya guardada en el proyecto del usuario. La autorización
GitHub permite recuperar ese material; no concede acceso a su casa Google Home.

## Reutilizar el proyecto Google Cloud STATUS

Según la información aportada por el usuario, ya existen proyecto Google Cloud
**STATUS**, cuenta de prueba y cliente OAuth Android para **`com.statusmini.app`**,
con huella SHA-1 actualizada. No se consultó ni modificó su configuración privada
en Google Cloud Console durante esta investigación. No se creó otro proyecto.

El proyecto, consentimiento y audiencia deben reutilizarse. Un cliente Android
está asociado a la pareja **package + certificado**: actualizar la SHA-1 no
convierte `com.statusmini.app` en `com.viso.deck`. VISO conserva su package y
certificado para poder actualizar la APK ya instalada.

En el proyecto STATUS hay que revisar los clientes existentes en Google Auth
Platform → Clients, o APIs y servicios → Credenciales. Si todavía no existe un
cliente Android para `com.viso.deck` y la huella de su APK, se necesita **un cliente
Android adicional dentro del mismo STATUS**. Se conserva el cliente de
`com.statusmini.app`; no se sustituye ni elimina. Hay que verificar la audiencia
de pruebas y, en el teléfono, el consentimiento Home APIs efectivo. No se usa
`GOOGLE_APPLICATION_CREDENTIALS` de la plataforma ni una cuenta de servicio para
acceder a la casa del usuario.

## Qué incluye y qué no incluye la APK

Las tres pantallas pueden compilarse con el proyecto existente. Los botones de
ESTADOS VISO usan la sincronización VISO actual. Los colores destinados a luces
pueden guardarse como preferencias editables dentro de esa pantalla, sin crear
otra pantalla del Deck.

Se implementó un puente nativo **real**, reutilizando las APIs y los comandos del
SDK de STATUS/`viso-safe`, con un singleton HomeClient, consentimiento oficial,
descubrimiento de luces de color, selección y seis colores editables. La APK con
SDK se compila suministrando `VISO_GOOGLE_HOME_SDK_DIR` hacia el directorio externo
que contiene los dos AAR comprobados. Gradle verifica sus SHA-256. No se añaden
los AAR independientes al repositorio público.

La compilación general/CI sin esa variable usa un puente alternativo que indica
**`sdkPresent: false`** y que no puede autorizar ni controlar Google Home. No
devuelve luces inventadas. Esto es distinto de una APK con SDK, que indica SDK
disponible pero **no marca conexión** hasta recibir permisos reales de Google.

**No se acredita todavía consentimiento ni control de lámparas físicas.**
Guardar un color, abrir Google Home, compilar el SDK o tener una sesión VISO no
equivale a conectar una casa. Los resultados por lámpara distinguen comando
aceptado (`commanded`) de observación física; no se inventa `confirmed: true`.

## Integración oficial necesaria

La [inicialización][initialize] requiere un único `HomeClient`, creado mediante
`Home.getClient`, y una `FactoryRegistry` con los tipos y traits utilizados.
Para este alcance se necesita iluminación de color, no un panel de domótica.
La selección y los colores pueden mantenerse en un diálogo de ESTADOS VISO.

La [Permissions API][permissions] proporciona
`registerActivityResultCallerForPermissions`, `hasPermissions()` y
`requestPermissions()`. La aplicación debe registrar el llamador de resultados
al crear la actividad, comprobar permisos y usar el selector oficial de cuenta
y casa; no debe pedir contraseñas Google. Una sesión VISO y el consentimiento
Google Home son autorizaciones distintas.

Tras obtener consentimiento, se consultan dispositivos reales de la casa
autorizada. Solo se ofrecen luces con comandos de color compatibles:

- [`ExtendedColorControl`][rgb] permite `moveToColorRgb(red, green, blue)` con
  valores `UByte` de 0 a 255. Antes hay que comprobar
  `supports(ExtendedColorControl.Command.MoveToColorRgb)`.
- [`ColorControl`][color] puede admitir `MoveToHueAndSaturation` o `MoveToColor`
  para HSV o coordenadas XY. Estos comandos requieren comprobar su soporte y
  una conversión de color válida. La mera presencia de `ColorControl`, encendido
  o brillo no demuestra capacidad RGB: una lámpara puede admitir solo blanco
  con temperatura de color.

Los [comandos oficiales][control] son funciones suspendidas y pueden devolver
`HomeException`. Hay que mostrar errores reales, manejar lámparas desconectadas
y observar estado cuando esté disponible. Los comandos se envían **únicamente
a los IDs seleccionados por el usuario**, sin modificar las demás luces.

La documentación de permisos indica que una aplicación de prueba no registrada
puede recibir un consentimiento amplio sobre la casa. Registrar solo traits de
iluminación no restringe por sí mismo ese consentimiento. VISO debe mantener su
lista explícita de luces elegidas y limitar a ellas cualquier ejecución. La
revocación debe detener el control y eliminar los datos de dispositivos afectados.

## OAuth, certificado y requisitos físicos

La [guía OAuth][oauth] exige proyecto Google Cloud, pantalla de consentimiento,
audiencia de pruebas y cliente OAuth de tipo Android. En este caso se revisa y
reutiliza STATUS, completando únicamente lo que falte. Para la
APK firmada con el certificado de depuración VISO ya documentado:

- **Package:** `com.viso.deck`.
- **SHA-1:** `F3:E3:92:AE:D0:8C:29:51:4F:1D:6D:25:17:61:20:21:3C:5A:77:A6`.
- Añadir la cuenta Google utilizada para probar a la audiencia de pruebas.

Esta huella es un identificador público del certificado; no es la clave privada.
El cliente debe corresponder al certificado que firma la APK instalada. Una APK
firmada con otro certificado necesita su propia configuración OAuth. No se debe
incorporar ningún client secret ni credencial administrativa a la APK.

El selector de cuenta del SDK no exige añadir un inicio de sesión Google
independiente a VISO. Un client ID web corresponde al flujo opcional de Sign in
with Google iniciado por la propia aplicación y no sustituye el consentimiento
Home APIs.

Según [Permissions API][permissions], el registro en Developer Console no es
necesario para probar Home APIs, con hasta **100 usuarios OAuth de prueba**.
Para distribución general hacen falta registro/aprobación de los tipos de
dispositivo y verificación de marca OAuth. Las páginas oficiales consultadas
siguen indicando que el registro Home APIs en Developer Console todavía no
está disponible. La página OAuth y la de permisos contienen matices distintos
sobre proyectos pendientes de verificación; el flujo real debe comprobarse con
la audiencia y configuración elegidas, sin garantizar consentimiento anticipado.

La guía del SDK requiere **teléfono Android 10 o posterior**, servicios Google
Play y cuenta Google adecuados, Wi-Fi y al menos una luz compatible. Para Matter
se necesita un [hub Google compatible][connectivity]; Thread requiere además un
Thread Border Router. VISO mantiene `minSdk24`, compatible con los manifiestos de
los AAR recuperados; la funcionalidad Home APIs tiene guardia de ejecución 29+.
Un emulador o una prueba de interfaz web no acredita control de luces reales.

## Estado cambiado desde otro dispositivo y límites Android

La integración debe suscribirse al **estado real de la sincronización VISO
existente**, independientemente de cuál de las tres pantallas esté abierta.
Cuando otro cliente cambia ese estado, el dispositivo Android autorizado aplica
el color correspondiente solo a sus luces seleccionadas. Debe evitar comandos
duplicados innecesarios y priorizar el estado más reciente.

Al recuperar conexión o reanudar la aplicación, se reconsulta el último estado,
se revalidan permisos y dispositivos y se aplica la preferencia vigente. Ese
comportamiento requiere todavía consentimiento efectivo y la prueba física
descrita arriba. La compilación no sustituye esa verificación.

No se encontró en las guías revisadas una prohibición universal de uso de Home
APIs en segundo plano. **Tampoco se puede prometer sincronización continua con la
APK cerrada o detenida forzosamente.** [Doze y App Standby][doze] pueden aplazar
red y CPU. Para aplicaciones con target Android 15 o posterior, un servicio
foreground de tipo `dataSync` tiene [límite de seis horas por 24 horas][timeout].
Añadir un servicio no elimina esos límites ni prueba la entrega inmediata.
No se exige instalar Home Assistant ni montar un servidor propio.

## Pendientes concretos antes de acreditar la conexión

1. Verificar la APK final compilada con los artefactos recuperados, su firma y la
   presencia del puente real. La compilación sin SDK debe seguir indicando su
   ausencia con claridad.
2. Revisar clientes y audiencia de STATUS, agregar únicamente el cliente Android
   VISO que falte con package/certificado correctos y conceder acceso a una casa
   desde el teléfono de prueba.
3. Comprobar que la integración no afecta funcionalidades existentes ni crea
   otra pantalla del Deck.
4. Probar descubrimiento RGB, selección aislada, los seis colores editables,
   cambios desde otro dispositivo VISO, revocación, reconexión y límites de
   segundo plano con lámparas reales.

No hace falta compartir contraseñas, tokens de sesión ni claves privadas en el
chat. Obtener el SDK y configurar OAuth son pasos distintos de autorizar una
publicación en producción; este informe no autoriza esa publicación.

[sdk]: https://developers.home.google.com/apis/android/sdk
[sample]: https://github.com/google-home/google-home-api-sample-app-android
[sample-commit]: https://github.com/google-home/google-home-api-sample-app-android/commit/aeba7528fe6e4085d6e3c84def38dfe72094558f
[releases]: https://github.com/google-home/google-home-api-sample-app-android/releases
[release-1101]: https://github.com/google-home/google-home-api-sample-app-android/releases/tag/v1.10.1
[versions-1101]: https://github.com/google-home/google-home-api-sample-app-android/blob/v1.10.1/gradle/libs.versions.toml
[maven-home]: https://dl.google.com/dl/android/maven2/com/google/android/gms/play-services-home/maven-metadata.xml
[maven-home-pom]: https://dl.google.com/dl/android/maven2/com/google/android/gms/play-services-home/17.1.0/play-services-home-17.1.0.pom
[maven-types]: https://dl.google.com/dl/android/maven2/com/google/android/gms/play-services-home-types/maven-metadata.xml
[initialize]: https://developers.home.google.com/apis/android/initialize
[permissions]: https://developers.home.google.com/apis/android/permissions
[oauth]: https://developers.home.google.com/apis/android/oauth
[rgb]: https://developers.home.google.com/reference/kotlin/com/google/home/google/ExtendedColorControl
[color]: https://developers.home.google.com/reference/kotlin/com/google/home/matter/standard/ColorControl
[control]: https://developers.home.google.com/apis/android/device/control
[connectivity]: https://developers.home.google.com/apis/android/connectivity
[doze]: https://developer.android.com/training/monitoring-device-state/doze-standby
[timeout]: https://developer.android.com/develop/background-work/services/fgs/timeout
