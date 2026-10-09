# Dispositivos VISO en la APK

La interfaz de Android incluye **Vincular dispositivo VISO** y **Comprar dispositivos VISO** dentro de Dispositivos VISO. La dirección comercial se configura al compilar mediante `VITE_VISO_STORE_URL`. Debe ser una dirección HTTPS sin credenciales en la URL. Sin una URL comercial confirmada, la interfaz muestra «Catálogo próximamente» y no abre ninguna tienda.

La comunicación disponible está documentada por el **ejemplo** `src/lib/esp32-sketch.ts`: un ESP32 consulta cada cinco segundos `GET /public/status?slug=…&format=rgb` y aplica el color a una tira WS2812. No es evidencia del firmware que utilizan los aparatos físicos VISO. Este endpoint y sus formatos `hex`, `name` y JSON se conservan. La aplicación prepara el enlace público existente de la cuenta con `public_status.ensureMine` únicamente cuando el usuario lo solicita; no genera otro vínculo ni renueva el slug de un Display existente.

La comprobación de Android realiza una petición HTTPS al feed RGB y verifica el código HTTP y tres valores RGB válidos. Esta respuesta confirma que el feed de VISO respondió; **no confirma que un aparato físico esté conectado o haya aplicado el color**. La interfaz mantiene esa distinción, conserva el color de los estados compartidos entre web y APK y permite volver al Deck para controlarlos.

El ejemplo de firmware no anuncia identidad, nombre, disponibilidad, capacidades, descubrimiento ni comandos locales de configuración. El backend tampoco tiene registro de dispositivos VISO ni un endpoint de telemetría. Por eso esta versión no inventa descubrimiento Wi-Fi, QR, dispositivos vinculados, respuesta de hardware, controles WLED ni otro protocolo. La configuración del feed y su eliminación se realizan en los aparatos que admitan configurar la dirección de consulta. Quitar el feed del aparato lo desvincula sin revocar el Display ni cambiar otros aparatos de la cuenta.

Para completar detección, nombres, listado, conexión verificada, controles particulares y desvinculación desde Android hace falta el firmware o la documentación real del hardware VISO. No se ha ensayado un dispositivo físico en este entorno.

Se preservan las integraciones originales: la Key Light utiliza HTTP en el puerto 9123 desde el navegador; no se presenta como hardware VISO ni se abre tráfico HTTP general en la APK. Los webhooks de estado existentes continúan en el servidor. Home Assistant mantiene su configuración y controles seguros nativos independientes.

Las pruebas cubren la conservación del endpoint y formato, URLs comerciales ausentes o no seguras, rechazo de valores RGB inválidos y errores HTTP/red. Los tests de interfaz comprueban que no se prepara configuración ni se consulta la red automáticamente, y que una respuesta del feed nunca presenta un aparato como conectado. Estas pruebas no sustituyen una prueba de firmware y hardware reales.
