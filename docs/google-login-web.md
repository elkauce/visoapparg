# Google en el acceso web de VISO

Publicado el 19 de octubre de 2026 sobre `fix/viso-deck-reference-layout`, fuente `e9a0cb2`. No se modificó `main` ni se generó una APK nueva.

## Uso

Web: https://viso-deck-android.vercel.app

Una cuenta existente entra primero con su contraseña y abre **Cuenta → Vincular Google**. El consentimiento vuelve al mismo usuario VISO, conservando su correo principal, nombre editado, estados, páginas y dispositivos. Después puede entrar con **Continuar con Google** o con su contraseña. Los usuarios nuevos pueden elegir Google directamente en el acceso o registro.

Google exige un correo verificado. Una coincidencia de correo con una cuenta de contraseña no fusiona usuarios: se pide vincular desde la sesión existente. Una identidad Google perteneciente a otro usuario VISO no se transfiere. El vínculo solo se guarda al confirmar la sesión original y el verificador del navegador; cancelación, caducidad y repetición no deben borrar la sesión existente.

Google se ofrece en la web. La APK conserva contraseña y no abre este consentimiento dentro de su WebView. Microsoft, Facebook y Apple siguen pendientes. El permiso de identidad de Google no reemplaza ni modifica la autorización de Google Home.

## Publicación verificada

- Backend compartido existente: `vivid-nightingale-785`. Se seleccionó explícitamente mediante su archivo de despliegue; se añadieron dos tablas temporales y sus índices sin modificar datos de usuarios.
- Web Vercel: `dpl_D8zcb4jfBpZEGLKG6Wp1y2CaoxH6`, estado `READY`, alias público correcto.
- Índice, JavaScript y CSS públicos coinciden por SHA-256 con la compilación comprobada.
- Recuperación: fuente anterior `9bee887` y despliegue web anterior `dpl_67pNHWbvmZRUhn6jfQ8NtQ6K5YE2` conservados.

La autorización del servidor devuelve HTTP 302 a `accounts.google.com`, con retorno a `https://vivid-nightingale-785.convex.site/api/auth/callback/google`, PKCE S256 y únicamente `openid email profile`. Las variables privadas permanecen en Convex; no se copiaron a la web ni se registraron sus valores.

## Evidencia y límites

Pasaron 417 pruebas en 45 archivos, la compilación TypeScript/Vite, TypeScript de Convex, ESLint de los archivos modificados y `git diff --check`. Una revisión independiente no dejó hallazgos abiertos en el alcance revisado.

Las 52 comprobaciones del panel con contraseña usaron una cuenta técnica en un backend local aislado, en anchos 1440, 390 y 320. Comprobaron estados, Display, plugin, APK/QR, cuenta, editor, navegación y tema. No se activaron luces ni se usaron datos de usuarios reales.

En producción pasaron 23 comprobaciones de navegador: botón Google y contraseña disponibles en los tres tamaños, ausencia de desbordamiento y errores de ejecución, llamada del botón al inicio de autorización real del servidor, retorno configurado y recuperación tras cancelar. La navegación se detuvo en el servidor antes del selector de Google: este entorno no permite navegar a `accounts.google.com`. El destino del 302 se comprobó sin seguirlo.

**Todavía falta comprobar el consentimiento y retorno con una cuenta Google real**, tanto para alta nueva como para vincular una cuenta existente y verificar su mismo deck. Las pruebas de backend simulan un perfil ya verificado y no prueban ese consentimiento. No se afirma que el secreto haya completado un intercambio real de código OAuth hasta realizar esa prueba.

El adaptador depende del comportamiento de `@convex-dev/auth` 0.0.96. La configuración y las condiciones de mantenimiento están en [social-login-setup.md](social-login-setup.md).
