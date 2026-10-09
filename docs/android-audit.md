# Auditoría inicial de VISO Deck para Android

Fecha: 2026-10-09. Rama de trabajo: `feature/viso-deck-android`.
Base auditada antes de los cambios Android: commit
`2a515f5dd564bad5a939f10643d69757137c1a7b`.
Este documento describe lo que existía en esa base; las capacidades añadidas y
las pruebas de la APK se registran por separado. No se modificó producción para
esta auditoría.

## Fuentes y comparación del ZIP

El archivo disponible es `viso-codigo (2).zip`, en la raíz del repositorio. El
pedido menciona `viso-codigo (2)(2).zip`; se auditó el archivo realmente disponible
sin asumir que ambos nombres identifiquen revisiones distintas.
SHA-256 del ZIP:
`e06fc1505dfefa59f2e3d4d518f40dc8559a176ee47bad7c6310b4cda0cac120`.

El ZIP tiene 160 entradas, de las cuales 141 son archivos. Sus prefijos se
corresponden con el proyecto ejecutable en la raíz:

| Prefijo dentro de `viso-codigo/` | Ruta actual |
| --- | --- |
| `1-frontend-react/src/` | `src/` |
| `1-frontend-react/index.html` | `index.html` |
| `2-backend-convex/convex/` | `convex/` |
| `2-backend-convex/convex.json` | `convex.json` |
| `3-configuracion/` | Archivos de configuración en la raíz |

La comparación de los bytes del ZIP con los archivos del commit base dio
**120 archivos idénticos, 16 diferentes y 5 ausentes**. Los diez archivos
principales del frontend solicitados son idénticos; no hace falta reconstruir
su diseño. Los hashes siguientes muestran los primeros doce caracteres de
SHA-256; la clasificación se obtuvo comparando los bytes completos.

| Archivo actual | Resultado | SHA-256 ZIP | SHA-256 base |
| --- | --- | --- | --- |
| `src/pages/deck/page.tsx` | Idéntico | `13a166099459` | `13a166099459` |
| `src/pages/deck/_components/deck-key.tsx` | Idéntico | `c0fcfd55999f` | `c0fcfd55999f` |
| `src/pages/deck/_components/key-editor.tsx` | Idéntico | `2b0f60019d48` | `2b0f60019d48` |
| `src/pages/deck/_components/widget-tiles.tsx` | Idéntico | `76874c5911d5` | `76874c5911d5` |
| `src/pages/deck/_components/sports-dialog.tsx` | Idéntico | `daa67e64a15e` | `daa67e64a15e` |
| `src/pages/deck/_lib/resolve-key.ts` | Idéntico | `a119648b2e34` | `a119648b2e34` |
| `src/pages/deck/_lib/weather.ts` | Idéntico | `fa6e626818c2` | `fa6e626818c2` |
| `src/components/key-cap.tsx` | Idéntico | `3102bace37a7` | `3102bace37a7` |
| `src/components/status-screen.tsx` | Idéntico | `f1fe05017027` | `f1fe05017027` |
| `src/index.css` | Idéntico | `2bc46040af7b` | `2bc46040af7b` |
| `convex/statuses.ts` | Idéntico | `8a9afb026348` | `8a9afb026348` |
| `convex/deck_layout.ts` | Idéntico | `fc9174eda9f0` | `fc9174eda9f0` |
| `convex/deck_api.ts` | Idéntico | `4e1dd5d6f668` | `4e1dd5d6f668` |
| `convex/display.ts` | Idéntico | `55ad0b8b497d` | `55ad0b8b497d` |
| `convex/lights.ts` | Idéntico | `ff6f5fc90ba6` | `ff6f5fc90ba6` |
| `convex/media.ts` | Idéntico | `869ec855b17f` | `869ec855b17f` |
| `convex/schema.ts` | Diferente | `64092e15b7a5` | `557a21b75939` |
| `convex/http.ts` | Diferente | `871218e2ad2c` | `6e9ceb66423b` |

Los 16 archivos diferentes son `.gitignore`, `eslint.config.mjs`,
`vite.config.ts`, `pnpm-workspace.yaml`, `package.json`,
`convex/lib/current_user.ts`, `convex/http.ts`, `convex/schema.ts`,
`convex/users.ts`, `convex/auth.config.ts`, `index.html`, `src/App.tsx`,
`src/lib/site-url.ts`, `src/components/providers/default.tsx`,
`src/components/providers/convex.tsx` y `src/components/ui/signin.tsx`.

Los archivos ausentes del árbol actual pertenecían al acceso Hercules:
`src/pages/auth/callback-messages.ts`, `src/pages/auth/Callback.tsx`,
`src/pages/auth/Callback.test.tsx`, `src/hooks/use-auth.ts` y
`src/components/providers/auth.tsx`. Su ausencia corresponde a la migración
actual a Convex Auth, con email y contraseña propios. La base añade
`authTables`, mantiene `tokenIdentifier` como campo opcional para filas
antiguas y registra las rutas de Convex Auth en `convex/http.ts`. Las rutas
existentes para Display y Deck permanecen. Restaurar el sistema de
autenticación del ZIP revertiría trabajo posterior y no es parte de Android.

Para repetir la comparación sin verse afectado por cambios posteriores:

```bash
python3 - <<'PY'
import collections, pathlib, subprocess, zipfile
root = pathlib.Path.cwd()
base = '2a515f5dd564bad5a939f10643d69757137c1a7b'
counts = collections.Counter()
with zipfile.ZipFile(root / 'viso-codigo (2).zip') as archive:
    for entry in archive.infolist():
        if entry.is_dir():
            continue
        _, group, path = entry.filename.split('/', 2)
        result = subprocess.run(
            ['git', 'show', f'{base}:{path}'],
            cwd=root, capture_output=True,
        )
        outcome = 'missing' if result.returncode else (
            'identical' if result.stdout == archive.read(entry) else 'different'
        )
        counts[outcome] += 1
        print(outcome, path)
print(dict(counts))
PY
```

## Identidad visual que se conserva

`src/pages/deck/_components/deck-key.tsx` es el componente de tecla del Deck
publicado. `key-cap.tsx` se usa en el panel de estados de inicio y es una
referencia adicional, no un reemplazo de la pantalla `/deck`. Las dependencias
reutilizables incluyen `StatusIcon`, el catálogo `src/lib/status-icons.ts`,
`readableTextColor`, Motion, los diálogos Radix y las consultas/mutaciones
Convex. No existe hardware dibujado alrededor de `/deck`.

La referencia de código define:

- Fondo `oklch(0.135 0.006 270)` y tecla inactiva
  `oklch(0.18 0.008 270)` en `src/index.css`.
- Fuente principal `Bricolage Grotesque`, seguida de `Space Grotesk` y `Geist`.
- Esquinas `rounded-2xl`, icono original Lucide centrado con el color del estado,
  texto centrado y barra inferior de color de un cuarto de rem.
- Estado activo con **el color de ese estado**, texto calculado por contraste,
  sombra `0 0 48px -6px ${face.color}` y escala 1.02. La pulsación reduce la
  escala a 0.94.
- Cabecera con páginas, edición y pantalla completa. Los huecos muestran un
  `div` vacío; el botón de añadir aparece solamente durante la edición.

Los estados predeterminados del ZIP y la base actual coinciden:

| Posición inicial | Etiqueta | Color | Icono |
| --- | --- | --- | --- |
| 0 | Libre | `#22c55e` | `check-circle` |
| 1 | Ocupado | `#ef4444` | `ban` |
| 2 | En reunión | `#f59e0b` | `users` |
| 3 | En llamada | `#8b5cf6` | `phone` |
| 4 | Almuerzo | `#0ea5e9` | `utensils` |
| 5 | Ausente | `#64748b` | `moon` |
| 6 | Apagar | `#64748b` | `power` |

`convex/statuses.ts` crea los seis estados, y
`convex/deck_layout.ts:ensureDefault` copia los estados existentes según su
orden guardado y añade Apagar. Para usuarios existentes se respeta su orden,
sus colores y sus teclas; no se vuelve a sembrar la página.

Hay dos diferencias entre la descripción verbal del pedido y las fuentes:
el activo no utiliza naranja de forma universal, y Ausente es gris pizarra
`#64748b`, no un azul diferente. El código original y la publicación tienen
prioridad para conservar la identidad visual. Esta auditoría no cambió esos
colores ni sustituyó iconos.

## Publicación inspeccionada mediante operaciones de lectura

El 2026-10-09, `GET https://visoapparg.vercel.app/deck` respondió HTTP 200.
Se leyeron sus recursos públicos:

| Recurso publicado | SHA-256 |
| --- | --- |
| `/assets/index-pij9KysA.js` | `57e827cabe7cac1c92b9f6d88dd82bc7d32979098b74dbbd12cce033b5be8350` |
| `/assets/index-DSrtMHts.css` | `b4621c4571c36081b9f0a652a322ea2c7af3033e68f291c18c85e540eda1a432` |

El JavaScript publicado contiene la misma sombra activa que utiliza
`face.color`, el mismo componente de tecla y la cuadrícula de la base. El CSS
publicado contiene la fuente `Bricolage Grotesque`. El HTML carga las fuentes
de Google Fonts. Esta inspección verifica recursos estáticos; no demuestra
una sesión autenticada, un estado concreto guardado ni equivalencia visual
de una APK. Las capturas equivalentes y las pruebas de interacción se deben
evaluar con su evidencia independiente.

## Capacidades existentes y límites antes de Android

| Área | Implementación reutilizable | Límite de la base auditada |
| --- | --- | --- |
| Estados y sincronización | `statuses.list` reactivo; `statuses.setActive` espera la mutación y valida propietario; `public_status.getPublicStatus` reactivo para Display | Falta indicador específico del estado de conexión y protección explícita frente a pulsaciones simultáneas en `/deck` |
| Layout | `deckPages`/`deckKeys` por usuario, `ensureDefault`, crear/borrar/renombrar página, guardar/borrar tecla | Frontend fijo 15 teclas, 5 columnas; backend `SLOTS_PER_PAGE = 15`, máximo 8 páginas; no duplicación ni reordenación de páginas |
| Editor | Tipos estado, apagar, enlace, carpeta, reloj, clima, deportes y volumen del Display; nombre/icono/color para enlaces/carpetas; guardar/cancelar/eliminar | No imágenes o videos propios de cada tecla, ni mover teclas desde el editor; los estados tienen su editor independiente en inicio |
| Media | `MediaField` y `convex/media.ts` guardan imagen/video de hasta 60 MB en un estado; GIF puede tratarse como imagen compatible | El archivo es fondo del Display, no imagen de tecla ni Canvas compartido |
| Display | Ruta `/s/:slug`, color/icono/media, volumen reactivo y pantalla completa | Pantalla pública independiente sin botones de edición; conservar ese comportamiento |
| Multimedia | `display.adjustVolume` modifica volumen de videos del Display | No modifica volumen del sistema Android ni controla Spotify u otras aplicaciones |
| Páginas y carpetas | Navegación entre páginas y enlace de carpeta a página propia | No cuadrícula configurable 6/32 ni disposición persistida por página |
| Android | Frontend React compatible con interacción táctil | No proyecto nativo, módulo Kotlin o APK en el commit base |
| Automatizaciones | `setActiveStatus` centraliza activación y programa los webhooks configurados | No motor de secuencias de acciones ni resultado remoto persistido por operación |
| VISO Canvas | `src/lib/deck-canvas.ts` dibuja nombre/color de una tecla LCD de hardware físico | No implementación de imagen/animación continua repartida entre varias teclas |

Las suscripciones de Convex proporcionan la base para reflejar cambios desde
otros clientes. El comportamiento ante pérdida de Wi-Fi, reconexión,
orientación y varias pulsaciones requiere pruebas específicas en Android;
la existencia del SDK no prueba esas condiciones por sí sola.

## Integraciones: estado honesto de la base

| Integración | Código encontrado | Estado demostrable |
| --- | --- | --- |
| VISO/Convex | Mutaciones con permisos y consultas reactivas, cuentas Convex Auth propias | Implementación existente; la auditoría no ejecutó acciones contra producción |
| Google Home oficial Android | No SDK oficial, vinculación ni descubrimiento en la base | Pendiente de configuración e implementación oficial; ningún dispositivo descubierto |
| RGB vía servicios del usuario | `homeWebhookUrl`, webhook por estado, payload con color/rgb/off | Configurable vía webhook; URL guardada no demuestra lámpara conectada |
| Elgato Key Light | `src/lib/key-light.ts`, PUT local a puerto 9123, brillo/temperatura/on | Control de luz blanca existente, no RGB; no lámpara disponible para prueba |
| Stream Deck físico | `@elgato-stream-deck/webhid`, `src/hooks/use-physical-deck.ts` y pintado LCD | Requiere navegador con `navigator.hid` y dispositivo autorizado; no validado como USB nativo Android |
| Software Stream Deck | `convex/deck_api.ts`, `/deck/set`, tokens revocables y acción Sitio web | API de activación existente; no implica plugin Elgato SDK encontrado |
| Stream Deck Mobile | Sin cliente incrustado ni emulación de hardware en la base | Aplicación oficial independiente; integración por verificar |
| Acciones Android | No código nativo en la base | No disponibles hasta implementar y probar APIs/permisos concretos |

`convex/lib/activate_status.ts` programa avisos de webhook después de guardar
el estado. `convex/lights.ts:fireWebhook` informa fallos en el servidor y
devuelve `null`; la confirmación de la mutación no confirma que una lámpara
remota cambió. La prueba existente dice «Enviado: mira si cambió tu luz».
Debe mantenerse esta distinción al presentar el estado de integración.

El componente `LightSync` se monta en `src/pages/Index.tsx`, no en la pantalla
Deck original. Depende de acceso HTTP a la LAN, y sus parámetros de Elgato Key
Light son temperatura/brillo, sin RGB. No se cambió la política de conexiones
de Android para asumir que esa integración funciona.

## Búsqueda del plugin anterior de Elgato

Se investigan repositorios y referencias mediante operaciones de lectura. El
ZIP y la raíz contienen la API de activación y el soporte WebHID, pero no un
paquete de plugin de Elgato con manifest y SDK. La integración de hardware y
la API existente se deben conservar separadas del Deck Android.

El acceso Git al repositorio seleccionado funciona: `git ls-remote origin HEAD`
devolvió el commit base. La consulta de listado `gh api users/elkauce/repos`
respondió 403 Forbidden. La credencial inyectada existente fue utilizada sin
imprimir su valor; no se pidió ni copió un token privado. Que Git funcione para
este repositorio no demuestra acceso API a otros repositorios privados.

La página pública de GitHub de `elkauce` respondió HTTP 200 y mostró
`elkauce/visoapparg` y `elkauce/DeX-Bridge`. La lectura Git de DeX-Bridge también
funciona y devolvió `bf37255671be23ca40612b8106645fc27bdcaf07`. La descripción de
DeX-Bridge corresponde a teclado/mouse PC y DeX, y su README estaba vacío. Una
segunda página pública no mostró otros repositorios; la búsqueda pública
`owner:elkauce viso` mostró únicamente `visoapparg`. Una consulta directa a la
API confirmó `Tunnel connection failed: 403 Forbidden`, por lo que no se
concluye que las credenciales sean inválidas ni que no exista un proyecto
privado.

**El repositorio del plugin VISO anterior no quedó localizado.** Hará falta la
URL exacta o acceso al catálogo para encontrarlo y validar su comunicación con
Display. La lectura Git de esa URL debe intentarse con la autenticación
existente antes de solicitar credenciales. La documentación actual de
`src/pages/_components/stream-deck-panel.tsx` utiliza la acción oficial «Sitio
web» y `convex/http.ts` expone `/deck/set`; esto demuestra una vía de activación,
no una implementación de plugin SDK.

No se enviaron mensajes a terceros, no se instalaron controladores virtuales y
no se modificó producción. No se probaron hardware Elgato, el plugin anterior
ni Stream Deck Mobile en esta auditoría.
