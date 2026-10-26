import type { MarketplacePageSettings } from "./marketplace_page_templates";

/** First-party resources owned by VISO. No external seller or purchase is implied. */
export type MarketplaceCategory =
  | "icons"
  | "plugins"
  | "profiles"
  | "screensavers"
  | "soundboards"
  | "hardware"
  | "used"
  | "new"
  | "pages";

export type MarketplacePageTemplate =
  "football" | "clock" | "weather" | "spotify" | "visualizer";

export type BuiltinMarketplaceAsset = {
  id: string;
  name: string;
  mediaType: "image" | "video" | "audio" | "archive" | "profile";
  builtinPath: string;
  mimeType?: string;
};

export type BuiltinProduct = {
  id: string;
  title: string;
  description: string;
  category: MarketplaceCategory;
  creatorName: "VISO";
  coverPath: string;
  priceMode: "free" | "external" | "info" | "paid";
  priceAmount?: number;
  currency?: "ARS" | "USD";
  condition?: "new" | "used";
  delivery: "assets" | "profile" | "plugin" | "inquiry" | "page";
  profileTemplate?: "essential";
  pageTemplate?: MarketplacePageTemplate;
  pageSettings?: MarketplacePageSettings;
  details?: {
    type?: string;
    device?: string;
    os?: string;
    compatibility?: string;
    size?: string;
    version?: string;
    language?: string;
    supportUrl?: string;
    included?: string;
    setup?: string;
  };
  changelog?: { version: string; date: string; notes: string }[];
  gallery?: {
    id: string;
    name: string;
    mediaType: "image" | "video";
    builtinPath?: string;
    externalUrl?: string;
  }[];
  externalUrl?: string;
  assets: BuiltinMarketplaceAsset[];
};

const stateNames = [
  ["libre", "Libre"],
  ["ocupado", "Ocupado"],
  ["reunion", "Reunión"],
  ["llamada", "Llamada"],
  ["no-molestar", "No molestar"],
  ["ausente", "Ausente"],
] as const;

const utilityNames = [
  ["musica", "Música"],
  ["clima", "Clima"],
  ["deportes", "Deportes"],
  ["camara", "Cámara"],
  ["microfono", "Micrófono"],
  ["pausa", "Pausa"],
] as const;

export const BUILTIN_MARKETPLACE_PRODUCTS: BuiltinProduct[] = [
  {
    id: "viso-original-icons",
    title: "VISO Originales",
    description:
      "12 imágenes originales para tus teclas: seis estados y seis funciones. Acabado oscuro, luz de color y PNG de 256 × 256. La imagen no cambia la acción de la tecla.",
    category: "icons",
    creatorName: "VISO",
    coverPath: "/marketplace/covers/original-icons.png",
    priceMode: "free",
    delivery: "assets",
    assets: [...stateNames, ...utilityNames].map(([id, name]) => ({
      id: `${id}-png`,
      name,
      mediaType: "image" as const,
      builtinPath: `/marketplace/originals/${id}.png`,
      mimeType: "image/png",
    })),
  },
  {
    id: "viso-living-icons",
    title: "VISO Pulso",
    description:
      "Los seis estados VISO con un halo que respira suavemente. Incluye cada diseño como GIF animado y video MP4 silencioso, listos para reproducirse en la tecla.",
    category: "icons",
    creatorName: "VISO",
    coverPath: "/marketplace/covers/living-icons.png",
    gallery: [
      {
        id: "pulso-cover",
        name: "Los seis estados VISO",
        mediaType: "image",
        builtinPath: "/marketplace/covers/living-icons.png",
      },
      {
        id: "pulso-video",
        name: "VISO Pulso en movimiento",
        mediaType: "video",
        builtinPath: "/marketplace/animated/libre.mp4",
      },
      {
        id: "pulso-ocupado",
        name: "Ocupado animado",
        mediaType: "video",
        builtinPath: "/marketplace/animated/ocupado.mp4",
      },
    ],
    priceMode: "free",
    delivery: "assets",
    assets: stateNames.flatMap(([id, name]) => [
      {
        id: `${id}-gif`,
        name: `${name} · GIF`,
        mediaType: "image" as const,
        builtinPath: `/marketplace/animated/${id}.gif`,
        mimeType: "image/gif",
      },
      {
        id: `${id}-mp4`,
        name: `${name} · Video`,
        mediaType: "video" as const,
        builtinPath: `/marketplace/animated/${id}.mp4`,
        mimeType: "video/mp4",
      },
    ]),
  },
  {
    id: "viso-essential-profile",
    title: "Deck Esencial",
    description:
      "Agregá una nueva página de seis teclas: Libre, Ocupado, Reunión, Llamada, No molestar y Ausente. Conservá las páginas y configuraciones que ya tenés.",
    category: "profiles",
    creatorName: "VISO",
    coverPath: "/marketplace/covers/essential-profile.png",
    priceMode: "free",
    delivery: "profile",
    profileTemplate: "essential",
    assets: [],
  },
  {
    id: "viso-ambient-screen",
    title: "Aurora VISO",
    description:
      "Un video ambiental original de seis segundos con luces verdes, violetas y azules en movimiento. MP4 horizontal, silencioso y preparado para repetirse como fondo del Display.",
    category: "screensavers",
    creatorName: "VISO",
    coverPath: "/marketplace/covers/ambient-screen.png",
    gallery: [
      {
        id: "aurora-cover",
        name: "Aurora VISO",
        mediaType: "image",
        builtinPath: "/marketplace/covers/ambient-screen.png",
      },
      {
        id: "aurora-demo",
        name: "Aurora en movimiento",
        mediaType: "video",
        builtinPath: "/marketplace/screensavers/aurora.mp4",
      },
    ],
    priceMode: "free",
    delivery: "assets",
    assets: [
      {
        id: "aurora-mp4",
        name: "Aurora · Video ambiental",
        mediaType: "video",
        builtinPath: "/marketplace/screensavers/aurora.mp4",
        mimeType: "video/mp4",
      },
    ],
  },
  {
    id: "viso-soft-sounds",
    title: "Señales suaves",
    description:
      "Tres sonidos sintetizados originales: Confirmar, Atención y Pausa. Archivos WAV cortos para descargar o escuchar desde tu biblioteca; no modifican las notificaciones del sistema.",
    category: "soundboards",
    creatorName: "VISO",
    coverPath: "/marketplace/covers/soft-sounds.png",
    priceMode: "free",
    delivery: "assets",
    assets: [
      ["confirmar", "Confirmar"],
      ["atencion", "Atención"],
      ["pausa", "Pausa"],
    ].map(([id, name]) => ({
      id: `${id}-wav`,
      name,
      mediaType: "audio" as const,
      builtinPath: `/marketplace/sounds/${id}.wav`,
      mimeType: "audio/wav",
    })),
  },
  {
    id: "viso-stream-deck",
    title: "VISO para Stream Deck",
    description:
      "Controlá tus estados desde Elgato Stream Deck. Descargá el plugin listo con tus teclas y tu configuración desde Conexiones.",
    category: "plugins",
    creatorName: "VISO",
    coverPath: "/marketplace/covers/stream-deck.png",
    priceMode: "free",
    delivery: "plugin",
    assets: [],
  },
  {
    id: "viso-page-football",
    title: "Fútbol",
    description:
      "Resultados, partidos anteriores, favoritos y competiciones de Argentina, Latinoamérica y el mundo. Agregá la página deportiva de VISO a tu deck; tus elecciones se guardan en tu cuenta. La disponibilidad de estadísticas y alineaciones depende de la competición y del proveedor de datos.",
    category: "pages",
    creatorName: "VISO",
    coverPath: "/marketplace/covers/page-football.png",
    priceMode: "free",
    delivery: "page",
    pageTemplate: "football",
    gallery: [
      {
        id: "actual-page",
        name: "Captura de la página VISO · datos de ejemplo",
        mediaType: "image",
        builtinPath: "/marketplace/previews/page-football-vertical.png",
      },
    ],
    details: {
      type: "Página de deportes",
      device: "Deck y Display VISO",
      os: "Android y navegador web",
      compatibility: "VISO 1.14 o posterior. Requiere conexión a Internet.",
      version: "1.0.0",
      language: "Español",
      included:
        "Página de deportes integrada, favoritos y consulta de resultados anteriores.",
      setup:
        "Agregá la página al deck y hacé doble toque para elegir equipos, fecha y competiciones.",
    },
    assets: [],
  },
  {
    id: "viso-page-clock",
    title: "Reloj",
    description:
      "Un reloj a pantalla completa con estilos, colores, fecha y fotografías configurables. Puede ser tu página principal o tu protector de pantalla, según lo que elijas en el deck.",
    category: "pages",
    creatorName: "VISO",
    coverPath: "/marketplace/covers/page-clock.png",
    priceMode: "free",
    delivery: "page",
    pageTemplate: "clock",
    gallery: [
      {
        id: "actual-page",
        name: "Captura de la página VISO · datos de ejemplo",
        mediaType: "image",
        builtinPath: "/marketplace/previews/page-clock-vertical.png",
      },
    ],
    details: {
      type: "Página de reloj",
      device: "Deck y Display VISO",
      os: "Android y navegador web",
      compatibility: "VISO 1.14 o posterior",
      version: "1.0.0",
      language: "Español",
      included:
        "Reloj con estilos, fecha, colores y fotografías configurables.",
      setup: "Agregá la página y hacé doble toque para elegir su diseño.",
    },
    assets: [],
  },
  {
    id: "viso-page-weather",
    title: "Clima",
    description:
      "El clima de tu ciudad a pantalla completa, con condiciones actuales, pronóstico y animaciones. Se incluye al crear una cuenta nueva y también podés agregarlo desde tu biblioteca.",
    category: "pages",
    creatorName: "VISO",
    coverPath: "/marketplace/covers/page-weather.png",
    priceMode: "free",
    delivery: "page",
    pageTemplate: "weather",
    gallery: [
      {
        id: "actual-page",
        name: "Captura de la página VISO · datos de ejemplo",
        mediaType: "image",
        builtinPath: "/marketplace/previews/page-weather-vertical.png",
      },
    ],
    details: {
      type: "Página de clima",
      device: "Deck y Display VISO",
      os: "Android y navegador web",
      compatibility: "VISO 1.14 o posterior. Requiere conexión a Internet.",
      version: "1.0.0",
      language: "Español",
      included: "Condiciones actuales y pronóstico para la ciudad que elijas.",
      setup: "Hacé doble toque en la página para cambiar ciudad y unidades.",
    },
    assets: [],
  },
  {
    id: "viso-page-spotify",
    title: "Spotify",
    description:
      "Agregá la página de música de VISO para acceder a Spotify desde tu deck. La reproducción, el acceso a la cuenta y las funciones disponibles dependen de Spotify y de tu dispositivo; este recurso no incluye una suscripción.",
    category: "pages",
    creatorName: "VISO",
    coverPath: "/marketplace/covers/page-spotify.png",
    priceMode: "free",
    delivery: "page",
    pageTemplate: "spotify",
    gallery: [
      {
        id: "actual-page",
        name: "Captura de la página VISO · datos de ejemplo",
        mediaType: "image",
        builtinPath: "/marketplace/previews/page-spotify-vertical.png",
      },
    ],
    details: {
      type: "Página de música",
      device: "Deck y Display VISO",
      os: "Android y navegador web",
      compatibility:
        "VISO 1.14 o posterior. Las funciones de Spotify requieren su servicio.",
      version: "1.0.0",
      language: "Español",
      included: "Página de música integrada con acceso a Spotify.",
      setup:
        "Agregá la página al deck. Usá los accesos de música disponibles en tu dispositivo.",
    },
    assets: [],
  },
  {
    id: "viso-page-visualizer",
    title: "Vúmetro",
    description:
      "La página de audio de VISO a pantalla completa: medidores LED, agujas, barras, ondas y espectros. Elegí micrófono o música, diseño y sensibilidad. La captura de música depende de los permisos y de que la aplicación o el navegador permitan compartir su audio.",
    category: "pages",
    creatorName: "VISO",
    coverPath: "/marketplace/covers/page-visualizer.png",
    priceMode: "free",
    delivery: "page",
    pageTemplate: "visualizer",
    gallery: [
      {
        id: "actual-page",
        name: "Captura de la página VISO · datos de ejemplo",
        mediaType: "image",
        builtinPath: "/marketplace/previews/page-visualizer-vertical.png",
      },
    ],
    details: {
      type: "Página de audio",
      device: "Deck y Display VISO",
      os: "Android y navegador web",
      compatibility:
        "VISO 1.15 o posterior. Requiere autorizar la fuente de audio en cada dispositivo.",
      version: "1.0.0",
      language: "Español",
      included:
        "13 diseños de medidor, selector de micrófono o música y sensibilidad configurable.",
      setup:
        "Agregá la página al deck, hacé doble toque para configurar el diseño y la fuente, y tocá Iniciar para autorizar la captura. La música protegida o de aplicaciones que no permiten captura puede no estar disponible.",
    },
    assets: [],
  },
  {
    id: "viso-mini",
    title: "VISO Mini",
    description:
      "Tu estado, visible para todos. Compacto, conectado y fácil de ubicar en el escritorio, una puerta o la pared.",
    category: "hardware",
    creatorName: "VISO",
    coverPath: "/products/viso-mini.png",
    priceMode: "info",
    delivery: "inquiry",
    assets: [],
  },
  {
    id: "viso-display",
    title: "VISO Display",
    description:
      "Tu estado, agenda y contenido en una pantalla para tu espacio. Mostrá imágenes, videos y la información que necesitás durante el día.",
    category: "hardware",
    creatorName: "VISO",
    coverPath: "/products/viso-display.png",
    priceMode: "info",
    delivery: "inquiry",
    assets: [],
  },
  {
    id: "viso-matrix",
    title: "VISO Matrix",
    description:
      "Señalización con iconos y colores que se reconocen de un vistazo. Un formato compacto para mostrar tus estados en el escritorio o en la pared.",
    category: "hardware",
    creatorName: "VISO",
    coverPath: "/products/viso-matrix.png",
    priceMode: "info",
    delivery: "inquiry",
    assets: [],
  },
];

/** Compatibility alias for consumers of the initial catalog contract. */
export const MARKETPLACE_BUILTINS = BUILTIN_MARKETPLACE_PRODUCTS;
