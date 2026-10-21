# Marketplace VISO — 1.14.0

Versión publicada con autorización del propietario desde `fix/viso-deck-reference-layout`, fuente `6922286`. Se actualizó explícitamente el backend compartido `vivid-nightingale-785` y la web https://viso-deck-android.vercel.app en su proyecto existente. Las credenciales de Google se conservaron y los cobros permanecen desactivados.

## Catálogo y edición

El catálogo incluye Iconos, Plugins, Perfiles, Protectores, Sonidos, Hardware, Nuevo, Usados y Página. Una ficha de hardware puede aparecer en Hardware y en su condición Nuevo/Usados sin duplicar el producto. Los productos publicados muestran Gratis o importe y moneda; el hardware propio sin precio queda como borrador administrativo.

La administración puede editar todas las fichas, incluidas las originales de VISO. Los creadores aprobados editan las propias: título, descripción, categoría, precio, portada, archivos, galería, instrucciones, compatibilidad, versión, historial y soporte. Cambiar un producto publicado prepara una revisión; la versión pública anterior se conserva hasta su aprobación. Las bibliotecas guardan la versión adquirida y sus archivos.

Cada producto tiene dirección propia `/marketplace/products/:productId`. La ficha ofrece fotos ampliables, galería desplazable, videos verticales y horizontales sin deformar, descripción, información técnica e historial. Comparte el ancho del panel y mantiene la navegación adaptada al celular.

## Biblioteca y páginas

El fondo del Display permite elegir Mis archivos o Biblioteca, ver una previsualización y aplicar explícitamente una imagen, GIF o video. La copia pertenece a la cuenta del usuario; no modifica los fondos ni las acciones de las teclas. Se conserva la opción de quitar el fondo.

Las cuentas nuevas reciben Estados VISO y Clima. Las cuentas que ya tienen páginas conservan identificadores, orden, teclas y configuración. El marketplace ofrece Fútbol, Reloj, Clima y Spotify, inicialmente Gratis. Agregar una página guarda su configuración en la misma cuenta utilizada por la web y la APK. Una instalación repetida conserva la página existente; reemplazar sus ajustes requiere elegirlo expresamente.

Los creadores pueden ofrecer una configuración inicial de esas páginas nativas mediante las opciones JSON admitidas. VISO valida el contenido; no ejecuta scripts ni convierte un archivo subido en una aplicación externa. La guía dentro del marketplace explica formatos, dimensiones, compatibilidad, preparación, pruebas y publicación de cada categoría, con ejemplos descargables.

## Afiliados de Mercado Libre

La importación administrativa genera una vista previa editable y nunca publica por sí sola. Conserva el enlace de afiliado exacto y recupera los datos que el proveedor permita: título, descripción, precio, fotos, videos directos y disponibilidad. El usuario elige qué campos aplicar; actualizar la importación no reemplaza silenciosamente sus cambios. La fecha de importación queda registrada. Cuando un dato no está disponible se completa manualmente, sin inventar precios ni anunciar hardware gratuito.

La compra y la entrega de un producto afiliado se realizan fuera de VISO. No se agrega comisión de VISO ni se abre su checkout. El servidor de importación limita dominios, redirecciones, tamaño y tiempo de respuesta, y no envía credenciales a las páginas ni a sus redirecciones.

## Cobros preparados, sin activar

Mercado Pago queda desactivado mientras falten credenciales o configuración. Las comisiones de productos digitales y hardware se editan desde administración, sin porcentaje impuesto inicialmente. Cada compra guarda el importe y la comisión de ese momento; modificar una tasa sólo afecta compras futuras. Los productos propios de VISO no se descuentan comisión de plataforma.

El flujo preparado usa una cuenta vendedora por compra, vinculación OAuth del creador y confirmación desde el servidor. Volver del checkout no desbloquea archivos. Los recursos gratuitos y los enlaces afiliados no pasan por este cobro. No se realizaron cargos ni se vincularon cuentas reales durante la preparación.

El propietario indicó que incorporará las credenciales posteriormente. Antes de activar operaciones reales deben comprobarse la habilitación del reparto de Mercado Pago Argentina, el flujo de prueba y las políticas comerciales. Las [instrucciones de configuración](mercado-pago-marketplace-setup.md) permiten cargar credenciales y activar las pruebas sin cambiar código ni compilar otra APK. Los cobros integrados de esta etapa son para recursos digitales; el hardware conserva la compra externa mientras se prepara su proceso de entrega.

## Validación y publicación

La evidencia de esta versión se guarda en `docs/marketplace-1.14-evidence/`. Las comprobaciones autenticadas utilizan únicamente cuentas técnicas del servidor local. La compilación de Android conserva `com.viso.deck`, la firma de actualización y el SDK oficial de Google Home. Instalarla y probar sus funciones nativas en un teléfono físico requiere una comprobación posterior.

Pasaron **669 pruebas en 71 archivos**, TypeScript frontend/backend, ESLint de los archivos modificados, compilaciones web/Android y **21 pruebas JVM**. El [recorrido real en navegador](marketplace-1.14-evidence/browser-report.json) pasó **32 comprobaciones**: edición y moderación, versiones adquiridas, reproducción de videos en ambas proporciones, biblioteca del Display, nuevas cuentas, instalación de páginas y acceso desde otra sesión, además de vistas de 1440, 390 y 320 px sin errores de ejecución.

APK preparada: `downloads/VISO-Deck-1.14.0-debug.apk`, versionCode 25, 21.705.655 bytes, SHA-256 `1514066e4f7b1250e0b488716518393b9eafcf791df42b8287d9ddde0a8b0b10`. La [verificación del APK](marketplace-1.14-evidence/apk-report.json) confirma la firma existente, los permisos de 1.13.1 y el SDK Google Home incluido. No se afirma una prueba física ni una operación real con Mercado Pago o Mercado Libre.

## Publicación verificada

Vercel publicó el despliegue `dpl_2ce8tFtpCPRSz5bE9x5z1PnaudLy`, estado `READY`, con alias https://viso-deck-android.vercel.app. Los 74 archivos servidos coinciden por SHA-256 con la compilación revisada. La ruta permanente de producto devuelve la aplicación actual. La [evidencia de producción](marketplace-1.14-evidence/production-report.json) incluye los archivos y la descarga real del APK, que responde HTTP 200 y coincide con el artefacto firmado.

Pasaron [56 comprobaciones públicas en navegador](marketplace-1.14-evidence/production-browser-report.json) a 1440, 390 y 320 px, sin errores de ejecución: logo original visible, acceso Google/contraseña disponible, catálogo/ficha/documentación protegidos por sesión, siete plantillas descargables idénticas y cuatro portadas de páginas disponibles.

Se comprobó con consultas de sólo lectura que no hay cobros habilitados ni pedidos. Las variables privadas de Mercado Pago siguen ausentes. El webhook sin configurar responde 503 y no procesa pagos; la subida sin sesión responde 401 y el callback OAuth incompleto responde 400. Google sigue disponible y su autorización conserva el retorno HTTPS y PKCE. No se inició sesión de ningún cliente ni se modificaron luces o estados reales.

Se conserva la versión web anterior `dpl_Ek2yreo7PDATVwDzSHd3TXZtyR1w`, la fuente `b08bad2` y el APK 1.13.1 para recuperación. La nueva configuración de páginas y productos usa los campos existentes y ampliaciones opcionales; no se reemplazaron las cuentas ni los proyectos.
