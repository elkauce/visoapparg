# VISO para Elgato Stream Deck 1.0

Instalador: `downloads/com.viso.deck.streamDeckPlugin`. Requiere Elgato Stream Deck **7.1 o posterior**, Windows 10+ o macOS 12+. Usa el SDK oficial de Elgato 3.0.2 y el Node.js 24 que provee Stream Deck; el usuario no necesita instalar Node.js.

1. Descargá el instalador en tu computadora y abrilo con el programa Stream Deck.
2. En VISO Deck 1.5, iniciá sesión con **tu cuenta**. Abrí la estrella → **Elgato Stream Deck** → **Descargar mi configuración para el plugin**. Android permite elegir dónde guardar el JSON; transferilo a tu computadora.
3. En el programa Elgato, arrastrá **VISO Deck → Estado VISO** a una tecla. Importá tu JSON y elegí el estado. Repetí en las teclas que quieras. Podés cambiar sus nombres y usar páginas/perfiles del propio programa Elgato.
4. Pulsá la tecla: la confirmación aparece solamente cuando el servidor VISO acepta el estado. Tu app y tus displays reciben el cambio por la sincronización existente.

Alternativa sin transferir JSON: desde la web VISO compatible con tu cuenta, copiá la URL de un estado de la sección Stream Deck y pegala en «Configurar con una URL de VISO» del plugin. La URL debe pertenecer al mismo backend de tu app: no mezcles cuentas o enlaces de otra instalación.

El instalador público no contiene usuarios, contraseñas ni tokens. El JSON y los ajustes/perfiles Elgato contienen tu **token personal revocable**: no los compartas ni los subas a GitHub. «Renovar token» en VISO revoca las configuraciones anteriores; después descargá/importá la nueva configuración.

No se escanean redes ni se modifican dispositivos. El plugin activa estados de la cuenta configurada mediante el endpoint existente HTTPS `/deck/set`; no proporciona luces o autorizaciones Google Home nuevas. Google Home conserva sus requisitos y pruebas físicas pendientes. No importa acciones Android, videos ni toda la distribución del Deck al hardware: cada tecla del plugin controla un estado elegido por el usuario.

## Desarrollo

Desde `streamdeck/`: `npm ci`, `npm test`, `npm run pack`. Versiones y dependencias están fijadas en `package-lock.json`; no modifica el lockfile del proyecto React. La compilación genera el bundle en `com.viso.deck.sdPlugin/bin/`. En entornos con proxy, usar `NODE_USE_ENV_PROXY=1` al validar/empaquetar con la CLI de Elgato; conservar la validación oficial de esquemas.

Se validó el paquete con la CLI oficial, la política de peticiones y el bundle mediante WebSocket con eventos de registro, título, pulsación confirmada y alerta. El servidor Elgato y HTTP de esas pruebas son fixtures explícitos. **La instalación en Windows/macOS y un Stream Deck físico todavía requieren una prueba del usuario.**
