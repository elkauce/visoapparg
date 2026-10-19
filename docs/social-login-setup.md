# Acceso con Google y otras cuentas

VISO usa actualmente correo y contraseña con Convex Auth. El acceso social todavía no está activado. Se puede incorporar sobre el backend y las cuentas existentes, sin crear otro proyecto VISO.

## Google (recomendado para empezar)

1. Abrir [Google Auth Platform → Clientes](https://console.cloud.google.com/auth/clients) y seleccionar el proyecto **STATUS**.
2. Revisar si ya existe un cliente de tipo **Aplicación web**. Reutilizarlo cuando corresponda, conservando sus direcciones actuales. El cliente Android de Google Home no reemplaza un cliente web de inicio de sesión.
3. Agregar el origen autorizado `https://viso-deck-android.vercel.app`.
4. Agregar la redirección autorizada `https://vivid-nightingale-785.convex.site/api/auth/callback/google`.
5. Guardar el ID y secreto del cliente en las variables privadas del backend compartido Convex: `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`. **No enviar el secreto por el chat ni guardarlo como variable VITE.**
6. Comprobar marca VISO y audiencia/usuarios de prueba según el estado del proyecto. El retorno de la aplicación debe conservar `SITE_URL=https://viso-deck-android.vercel.app`.

Este acceso utiliza únicamente identidad básica (nombre, correo y perfil). No solicita autorización sobre las luces ni reemplaza el consentimiento de Google Home.

## Otras cuentas

| Cuenta | Configuración que necesita el propietario | Redirección autorizada |
| --- | --- | --- |
| Microsoft | [Registro de aplicación en Microsoft Entra](https://entra.microsoft.com), ID de aplicación y secreto. Elegir los tipos de cuenta admitidos; para usuarios personales y empresas se necesita la opción correspondiente. | `https://vivid-nightingale-785.convex.site/api/auth/callback/microsoft-entra-id` |
| Facebook | [Aplicación en Meta Developers](https://developers.facebook.com/apps/), Facebook Login, ID de aplicación y secreto. La configuración de desarrollo limita el acceso a roles/usuarios de prueba; completar los requisitos que Meta indique para hacerlo público. | `https://vivid-nightingale-785.convex.site/api/auth/callback/facebook` |
| Apple | [Apple Developer](https://developer.apple.com/account/), Sign in with Apple, Services ID web, Team ID, Key ID y clave privada `.p8`. Su secreto firmado necesita renovación. | `https://vivid-nightingale-785.convex.site/api/auth/callback/apple` |

Todos los secretos deben permanecer en el servidor, no en el frontend ni en el chat. Conviene incorporar y verificar Google primero; Microsoft resulta útil para oficinas.

## Conservar las cuentas actuales

Las cuentas de contraseña existentes no verifican actualmente el correo. No deben fusionarse automáticamente con otra identidad solo porque comparta la dirección de correo. Es necesario implementar un flujo de vinculación autenticada o verificación equivalente que conserve el mismo usuario, sus estados, páginas, dispositivos y configuración. Antes de activar un proveedor en producción, verificar alta de usuarios nuevos y vinculación de usuarios existentes.

Para habilitar también la APK hay que verificar el retorno desde el navegador externo a VISO. El consentimiento de Google no debe abrirse dentro del WebView.
