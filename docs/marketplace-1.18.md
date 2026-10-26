# VISO Marketplace 1.18.0

El Marketplace incorpora una experiencia de tienda para web y Android: buscador amplio con el símbolo original de VISO, categorías, portada con carrusel opcional, catálogo, páginas completas de producto, demostraciones en video, carrito, compras, biblioteca y tiendas de creadores. Utiliza el fondo `#F5F3EF`, superficies blancas y acentos naranja. Los productos y precios provienen del catálogo publicado; las imágenes generadas durante el diseño son referencias visuales.

## Personalizar la tienda

Con una cuenta administradora, abrir **Marketplace → Cuenta → Administrar marketplace → Diseño del Marketplace**.

- **Carrusel:** activar o desactivar «Mostrar carrusel». Apagado, el catálogo se acomoda directamente debajo de los accesos de categorías. Se pueden configurar hasta ocho slides, sus imágenes o videos, textos, botón, destino y orden. El intervalo automático va de 3 a 30 segundos. Los clientes también pueden avanzar manualmente, deslizar y pausar.
- **Accesos de categorías:** elegir imagen, GIF o video; cambiar el nombre; mostrarlo u ocultarlo; cambiar el orden o desactivar un acceso. El destino sigue vinculado con la categoría correspondiente. «Creadores» abre el directorio de tiendas aprobadas.
- **Cabecera con latido:** activar el efecto, elegir de dos a ocho colores y ajustar la velocidad. Es un efecto decorativo de la tienda. Se respeta la preferencia del sistema de reducir movimiento.
- **Vista previa:** revisar los slides y accesos antes de guardar. «Restablecer diseño» carga los valores iniciales en el editor; «Guardar cambios» los aplica.

Los cambios se guardan en el servidor compartido y llegan a la web y a la APK que incorpora este diseño. Si otro administrador guarda durante la edición, la versión pendiente se conserva y se ofrece cargar la versión más reciente antes de sobrescribirla.

Las subidas usan el sistema de archivos verificado de VISO, con límite de 60 MB por archivo. Los ajustes aceptan solamente imágenes o videos registrados para la cuenta administradora o archivos ya retenidos en la configuración. Los nombres ocultos conservan una etiqueta accesible para navegar.

## Comprar, guardar y usar

La navegación móvil del Marketplace incluye **Tienda, Videos, Carrito, Biblioteca y Cuenta**. En escritorio los mismos destinos se encuentran en la cabecera. El menú adicional reúne favoritos, compras, espacio creador, documentación, administración según permisos y el regreso al panel VISO.

El carrito, los favoritos y las tiendas seguidas pertenecen a la cuenta autenticada. Los importes se consultan en el catálogo actual. Los productos retirados pueden quitarse del carrito. La tienda pública de cada creador muestra únicamente su perfil aprobado y sus publicaciones disponibles.

Los recursos gratuitos pueden agregarse desde el producto o desde el carrito. En la biblioteca, cada producto indica su destino: aplicar una imagen a una tecla, agregar una página al Deck, usar un fondo en Display, descargar un plugin o reproducir un sonido. Se conservan los diálogos y comprobaciones de instalación y las adquisiciones guardadas por versión.

Las fichas incluyen galería con miniaturas, fotografías y videos, ampliación, descripción, detalles, versiones, ayuda del creador, precio y acción adecuada. Solo se mantiene un medio principal activo; al ampliar un video se pausa el reproductor anterior. La sección Videos utiliza demostraciones publicadas en las galerías y permite abrir su producto.

## Cobros existentes

Se conserva la integración de Mercado Pago: el cobro integrado de esta etapa corresponde a recursos digitales y se completa por producto y vendedor. El carrito permite reunirlos y continuar cada compra con su vendedor. Los recursos pagados se habilitan cuando el servidor confirma el pago.

Los productos afiliados o con compra externa continúan en el sitio del vendedor, donde se confirma precio, disponibilidad, entrega y garantía. El hardware conserva esa modalidad hasta completar su logística y condiciones de venta integrada. Este cambio de diseño no activa cobros ni modifica credenciales, porcentajes o aprobaciones de pagos.

La administración anterior de publicaciones, creadores, revisión, importación de afiliados, archivos, documentación y cobros sigue disponible dentro de Administración/Espacio creador.

## Modelo de datos y compatibilidad

- `marketplaceStorefront`: configuración compartida, revisión y administrador responsable. Edición autorizada por el identificador inmutable de administrador existente.
- `marketplaceShopping`: carrito, favoritos y tiendas seguidas, con índice por usuario. Las escrituras obtienen el usuario de la sesión; no aceptan otro usuario ni precios del cliente.
- Las consultas de producto agregan la referencia pública de la tienda; la biblioteca incorpora una portada cuando está disponible. Los campos y acciones anteriores se conservan.
- El catálogo VISO Pulso incorpora demostraciones MP4 existentes. No se publican los equipos cuyo precio todavía es informativo.

La actualización no cambia las vistas operativas del Deck, Display, clima, reloj, deportes o vúmetro, ni la lógica de llamadas, Google Home o Timbre. Android conserva sus permisos, SDK Google Home, Firebase y firma anterior.

## Revisión y publicación

La versión Android es `1.18.0`, código `30`. El informe de validación y los artefactos de revisión se conservan en `artifacts/marketplace-redesign/` y `artifacts/android/`.

Esta implementación incorpora API nuevas y requiere publicar primero el servidor compartido correcto (`vivid-nightingale-785`), después la web y finalmente actualizar la descarga/QR de la APK. La APK de revisión utiliza ese servidor y necesita esa activación para cargar el nuevo Marketplace. La publicación se realiza después de la autorización correspondiente del propietario. El enlace estable de descarga continúa en 1.17.0 durante la preparación.

Las pruebas de navegador locales utilizan los componentes reales con cuentas y respuestas de prueba aisladas. Los permisos, archivos, configuración y datos de cuenta se verifican adicionalmente mediante las funciones reales en `convex-test`. Las pruebas no ejecutan cobros, llamadas, cambios de luces ni altas reales de usuarios. La instalación y el recorrido en un teléfono físico quedan para la prueba del propietario después de activar el servidor.

La validación final comprende 955 pruebas en 103 archivos, 123 comprobaciones de navegador en anchos de 320, 390, 844 y 1440 píxeles, y seis comprobaciones adicionales del recorrido para seguir y dejar de seguir tiendas. Pasaron TypeScript de cliente y servidor, ESLint de los archivos modificados y las compilaciones web y Android. La APK conserva el certificado de firma de 1.17.0. El detalle reproducible, hash y límites de la comprobación se registran en [`validation/marketplace-1.18.json`](validation/marketplace-1.18.json).
