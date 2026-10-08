# VISO

Copia independiente con React, Vite y Convex. El registro, inicio y cierre de sesión usan email y contraseña propios con Convex Auth. No requiere Hercules.

## Desarrollo local

Necesitas Node.js 24 y pnpm 11.19.0.

```bash
pnpm install --frozen-lockfile
CONVEX_AGENT_MODE=anonymous pnpm dev:backend
```

Deja el backend abierto. En otra terminal, prepara la autenticación y arranca el frontend:

```bash
pnpm setup:local-auth
pnpm dev
```

Convex crea `.env.local` y conserva la base de datos en `.convex/local/default/`. Las claves de firma se generan localmente, se guardan en el backend y se reutilizan en posteriores arranques; no se imprimen ni forman parte del código versionado. Puedes crear tu cuenta desde **Entrar → Crear cuenta**. Este flujo funciona sin cuenta de Convex ni proveedor de autenticación externo.

El frontend usa `VITE_CONVEX_URL`; los enlaces a las acciones HTTP del backend usan `VITE_CONVEX_SITE_URL`. En local, sus puertos son 3210 y 3211. El frontend usa el puerto 5173.

## Verificación

```bash
pnpm test
pnpm build
pnpm lint
```

Las pruebas cubren el formulario de autenticación y el aislamiento de datos por usuario. El backend conserva las funciones de estados, luces, enlaces públicos y Stream Deck de la copia original.

El ZIP original permanece en el repositorio como referencia. El proyecto ejecutable está ahora en la raíz. Los usuarios y contraseñas de servicios anteriores no se importan automáticamente; esta copia registra sus propias cuentas. El envío de correos para recuperar o verificar contraseñas no está configurado.

## Ver la aplicación online

Publicar el entorno de Codex guarda la configuración de desarrollo. Para obtener una URL pública de la aplicación, puedes alojar la web en [Vercel](https://vercel.com) y el backend en [Convex Cloud](https://dashboard.convex.dev). La autenticación sigue usando tus propias cuentas de email y contraseña.

1. Crea tus cuentas en Vercel y Convex. Sube a GitHub el proyecto ejecutable de la raíz, incluidos `package.json`, `pnpm-lock.yaml`, `src/`, `convex/` y `vercel.json`. El ZIP por sí solo no permite desplegar la aplicación. Los archivos `.env.local`, `.convex/` y `node_modules/` quedan fuera del código publicado.
2. En una copia del proyecto en tu ordenador, con Node.js 24 y pnpm 11.19.0, instala y vincula un proyecto propio de Convex Cloud:

   ```bash
   pnpm install --frozen-lockfile
   pnpm exec convex dev --configure --dev-deployment cloud --once
   ```

   Inicia sesión cuando lo indique el asistente y elige crear un proyecto. Este comando configura el backend de desarrollo en la nube. En el panel de Convex, selecciona el despliegue **Production** y copia sus dos URLs: la de API termina en `.convex.cloud` y la de acciones HTTP termina en `.convex.site`.

3. En Vercel, importa el repositorio de GitHub con la raíz del proyecto y selecciona **Node.js 24**. `vercel.json` configura Vite, la compilación y las rutas `/deck` y `/s/:slug`. Añade estas variables para **Production**, usando las URLs de producción de Convex:

   | Variable en Vercel | Valor |
   | --- | --- |
   | `VITE_CONVEX_URL` | URL de API de producción, `https://<despliegue>.convex.cloud` |
   | `VITE_CONVEX_SITE_URL` | URL de acciones HTTP de producción, `https://<despliegue>.convex.site` |

   Pulsa **Deploy** y copia la URL pública asignada por Vercel. El acceso y los datos estarán disponibles después del siguiente paso.

4. En la misma terminal del paso 2, configura Convex Auth en producción con su herramienta oficial instalada y publica las funciones. Sustituye la URL de ejemplo por la URL real de Vercel:

   ```bash
   node node_modules/@convex-dev/auth/dist/bin.cjs --prod --web-server-url https://tu-app.vercel.app
   pnpm exec convex deploy
   ```

   La herramienta configura `SITE_URL` y genera `JWT_PRIVATE_KEY` y `JWKS` nuevos en el backend de producción. Los archivos de autenticación y rutas HTTP ya están preparados en esta copia; conserva su contenido cuando el asistente los revise. Si las claves de producción ya existen, conserva las existentes. `pnpm setup:local-auth` prepara únicamente el backend local.

5. Abre la URL de Vercel y usa **Entrar → Crear cuenta**. Las cuentas y datos de esta base de producción comienzan vacíos. Comprueba también un enlace público `/s/:slug` recargando directamente esa dirección.

Los cambios del frontend se publican al actualizar la rama conectada a Vercel. Para publicar cambios de `convex/`, ejecuta de nuevo `pnpm exec convex deploy` desde la copia vinculada al proyecto de Convex Cloud. Si cambias el dominio público, actualiza `SITE_URL` en las variables de producción de Convex.

Referencias: [Convex en producción](https://docs.convex.dev/production) y [configuración de Convex Auth](https://labs.convex.dev/auth/setup/manual).
