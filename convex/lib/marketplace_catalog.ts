/** First-party resources owned by VISO. No external seller or purchase is implied. */
export type MarketplaceCategory =
  | "icons"
  | "plugins"
  | "profiles"
  | "screensavers"
  | "soundboards"
  | "hardware"
  | "used";

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
  priceMode: "free" | "external" | "info";
  delivery: "assets" | "profile" | "plugin" | "inquiry";
  profileTemplate?: "essential";
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
