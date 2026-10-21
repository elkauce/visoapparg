import {
  Image,
  Monitor,
  Package,
  PanelsTopLeft,
  Plug,
  AudioLines,
  Sparkles,
  Store,
} from "lucide-react";

export type GuideCategory =
  | "icons"
  | "plugins"
  | "profiles"
  | "screensavers"
  | "soundboards"
  | "hardware"
  | "new"
  | "used"
  | "pages";
export type DownloadExample = { label: string; path: string; note: string };
type Guide = {
  id: GuideCategory;
  label: string;
  icon: typeof Image;
  introduction: string;
  format: string;
  dimensions: string;
  compatibility: string;
  prepare: string[];
  verify: string[];
  examples: DownloadExample[];
};

const productExample: DownloadExample = {
  label: "Ficha de producto · JSON",
  path: "/marketplace/creator-templates/ficha-producto-ejemplo.json",
  note: "Referencia para completar tu publicación; no publica ni importa automáticamente.",
};

export const CREATOR_GUIDES: Guide[] = [
  {
    id: "icons",
    label: "Iconos",
    icon: Image,
    introduction:
      "Imágenes y animaciones para personalizar las teclas sin cambiar su acción.",
    format: "PNG, JPG, WebP, GIF o AVIF. Videos MP4 o WebM.",
    dimensions:
      "Recomendado: 256 × 256 px, proporción 1:1. Dejá margen para que el título siga siendo legible.",
    compatibility:
      "VISO web y Android. El rendimiento de las animaciones depende del dispositivo; probá una versión optimizada.",
    prepare: [
      "Prepará los diseños con nombres claros y una portada del paquete.",
      "Para animaciones, usá bucles cortos; los videos de tecla se reproducen sin sonido.",
      "Indicá cuántos diseños y variantes incluye el paquete.",
    ],
    verify: [
      "Agregá el paquete a la biblioteca y probá cada archivo en una tecla.",
      "Comprobá la animación, el título y la acción en celular y escritorio.",
    ],
    examples: [
      {
        label: "Icono VISO de ejemplo · PNG",
        path: "/marketplace/originals/libre.png",
        note: "Imagen original de VISO, 256 × 256 px.",
      },
      {
        label: "Animación de ejemplo · GIF",
        path: "/marketplace/animated/libre.gif",
        note: "Ejemplo de bucle para una tecla.",
      },
    ],
  },
  {
    id: "plugins",
    label: "Plugins",
    icon: Plug,
    introduction:
      "Paquetes descargables para aplicaciones y dispositivos compatibles.",
    format:
      "ZIP, .streamDeckPlugin o .streamDeckProfile empaquetados como ZIP válido.",
    dimensions:
      "Portada clara y capturas de la interfaz real. Los videos de demostración pueden ser verticales u horizontales.",
    compatibility:
      "Declarar aplicación de destino, versión mínima, sistema operativo, dispositivo y permisos necesarios.",
    prepare: [
      "Construí el plugin con las herramientas oficiales de la aplicación de destino.",
      "Incluí instrucciones de instalación, configuración y soporte, sin credenciales personales.",
      "Subí el paquete como descarga. VISO no ejecuta ni instala código arbitrario del paquete.",
    ],
    verify: [
      "Probá la instalación y cada acción en la aplicación que declarás compatible.",
      "Comprobá la configuración inicial, los errores de conexión y la desinstalación.",
    ],
    examples: [
      {
        label: "Estructura de documentación · ZIP",
        path: "/marketplace/creator-templates/plugin-estructura-ejemplo.zip",
        note: "Plantilla de documentación: este ejemplo no es un plugin instalable.",
      },
    ],
  },
  {
    id: "profiles",
    label: "Perfiles",
    icon: PanelsTopLeft,
    introduction:
      "Distribuí una organización de teclas, recursos e instrucciones para un flujo de trabajo.",
    format:
      "JSON de hasta 512 KB, ZIP o .streamDeckProfile válido como paquete descargable.",
    dimensions:
      "Incluí una vista del perfil y especificá la cantidad de teclas, filas y páginas.",
    compatibility:
      "Indicá el editor o dispositivo de destino. El perfil nativo Deck Esencial de VISO tiene instalación directa; los JSON y ZIP de terceros se descargan con sus instrucciones.",
    prepare: [
      "Describí qué hace cada tecla y qué aplicaciones o recursos requiere.",
      "Incluí únicamente archivos que tengas permiso para distribuir.",
      "Publicá pasos completos para reproducir el perfil sin compartir tu cuenta.",
    ],
    verify: [
      "Seguí las instrucciones con una configuración nueva de prueba.",
      "Verificá que el perfil no dependa de rutas, tokens o identificadores privados.",
    ],
    examples: [
      {
        label: "Perfil documentado · JSON",
        path: "/marketplace/creator-templates/perfil-ejemplo.json",
        note: "Ejemplo de organización e instrucciones. El archivo no importa teclas automáticamente.",
      },
    ],
  },
  {
    id: "screensavers",
    label: "Protectores",
    icon: Monitor,
    introduction:
      "Fondos estáticos o en movimiento para el Display y la identidad visual de un espacio.",
    format: "PNG, JPG, WebP, GIF o AVIF; video MP4 o WebM.",
    dimensions:
      "Recomendado: 1920 × 1080 px horizontal o 1080 × 1920 px vertical. Conservá la proporción original.",
    compatibility:
      "Biblioteca del Display en VISO web y Android. El usuario elige ver completo o cubrir la pantalla, y si muestra su estado encima.",
    prepare: [
      "Prepará un fondo sin controles de interfaz incrustados.",
      "Optimizá el video para reproducción en bucle y agregá una portada.",
      "Evitá colocar texto esencial en los bordes; cada Display puede tener otra proporción.",
    ],
    verify: [
      "Aplicá el recurso desde Biblioteca en la configuración del Display.",
      "Probá orientación vertical y horizontal, ambos ajustes de imagen y quitar el fondo.",
    ],
    examples: [
      {
        label: "Fondo animado VISO · MP4",
        path: "/marketplace/screensavers/aurora.mp4",
        note: "Video ambiental horizontal preparado para repetirse.",
      },
    ],
  },
  {
    id: "soundboards",
    label: "Sonidos",
    icon: AudioLines,
    introduction:
      "Efectos, avisos y colecciones de audio para escuchar o descargar desde la biblioteca.",
    format: "WAV, MP3, OGG, M4A o WebM de audio.",
    dimensions:
      "Indicá duración, cantidad de pistas, formato y calidad. Para efectos breves, evitá silencios largos.",
    compatibility:
      "Reproducción y descarga desde la biblioteca; no cambia automáticamente los sonidos de notificación del sistema.",
    prepare: [
      "Normalizá los niveles para que los sonidos del paquete tengan un volumen consistente.",
      "Usá nombres descriptivos y una portada que represente la colección.",
      "Indicá la licencia de uso y si se permite usar los audios en emisiones o contenido comercial.",
    ],
    verify: [
      "Escuchá cada archivo y comprobá que no esté cortado ni distorsionado.",
      "Verificá la descarga y el formato en las plataformas declaradas.",
    ],
    examples: [
      {
        label: "Sonido VISO de ejemplo · WAV",
        path: "/marketplace/sounds/confirmar.wav",
        note: "Efecto sintetizado original de VISO.",
      },
    ],
  },
  {
    id: "hardware",
    label: "Hardware",
    icon: Package,
    introduction:
      "Equipos y accesorios físicos, con su información de compra, compatibilidad y entrega.",
    format:
      "Portada y galería de fotos, GIF o videos MP4/WebM. El hardware no se entrega como un archivo digital.",
    dimensions:
      "Mostrá frente, conexiones y dimensiones reales. Conservá las fotos y videos verticales u horizontales sin estirarlos.",
    compatibility:
      "Detallá alimentación, conectividad, sistemas compatibles, accesorios incluidos y requisitos de instalación.",
    prepare: [
      "Indicá Nuevo o Usado sobre la misma ficha de hardware, sin duplicar el producto.",
      "Completá el precio real, moneda, estado, garantía y condiciones de envío.",
      "Si todavía no definiste el precio, guardá un borrador antes de enviarlo a revisión.",
    ],
    verify: [
      "Comprobá que fotos, especificaciones, precio y condiciones correspondan al equipo real.",
      "Verificá el enlace de compra externo, cuando corresponda.",
    ],
    examples: [productExample],
  },
  {
    id: "new",
    label: "Nuevo",
    icon: Sparkles,
    introduction:
      "Equipos nuevos dentro del catálogo de hardware, sin crear otra ficha del mismo producto.",
    format:
      "La misma ficha de Hardware con condición Nuevo y su galería de imágenes y videos.",
    dimensions:
      "Fotografías nítidas del producto y sus accesorios, sin modificar la proporción.",
    compatibility:
      "Indicá modelo, versión, garantía, alimentación y compatibilidad comprobada.",
    prepare: [
      "Creá una ficha de hardware y elegí la condición Nuevo.",
      "Completá el precio real, moneda y opciones de compra.",
      "Describí qué recibe el comprador y cómo instalarlo.",
    ],
    verify: [
      "Revisá que el producto aparezca con la condición correcta y el mismo contenido en Hardware y Nuevo.",
      "Comprobá las condiciones de garantía, envío y disponibilidad.",
    ],
    examples: [productExample],
  },
  {
    id: "used",
    label: "Usados",
    icon: Store,
    introduction:
      "Oportunidades de equipos usados con información transparente del estado y de la compra.",
    format:
      "Fotos y videos reales del equipo, descripción, precio y enlace de compra cuando corresponda.",
    dimensions:
      "Incluí primeros planos de marcas de uso, conectores y accesorios. Admití fotos verticales y horizontales.",
    compatibility:
      "Indicá modelo, pruebas de funcionamiento, fallas conocidas, accesorios y condiciones de entrega.",
    prepare: [
      "Elegí la condición Usado sobre la ficha de hardware.",
      "Para afiliados de Mercado Libre, revisá y editá el borrador importado antes de publicarlo.",
      "Conservá el enlace afiliado completo. La compra afiliada se hace en Mercado Libre y no tiene comisión adicional de VISO.",
    ],
    verify: [
      "Compará el precio y la disponibilidad con la publicación de origen.",
      "Comprobá que la descripción no oculte daños y que el enlace abra el producto correcto.",
    ],
    examples: [productExample],
  },
  {
    id: "pages",
    label: "Página",
    icon: PanelsTopLeft,
    introduction:
      "Páginas completas del deck que el usuario puede agregar sin reemplazar sus páginas existentes.",
    format:
      "Plantilla nativa compatible elegida en el formulario: Fútbol, Reloj, Clima, Spotify o Vúmetro. La configuración inicial usa las opciones admitidas en JSON; no admite scripts ni una aplicación externa.",
    dimensions:
      "La página ocupa toda la pantalla. Probá orientación y legibilidad; los controles de configuración se abren con el gesto del deck.",
    compatibility:
      "VISO web y Android actualizados. Algunas funciones requieren permisos o aplicaciones compatibles; Spotify necesita su propia cuenta y servicio.",
    prepare: [
      "Seleccioná la plantilla nativa y completá sus opciones admitidas en la ficha.",
      "Para Vúmetro usá screenSettings con audioSource (microphone o music), visualizerStyle, color RGB hexadecimal y sensitivity entre 0.031622 y 31.623; la instalación no autoriza la captura de audio.",
      "Indicá qué ajustes incluye y cuáles elegirá el usuario después de agregarla.",
      "Documentá cualquier permiso, conexión o servicio externo necesario.",
    ],
    verify: [
      "Agregá la página desde una cuenta de prueba y comprobá que las páginas anteriores se conserven.",
      "Verificá la sincronización entre web y APK, la pantalla completa y la configuración del usuario.",
    ],
    examples: [
      {
        label: "Configuración Clima · JSON",
        path: "/marketplace/creator-templates/pagina-ejemplo.json",
        note: "Elegí Clima y pegá el contenido en «Configuración inicial de la página». No se sube ni ejecuta como un programa.",
      },
      {
        label: "Configuración Reloj · JSON",
        path: "/marketplace/creator-templates/pagina-reloj-ejemplo.json",
        note: "Elegí Reloj y pegá esta configuración para un reloj analógico.",
      },
      {
        label: "Configuración Fútbol · JSON",
        path: "/marketplace/creator-templates/pagina-futbol-ejemplo.json",
        note: "Elegí Fútbol y pegá esta configuración con competiciones de Argentina y Latinoamérica.",
      },
    ],
  },
];
