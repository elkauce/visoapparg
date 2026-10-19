# Acceso con Google y otras cuentas

Esta versión incorpora el acceso con Google en la web, además del acceso existente con correo y contraseña. El botón se habilita al publicar el backend y el frontend cuando están configuradas ambas variables privadas de Google. No requiere crear otro proyecto VISO ni reemplazar las cuentas actuales.

## Cómo entrar y conservar la cuenta

- **Ya tenés VISO con contraseña:** entrá con tu correo y contraseña, abrí **Cuenta → Vincular Google** y elegí tu cuenta de Google. La vinculación conserva el mismo usuario, sus estados, páginas, dispositivos y configuración; no cambia el correo principal ni el nombre que editaste en VISO. Después podés entrar con Google o seguir usando tu contraseña.
- **Sos un usuario nuevo:** usá **Continuar con Google** desde el acceso o el registro. Google debe devolver un correo verificado.
- **Google ya está vinculado:** usá **Continuar con Google** para abrir la misma cuenta VISO.

Si el correo ya pertenece a una cuenta VISO con contraseña, el acceso directo con Google se rechaza y pide entrar con contraseña para vincularlo desde el panel. Las cuentas no se fusionan automáticamente por compartir un correo. Una identidad Google vinculada a otro usuario VISO tampoco se mueve a una cuenta distinta.

La vinculación requiere una solicitud explícita desde la sesión VISO autenticada y su verificador. El retorno de Google por sí solo no vincula cuentas. Si cancelás o vence el intento, iniciá la vinculación nuevamente desde Cuenta.

## Configuración de Google Web

1. Abrir [Google Auth Platform → Clientes](https://console.cloud.google.com/auth/clients) y seleccionar el proyecto **STATUS**.
2. Revisar si ya existe un cliente de tipo **Aplicación web**. Reutilizarlo cuando corresponda, conservando sus direcciones actuales. El cliente Android de Google Home no reemplaza un cliente web de inicio de sesión.
3. Agregar el origen autorizado `https://viso-deck-android.vercel.app`.
4. Agregar la redirección autorizada `https://vivid-nightingale-785.convex.site/api/auth/callback/google`.
5. Guardar el ID y secreto del cliente en las variables privadas del backend compartido Convex: `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`. **No enviar el secreto por el chat ni guardarlo como variable VITE.**
6. Comprobar marca VISO y audiencia/usuarios de prueba según el estado del proyecto. El retorno de la aplicación debe conservar `SITE_URL=https://viso-deck-android.vercel.app`.

Este acceso utiliza únicamente identidad básica (nombre, correo y perfil). No solicita autorización sobre las luces ni reemplaza el consentimiento de Google Home.

La APK conserva su acceso actual con correo y contraseña; esta entrega no incorpora un flujo Google nativo ni necesita una APK nueva. El botón web de Google no se ofrece dentro del WebView Android. Incorporar ese acceso a la APK requiere un retorno seguro desde un navegador externo, con su propia validación.

## Otras cuentas: pendientes

Microsoft, Facebook y Apple no están habilitados en esta versión. Requieren su configuración por el propietario y una implementación y verificación propias. Las redirecciones siguientes son las previstas para esos proveedores, no una confirmación de que ya funcionen.

| Cuenta | Configuración que necesita el propietario | Redirección autorizada |
| --- | --- | --- |
| Microsoft | [Registro de aplicación en Microsoft Entra](https://entra.microsoft.com), ID de aplicación y secreto. Elegir los tipos de cuenta admitidos; para usuarios personales y empresas se necesita la opción correspondiente. | `https://vivid-nightingale-785.convex.site/api/auth/callback/microsoft-entra-id` |
| Facebook | [Aplicación en Meta Developers](https://developers.facebook.com/apps/), Facebook Login, ID de aplicación y secreto. La configuración de desarrollo limita el acceso a roles/usuarios de prueba; completar los requisitos que Meta indique para hacerlo público. | `https://vivid-nightingale-785.convex.site/api/auth/callback/facebook` |
| Apple | [Apple Developer](https://developer.apple.com/account/), Sign in with Apple, Services ID web, Team ID, Key ID y clave privada `.p8`. Su secreto firmado necesita renovación. | `https://vivid-nightingale-785.convex.site/api/auth/callback/apple` |

Todos los secretos deben permanecer en el servidor, no en el frontend ni en el chat. Conviene verificar primero el acceso real con Google; Microsoft resulta útil para oficinas.

## Validación y mantenimiento

El adaptador de vinculación de `convex/auth.ts` está fijado al comportamiento de **`@convex-dev/auth` 0.0.96**. Usa el dispatcher interno de esa versión para diferir la vinculación hasta comprobar la sesión VISO original y el verificador del navegador. No actualizar esa dependencia, ni suprimir el adaptador, sin revisar su comportamiento y ejecutar estas pruebas:

- `convex/social_auth.test.ts`: alta Google, colisiones con contraseña, sesión original, verificador, caducidad, limpieza, repetición de códigos, conflictos de propietario y reversión completa si falla la confirmación.
- `src/components/google-auth-return.test.tsx`: hidratación de sesión, confirmación del vínculo, cancelación, errores y eliminación del código de la URL.
- `src/components/google-sign-in.test.tsx` y `src/lib/google-auth-flow.test.ts`: preparación explícita del vínculo, marcadores del intento, bloqueo de intentos dobles y exclusión de Android.
- Las pruebas existentes de contraseña, la suite completa y la compilación de frontend/backend.

Las pruebas automatizadas simulan un callback de Google ya verificado; no sustituyen la autorización con una cuenta real. Queda pendiente comprobar el recorrido real de consentimiento e inicio de sesión, tanto para un usuario nuevo como para una cuenta existente que vincula Google, y confirmar que vuelve a su mismo deck. No registrar códigos de retorno, tokens ni secretos durante esa comprobación.
