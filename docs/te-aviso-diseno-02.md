# Te Aviso · diseño 02 implementado

27 de octubre de 2026. **Preparado para revisión; no publicado.**

El propietario eligió la alternativa «02 · Producto conectado». Se aplicó al
frontend real de Te Aviso y se preparó la APK de revisión 1.0.1. La selección
aprueba implementar el diseño; se mantiene la indicación anterior de pedir
una autorización expresa antes de actualizar producción.

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

La APK está en `artifacts/teaviso-android/Te-Aviso-1.0.1.apk`, ignorada por Git.
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

## Publicación pendiente

1. Obtener autorización de publicación y renovar la sesión de Vercel (la CLI
   informó sesión cerrada). No se cambió el proyecto ni se inició un login nuevo.
2. Publicar el backend compatible de `vivid-nightingale-785` para la nueva consulta.
   No requiere migrar datos ni modificar planes, pagos o credenciales.
3. Publicar solo el frontend del proyecto **teaviso**, sin usar la vinculación
   `.vercel` raíz de VISO. Verificar rutas y archivos HTTPS.
4. Distribuir la APK 1.0.1 y comprobar acceso, QR y recepción con un celular físico.

No se actualizó ningún servidor, web pública, QR de descarga ni cuenta real. No se
hicieron llamadas, enviaron mensajes ni realizaron pagos. VISO conserva su web y
su APK anteriores.
