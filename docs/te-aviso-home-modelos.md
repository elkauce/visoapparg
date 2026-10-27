# Te Aviso · propuesta del home con modelos separados

27 de octubre de 2026. **Propuesta visual para revisión; no publicada.**

El propietario pidió un home que defina con claridad los modelos acordados,
muestre imágenes antes de publicar e incorpore el requisito de cercanía en Hogares.
Se conserva fondo #F5F3EF, naranja #E84300, el icono original VISO y marca Te Aviso,
sin atribución visible «por VISO».

## Recorrido visual

1. Portada: «Tu puerta. En tu celular». Foto ilustrativa existente de placa vertical
   compacta junto a una puerta. El halo y el aviso laten suavemente con los colores
   de la marca; se respeta movimiento reducido.
2. Cómo funciona: elegir recepción, colocar QR, recibir visitas.
3. Dos modelos: WhatsApp propio, con QR básico sin cargo y mejoras opcionales; y
   Te Aviso Digital, con atención dentro de la app y sin publicar el teléfono.
   Cada uno explica qué aplicación utiliza el visitante y si se comparte el número.
4. Tres espacios mediante pestañas: Hogares, Negocios/consultorios y Edificios.
   En Hogares se representa la cercanía del visitante; el propietario puede atender
   desde cualquier lugar. Negocios muestra agenda y Edificios un directorio de ejemplo.
5. Tres planes de Digital para hogares: Avisos, Videollamada y Familia.
   WhatsApp se distingue de esos planes. Negocios y Edificios solicitan una propuesta.
6. Carteles separados: QR, dirección vertical compacta y profesional con matrícula.
   Se mantienen explícitamente como ejemplos de diseño y presupuestos físicos.
7. Preguntas frecuentes y acceso para elegir el modelo. Navegación inferior en móvil.

La ampliación posterior incorpora una página de Planes con las funciones actuales
auditadas y un enlace desde el home: [detalle del catálogo](te-aviso-planes-funciones.md).
La portada aprobada mantiene su distribución; los paquetes y servicios se explican
en la nueva página sin activar ninguna prestación comercial.

## Capturas

- [Inicio en computadora](design/te-aviso-home-modelos/home-1440-inicio.png).
- [Inicio en celular](design/te-aviso-home-modelos/home-390-inicio.png).
- [Separación de modelos](design/te-aviso-home-modelos/home-1440-modelos.png).
- [Hogares y cercanía](design/te-aviso-home-modelos/home-1440-hogares.png).
- [Negocios](design/te-aviso-home-modelos/home-1440-negocios.png).
- [Edificios](design/te-aviso-home-modelos/home-1440-edificios.png).
- [Planes digitales](design/te-aviso-home-modelos/home-1440-planes.png).
- [Carteles](design/te-aviso-home-modelos/home-1440-carteles.png).
- [Home completo para computadora](design/te-aviso-home-modelos/home-1440-completo.png).
- [Home completo para celular](design/te-aviso-home-modelos/home-390-completo.png).

Las imágenes son capturas reales de un prototipo HTML/CSS local. No son capturas
del sitio publicado ni prueban que las funciones propuestas estén activas.

## Condiciones pendientes antes de implementar o publicar

Los precios ARS 36.000 / 48.000 / 80.000 representan los objetivos propuestos en
la conversación a partir de la captura de Bellify. **No están aprobados como
tarifa comercial ni cargados en el servidor.** No se promete servicio perpetuo ni
una duración que todavía no se definió. La vigencia requiere acordarse y evaluar
costos de operación. Las placas, integrantes y envío también son propuestas: los
3/6 integrantes y 1/2 placas mostrados no cambian ninguna licencia existente.

La geolocalización es una representación visual del requisito de Hogares. Este
trabajo **no recoge ubicación, valida distancias ni habilita un control de cercanía**.
Antes de publicitarlo en producción se necesita implementar y probar permisos,
precisión, radio, validación del servidor y tratamiento de datos de ubicación.
El límite opera sobre nuestro acceso desde QR: no impide contactar por WhatsApp
fuera del portal una vez conocido el teléfono. No garantiza presencia física
contra ubicación falsificada. El mapa es un ejemplo gráfico sin dirección real.

Los ejemplos de agenda y unidades no son datos de clientes. Los QR de los carteles
del prototipo se generan con un dominio `.invalid`; no sirven para llamar o comprar.
La foto del cartel es la ilustración existente y no acredita stock fabricado.

## Reproducción y comprobación

Desde la raíz del repositorio:

```sh
node docs/design/te-aviso-home-modelos/server.mjs
```

Abrir `http://127.0.0.1:5211`. El prototipo sirve solo sobre loopback y no conecta
con Convex, Vercel, Google, Mercado Pago ni servicios de geolocalización.
Los botones de contratación/login muestran un diálogo de vista previa.
La página completa de planes se revisa en `http://127.0.0.1:5211/planes.html`.
Para regenerar ambos documentos se puede ejecutar
`node docs/design/te-aviso-home-modelos/build.mjs` desde la raíz del repositorio.

Se comprobaron 320, 390, 768 y 1440 px: sin desbordamiento horizontal, imágenes
cargadas, pestañas con teclado, navegación móvil, preguntas desplegables y diálogo
de propuesta. Sin errores de JavaScript ni solicitudes externas.

No se modificó código de la aplicación, backend, datos ni planes. No se compiló
APK ni se publicaron frontend o funciones. El prototipo y estas imágenes quedan
separados de los directorios de compilación de la aplicación.

[Informe local](validation/te-aviso-home-modelos.json).
