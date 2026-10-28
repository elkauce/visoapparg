# Te Aviso · diseño 02 implementado

27 de octubre de 2026. **Publicado con autorización expresa del propietario («Si autorizo»).**

El propietario eligió la alternativa «02 · Producto conectado» y luego autorizó
publicarla. Se aplicó al frontend real de Te Aviso y se distribuyó la APK 1.0.1.
Web: https://teaviso-manuelhaguilar8-4981s-projects.vercel.app/ .
Descarga: https://teaviso-manuelhaguilar8-4981s-projects.vercel.app/downloads/Te-Aviso-1.0.1.apk .

[Capturas de la implementación, PDF de 9 páginas](design/te-aviso-02-implementacion/Te-Aviso-02-implementado.pdf).
[Informe de validación](validation/te-aviso-diseno-02.json).

## Cambios

- Inicio con fondo #F5F3EF, naranja #E84300, portada grafito, icono original y marca
  Te Aviso legible. Se retiró la importación de los estilos antiguos del home.
- Tres propuestas de servicio: Casas y departamentos, Profesionales y consultorios,
  Edificios. Todas incluyen cartel en la propuesta. No hay importes inventados,
  ofertas de prueba ni nuevos cobros. Las licencias y consultas anteriores se
  conservan; no se modifican derechos adquiridos.
- Login y registro, panel, configuración, QR, carteles, agenda, reservas, visitas,
  cuenta y administración usan la misma identidad. En escritorio el estado y la
  actividad se agrupan a la izquierda, con QR y privacidad a la derecha. En móvil
  se ordenan en una columna, con navegación inferior y menú completo desplegable.
- Desde el panel se puede descargar el PNG real del QR del timbre seleccionado.
  El enlace de personalización del cartel transporta ese mismo timbre.
- El cartel profesional permite incluir o quitar calle y número. La dirección se
  guarda en los campos existentes y aparece en la vista previa. No cambió el schema.
- El acceso Google conserva la propuesta o el cartel seleccionado mediante un
  destino local de un solo uso y duración limitada. Se filtran rutas y parámetros;
  no se amplió la lista de destinos OAuth del servidor. El login por contraseña
  conserva su funcionamiento y descarta destinos pendientes de un intento anterior.

`teavisoOffers` admite ahora la consulta `hogares`. El selector público utiliza
solo las tres propuestas actuales; los códigos anteriores permanecen válidos para
consultas históricas y clientes antiguos. No se crean licencias ni pedidos por
solicitar una propuesta. La actualización compatible del backend debe publicarse
antes del frontend para aceptar el nuevo código de consulta.

## Funciones que no se activan con este diseño

El puente bidireccional chat web–WhatsApp personal, la validación de cercanía de
unos 15 m y la apertura física de puertas siguen pendientes. Se identifican como
propuesta/en preparación. La recepción WhatsApp directa actual muestra el número;
no se describe como si fuera privada. Las llamadas y las reservas existentes
continúan dependiendo de sus permisos, licencias y configuración actuales.

Los precios, vigencias, detalles del cartel, instalación y entrega se confirman
antes de contratar. El cambio visual no activa una campaña comercial ni extiende
un cartel incluido a contratos anteriores sin revisar sus condiciones.

## Verificación

- 1.017 pruebas Vitest correctas en 113 archivos; prueba adicional de las tres
  consultas actuales conserva privacidad, compatibilidad y ausencia de cobros.
- 14 pruebas focalizadas de acceso/destino correctas tras el último ajuste del
  flujo de Google. TypeScript de Te Aviso, raíz y backend, y ESLint de los archivos
  modificados correctos, sin advertencias de lint.
- 76 vistas de navegador: 28 públicas y 48 de cuenta/visitante en 320, 390, 768 y
  1440 px, sin errores JavaScript, imágenes faltantes ni desbordes horizontales.
- 16 comprobaciones interactivas, incluida descarga efectiva PNG, menú móvil,
  elección de servicio, datos del cartel, dirección opcional y ruta de login.
  La cuenta se revisó con componentes React reales y proveedores de datos
  sintéticos aislados; las funciones Convex se verificaron por separado mediante
  convex-test. No es una prueba de sesiones, cobros o llamadas en producción.
- APK compilada con Firebase configurado y 4 pruebas JVM correctas. Se verificaron
  paquete `com.teaviso.app`, versión 1.0.1, código 2 y la misma firma de prueba que
  la APK 1.0.0. No se probó esta entrega en un teléfono físico.

Se retiraron reglas `!important` de los botones antiguos que impedían el contraste
correcto. La importación de estilos viejos del home se reemplazó por el diseño
conectado; el CSS principal compilado bajó de aproximadamente 184 KB a 129 KB.
Se respetan movimiento reducido, campos de 16 px en móvil y áreas táctiles.

## APK y reproducción

La APK de compilación está en `artifacts/teaviso-android/Te-Aviso-1.0.1.apk`.
El binario público aprobado se versiona en `apps/teaviso/public/downloads/` para
conservar la descarga en compilaciones futuras. Mi cuenta muestra el enlace solo
fuera de Android; la APK conserva el diseño y los servicios aprobados.
El informe registra tamaño, SHA-256 y certificado público. La firma es de pruebas,
no una entrega de Google Play. Conservar el almacén de firma usado en 1.0.0 es
necesario para instalar como actualización; no generar otra clave.

```sh
npm run teaviso:build
npm run teaviso:dev
npm run teaviso:android:build
```

En este entorno se utilizaron Java 21 completo y las ubicaciones persistentes de
Gradle y Android mediante `JAVA_HOME`, `GRADLE_USER_HOME` y `ANDROID_USER_HOME`.
Las credenciales, google-services.json y el almacén de firma no se versionaron.

## Publicación y comprobación en producción

El propietario completó la autenticación oficial de Vercel y autorizó el pase.
Se actualizó el backend **vivid-nightingale-785** mediante selección explícita
por nombre. La producción predeterminada de la cuenta Convex es otro destino,
`useful-egret-915`, que no se usó. No hubo migración ni modificación de planes,
cobros o credenciales.

Se publicó únicamente el proyecto Vercel **teaviso** (`prj_hEhkg9sAvj5fdk2CWK1fw61oe2nC`)
mediante Build Output API. Despliegue final **dpl_3Rf8qwr3aaTiXA4mkJdaHU7VEp4z**,
production, READY. Se conservó el alias canónico de Te Aviso que usa Google y los
QR; Vercel también mantiene `teaviso-sigma.vercel.app` como alias secundario.

Una primera compilación heredó una dirección local del sitio Convex desde el
entorno de desarrollo. Se sustituyó por una compilación con los orígenes públicos
fijados explícitamente, y se volvió a publicar y comprobar antes de cerrar la
entrega. Las futuras publicaciones deben fijar:

- `VITE_CONVEX_URL=https://vivid-nightingale-785.convex.cloud`
- `VITE_CONVEX_SITE_URL=https://vivid-nightingale-785.convex.site`
- `VITE_TEAVISO_PUBLIC_URL` y `VITE_PUBLIC_APP_URL` al alias canónico de Te Aviso.
- `VITE_TEAVISO_ANDROID=false` para la web; la APK usa su script propio.

Verificación HTTPS con TLS válido: 26 archivos coinciden por SHA-256 con la entrega,
25 rutas correctas y 404 para una descarga inexistente. La APK responde con tipo
Android y cabecera de descarga, pesa 13.877.898 bytes y coincide con el binario
aprobado. Google web y Android siguen disponibles; tres endpoints privados
rechazan acceso anónimo.

56 comprobaciones de navegador en 320, 390, 768 y 1440 px verificaron marca legible,
paleta, servicios, login con Google disponible, registro, conservación del plan,
cartel profesional con/sin dirección y ausencia de desbordes y errores JavaScript.
Las peticiones pasaron por el proxy configurado con validación TLS; los WebSocket
usaron un agente de proxy explícito. No se deshabilitó la validación de certificados.
No se completó consentimiento Google ni se crearon cuentas, consultas, cobros o
llamadas de prueba en producción.

El índice de VISO mantiene su SHA-256 anterior; su web y APK no se reconstruyeron.
Falta la prueba física de instalación/actualización, Google, QR y recepción de
llamadas de Te Aviso 1.0.1 en un celular.

[Informe de publicación](validation/te-aviso-diseno-02-production.json).
