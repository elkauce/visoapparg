# Google Home para VISO Deck Android: requisitos oficiales

Investigación realizada el **9 de octubre de 2026, 17:21 UTC**. Se consultaron
documentación oficial, el ejemplo mantenido por Google y los repositorios Maven
públicos mediante solicitudes de lectura. No se inició sesión en Google, no se
creó un proyecto OAuth, no se descargó un SDK restringido ni se cambió la APK.

## Resultado para esta entrega

**La configuración OAuth no es un requisito de compilación del SDK.** Con los
artefactos oficiales y una herramienta compatible se puede integrar y compilar
el código; OAuth y el consentimiento son necesarios para descubrir o controlar
los dispositivos reales del usuario. Esta conclusión se basa en la secuencia
oficial de instalación y en el Gradle del ejemplo, que permite compilar con un
valor predeterminado para el client ID. No se compiló ese ejemplo aquí porque
no se obtuvo su SDK.

**La aprobación de Google Home Developer Console no es necesaria para probar
Home APIs**, según la documentación de Permissions API. Sí es necesaria para
publicar una aplicación que utilice Home APIs. Las páginas consultadas todavía
describen el registro de Home APIs en Developer Console como no disponible.

**El impedimento observable para integrar el SDK completo ahora es su descarga
autenticada.** La página oficial exige iniciar sesión en Google Home Developers
y distribuir las bibliotecas localmente. Sin sesión presenta el botón de login,
sin enlace público al archivo. No se ha demostrado que haga falta aprobación de
Developer Console para descargarlo; tampoco se han comprobado requisitos que
puedan aparecer después del login.

En consecuencia, VISO muestra Google Home/RGB como pendiente de configuración.
Abrir Google Home o guardar una acción RGB no descubre lámparas ni acredita una
conexión. La APK actual no incluye este SDK ni ejecuta comandos Google Home.

## Evidencia del SDK y Maven

La documentación oficial [Add the Home APIs to your Android app][sdk] dice:

> “The Home APIs in this open beta are not yet part of the standard libraries
> provided by Google for development. [...] download and host the libraries locally.”

> “To download the Home APIs Android SDK, you must first be signed into Google
> Home Developers.”

El [ejemplo oficial Android][sample] consultado corresponde al commit
[`aeba7528fe6e4085d6e3c84def38dfe72094558f`][sample-commit], fechado el 5 de
octubre de 2026. Sus archivos declaran:

| Archivo del ejemplo                            | Evidencia                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`gradle/libs.versions.toml`][sample-versions] | `com.google.android.gms:play-services-home:17.1.0` y `play-services-home-types:17.1.0`.         |
| [`settings.gradle.kts`][sample-settings]       | `mavenLocal()` antes de `google()` y `mavenCentral()`.                                          |
| [`app/build.gradle.kts`][sample-build]         | Incluye ambas bibliotecas; `WEB_CLIENT_ID_DEV` puede faltar y usa `YOUR_DEFAULT_WEB_CLIENT_ID`. |

Comprobaciones de disponibilidad realizadas en la fecha indicada:

| Destino público                                                           | Respuesta observada                                                                                |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Google Maven: metadata de `play-services-home`][maven-home]              | HTTP 200; enumera únicamente `16.0.0-beta1` y `16.0.0`, con última actualización `20221215214222`. |
| [Google Maven: POM de `play-services-home:17.1.0`][maven-home-pom]        | HTTP 404.                                                                                          |
| [Google Maven: metadata de `play-services-home-types`][maven-types]       | HTTP 404.                                                                                          |
| [Google Maven: POM de `play-services-home-types:17.1.0`][maven-types-pom] | HTTP 404.                                                                                          |
| [Maven Central: metadata de `play-services-home`][central-home]           | HTTP 404.                                                                                          |
| [Maven Central: metadata de `play-services-home-types`][central-types]    | HTTP 404.                                                                                          |

También dieron HTTP 404 los POM 17.1.0 en Maven Central. Por lo tanto, agregar
únicamente esas coordenadas a Gradle no permite resolver el SDK del ejemplo en
estos repositorios. La versión pública 16.0.0 no corresponde al conjunto 17.1.0
con tipos que usa el ejemplo y no se debe sustituir sin comprobar su contrato.
La versión exacta y las instrucciones de instalación del archivo descargable
deben verificarse al obtenerlo; no se infieren de una página sin sesión.

## Requisitos técnicos y de cuenta

La [guía del SDK][sdk] pide Android Studio 2024.2.1 (Ladybug) o posterior y ADB.
Para ejecutar y probar exige Android 10 o posterior, una cuenta Google de
desarrollo, Wi-Fi y al menos un dispositivo compatible. Para dispositivos Matter
también se requiere un hub Google compatible con Home APIs; para Thread, un
Thread Border Router. Las capacidades cambian según conectividad y estado del
hub, como describe [Connectivity on Android][connectivity].

El ejemplo vigente usa `minSdk 29`, `compileSdk/targetSdk 36`, Java/JVM 17,
Android Gradle Plugin 8.10.0, Kotlin 2.4.0 y Gradle 9.2.1. Son los valores del
ejemplo consultado, no una certificación de compatibilidad de todos ellos con
el proyecto Capacitor de VISO. Al integrar el SDK hay que comprobar su metadata,
requisitos y compatibilidad con la herramienta de VISO. Hay que decidir si elevar
el `minSdk` de la variante con Home APIs y mantener una variante general sin ese
SDK para Android anterior a 10. Esa separación aún no está implementada.

Para realizar el flujo real de permisos, [Set up OAuth][oauth] indica:

1. Usar o crear un proyecto Google Cloud y configurar la pantalla de consentimiento.
2. Crear un cliente OAuth de tipo Android con el `applicationId` y la huella SHA-1
   del certificado que firma la APK que se vaya a probar.
3. Añadir las cuentas de prueba a la audiencia. La guía indica que no hace falta
   añadir scopes manualmente a la pantalla inicial.
4. Instalar la APK correspondiente en un teléfono físico y solicitar acceso
   mediante Permissions API. El usuario elige su cuenta y la estructura/casa.

El client ID Android es un identificador de configuración, no una clave privada.
No hace falta incorporar un client secret, credenciales administrativas ni una
clave de firma privada dentro de la APK. Un flujo adicional de Sign in with
Google iniciado por la propia aplicación puede requerir un client ID web; la
[guía de inicialización][initialize] lo describe como una opción para gestionar
cuentas. No es necesario para adoptar el flujo de selección de cuenta del SDK.
La sesión Google Home y la sesión VISO/Convex siguen siendo autorizaciones
distintas.

### Pruebas frente a publicación

[Permissions API][permissions] distingue aplicaciones sin registro, recomendadas
para pruebas con hasta **100 usuarios OAuth de prueba**, de aplicaciones
registradas y aprobadas para producción. Indica expresamente:

> “Developer Console registration is required to publish an app using the Home
> APIs. It is not required to test and use the Home APIs.”

La página OAuth advierte además que un proyecto pendiente de verificación OAuth
puede mostrar `Access blocked: <Project Name> has not completed the Google
verification process`. La página más reciente de permisos sí describe el flujo
de pruebas para una aplicación no verificada con usuarios de prueba. No se
confunden ambos estados: la configuración y el estado real de la audiencia deben
validarse con una cuenta de prueba; no se afirma que toda configuración pendiente
de verificación vaya a funcionar.

Para publicación general se necesitan registro/aprobación en Developer Console,
verificación de marca OAuth y aprobación de los tipos de dispositivo a los que
accederá la aplicación. La documentación consultada marca ese registro como
todavía no disponible y el [roadmap][get-started] muestra registro y lanzamiento
como “Coming soon”. Esto limita una publicación general; no convierte el
registro en requisito para escribir o compilar un prototipo con el SDK obtenido.

## Implementación posterior concreta

La integración nativa debe crear un único `HomeClient` con `Home.getClient`,
registrar tipos/traits en `FactoryRegistry` e implementar
`registerActivityResultCallerForPermissions`, `hasPermissions()` y
`requestPermissions()`. Debe manejar consentimiento cancelado, revocación y
errores; al revocar acceso hay que eliminar datos cacheados y dejar de controlar
los dispositivos afectados. La selección de cuenta y casa pertenece al flujo
oficial, sin recopilar contraseñas Google en VISO.

Para iluminación, descubrir los dispositivos de la casa autorizada y comprobar
los traits y comandos realmente disponibles. `OnOff`, `LevelControl` y
`ColorControl`/`ExtendedColorControl` son contratos distintos: una lámpara que
se enciende y permite brillo puede carecer de color RGB. Usar las capacidades y
`supports(...)`, como exige [Control devices on Android][control], para habilitar
las opciones correctas. Los comandos son funciones suspendidas que devuelven
respuesta o `HomeException`; el resultado visible debe reflejar esa respuesta y
el estado observado, sin confirmaciones inventadas.

Los grupos VISO pueden referenciar solamente dispositivos descubiertos y
autorizados para esa cuenta/casa. Para escenas y automatizaciones hay que validar
compatibilidad y permisos, ordenar los pasos, detenerse en errores y prevenir
doble pulsación. Una cuenta VISO no autoriza por sí misma otra casa Google Home.

## Qué falta y qué puede continuar

| Paso pendiente                                                                                                                | Qué permite verificar                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Obtener el SDK desde la descarga oficial con una sesión Google Developers autorizada y conservar versión/licencia/integridad. | Resolver sus artefactos y compilar una integración nativa real. No requiere compartir la contraseña o un token en chat. |
| Configurar proyecto y cliente OAuth Android con package y certificado correctos; registrar audiencia de pruebas.              | Abrir el consentimiento oficial y conceder acceso a una casa real.                                                      |
| Tener teléfono Android 10+, servicios Google Play, cuenta Google, Wi-Fi, lámpara compatible y hub cuando corresponda.         | Descubrimiento, encendido, brillo, color y confirmación de estado reales.                                               |
| Ejecutar pruebas de revocación, reconexión, lámparas sin RGB, cuentas/casas distintas y fallos de comandos.                   | Acreditar comportamiento y aislamiento, además de una compilación.                                                      |
| Confirmar disponibilidad del registro y aprobación de Google Home/OAuth antes de una publicación general.                     | Distribución pública de una integración Home APIs aprobada.                                                             |

La [guía del ejemplo][sample-doc] recomienda teléfono físico porque Home APIs
depende de servicios Google Play presentes en un dispositivo real. La
[guía de pruebas][test] exige dispositivos físicos y advierte que simuladores y
Playground no los sustituyen. El emulador de la APK general puede validar Deck,
pero no prueba control Google Home ni permisos reales sobre lámparas.

No se solicita ninguna credencial privada para esta entrega y no se presenta la
integración como conectada. Se puede continuar con arquitectura del adaptador,
estados de configuración y pruebas del contrato sin afirmar que el SDK o un
dispositivo ya hayan sido integrados.

## Fuentes y fechas declaradas por Google

| Fuente oficial                     | Última actualización mostrada al consultar |
| ---------------------------------- | ------------------------------------------ |
| [SDK Android][sdk]                 | 2024-12-04 UTC                             |
| [OAuth][oauth]                     | 2025-01-31 UTC                             |
| [Ejemplo Android][sample-doc]      | 2025-03-26 UTC                             |
| [Inicialización][initialize]       | 2025-12-09 UTC                             |
| [Permissions API][permissions]     | 2026-09-07 UTC                             |
| [Control de dispositivos][control] | 2026-09-23 UTC                             |
| [Conectividad][connectivity]       | 2026-08-31 UTC                             |
| [Pruebas][test]                    | 2025-06-08 UTC                             |
| [Roadmap][get-started]             | 2026-10-05 UTC                             |

Las respuestas HTTP y declaraciones son evidencia de esta fecha, no garantía de
disponibilidad futura. No se verificó el contenido de una descarga que requiere
sesión ni una autorización Google Home real.

[sdk]: https://developers.home.google.com/apis/android/sdk
[oauth]: https://developers.home.google.com/apis/android/oauth
[permissions]: https://developers.home.google.com/apis/android/permissions
[initialize]: https://developers.home.google.com/apis/android/initialize
[control]: https://developers.home.google.com/apis/android/device/control
[connectivity]: https://developers.home.google.com/apis/android/connectivity
[test]: https://developers.home.google.com/apis/android/test
[get-started]: https://developers.home.google.com/apis/android/get-started
[sample-doc]: https://developers.home.google.com/apis/android/sample-app/build
[sample]: https://github.com/google-home/google-home-api-sample-app-android
[sample-commit]: https://github.com/google-home/google-home-api-sample-app-android/commit/aeba7528fe6e4085d6e3c84def38dfe72094558f
[sample-versions]: https://github.com/google-home/google-home-api-sample-app-android/blob/aeba7528fe6e4085d6e3c84def38dfe72094558f/gradle/libs.versions.toml
[sample-settings]: https://github.com/google-home/google-home-api-sample-app-android/blob/aeba7528fe6e4085d6e3c84def38dfe72094558f/settings.gradle.kts
[sample-build]: https://github.com/google-home/google-home-api-sample-app-android/blob/aeba7528fe6e4085d6e3c84def38dfe72094558f/app/build.gradle.kts
[maven-home]: https://dl.google.com/dl/android/maven2/com/google/android/gms/play-services-home/maven-metadata.xml
[maven-home-pom]: https://dl.google.com/dl/android/maven2/com/google/android/gms/play-services-home/17.1.0/play-services-home-17.1.0.pom
[maven-types]: https://dl.google.com/dl/android/maven2/com/google/android/gms/play-services-home-types/maven-metadata.xml
[maven-types-pom]: https://dl.google.com/dl/android/maven2/com/google/android/gms/play-services-home-types/17.1.0/play-services-home-types-17.1.0.pom
[central-home]: https://repo.maven.apache.org/maven2/com/google/android/gms/play-services-home/maven-metadata.xml
[central-types]: https://repo.maven.apache.org/maven2/com/google/android/gms/play-services-home-types/maven-metadata.xml
