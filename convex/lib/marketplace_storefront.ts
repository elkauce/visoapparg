import { v, type Infer } from "convex/values";
import {
  marketplaceCategory,
  marketplaceError,
} from "./marketplace_validation";

export const storefrontMedia = v.object({
  mediaType: v.union(v.literal("image"), v.literal("video")),
  storageId: v.optional(v.id("_storage")),
  builtinPath: v.optional(v.string()),
});
export const storefrontTarget = v.object({
  kind: v.union(v.literal("product"), v.literal("category"), v.literal("view")),
  value: v.string(),
});
export const storefrontConfiguration = v.object({
  showSlider: v.boolean(),
  intervalSeconds: v.number(),
  slides: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      subtitle: v.string(),
      buttonLabel: v.string(),
      media: v.optional(storefrontMedia),
      target: storefrontTarget,
    }),
  ),
  categories: v.array(
    v.object({
      category: v.union(marketplaceCategory, v.literal("creators")),
      label: v.string(),
      visible: v.boolean(),
      showName: v.boolean(),
      media: v.optional(storefrontMedia),
    }),
  ),
  pulse: v.object({
    enabled: v.boolean(),
    colors: v.array(v.string()),
    speed: v.union(v.literal("slow"), v.literal("normal"), v.literal("fast")),
  }),
});
export type StorefrontConfiguration = Infer<typeof storefrontConfiguration>;
export type StorefrontMedia = Infer<typeof storefrontMedia>;
export type StorefrontTarget = Infer<typeof storefrontTarget>;
export const DEFAULT_STOREFRONT: StorefrontConfiguration = {
  showSlider: true,
  intervalSeconds: 6,
  slides: [
    {
      id: "pulso",
      title: "Tus estados cobran vida",
      subtitle: "Iconos VISO Pulso",
      buttonLabel: "Descubrir",
      media: {
        mediaType: "image",
        builtinPath: "/marketplace/covers/living-icons.png",
      },
      target: { kind: "product", value: "viso-living-icons" },
    },
    {
      id: "clima",
      title: "Tu clima, a la vista",
      subtitle: "Una página para tu Deck",
      buttonLabel: "Ver página",
      media: {
        mediaType: "image",
        builtinPath: "/marketplace/covers/page-weather.png",
      },
      target: { kind: "product", value: "viso-page-weather" },
    },
    {
      id: "reloj",
      title: "Dale tu estilo al tiempo",
      subtitle: "Descubrí las páginas de VISO",
      buttonLabel: "Explorar",
      media: {
        mediaType: "image",
        builtinPath: "/marketplace/covers/page-clock.png",
      },
      target: { kind: "category", value: "pages" },
    },
  ],
  categories: [
    {
      category: "icons",
      label: "Iconos animados",
      visible: true,
      showName: true,
      media: {
        mediaType: "image",
        builtinPath: "/marketplace/originals/libre.png",
      },
    },
    {
      category: "pages",
      label: "Páginas",
      visible: true,
      showName: true,
      media: {
        mediaType: "image",
        builtinPath: "/marketplace/covers/page-weather.png",
      },
    },
    {
      category: "screensavers",
      label: "Protectores",
      visible: true,
      showName: true,
      media: {
        mediaType: "image",
        builtinPath: "/marketplace/covers/ambient-screen.png",
      },
    },
    { category: "hardware", label: "Hardware", visible: true, showName: true },
    { category: "plugins", label: "Plugins", visible: true, showName: true },
    { category: "profiles", label: "Perfiles", visible: true, showName: true },
    {
      category: "soundboards",
      label: "Sonidos",
      visible: true,
      showName: true,
    },
    { category: "new", label: "Nuevos", visible: true, showName: true },
    { category: "used", label: "Usados", visible: true, showName: true },
  ],
  pulse: {
    enabled: true,
    colors: ["#f97316", "#22c55e", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899"],
    speed: "slow",
  },
};
export function validateStorefront(config: StorefrontConfiguration) {
  if (
    config.slides.length > 8 ||
    config.categories.length > 12 ||
    !Number.isInteger(config.intervalSeconds) ||
    config.intervalSeconds < 3 ||
    config.intervalSeconds > 30
  )
    marketplaceError(
      "Elegí hasta 8 slides y un intervalo entre 3 y 30 segundos.",
    );
  const ids = new Set<string>();
  for (const slide of config.slides) {
    if (
      !/^[\w-]{1,80}$/.test(slide.id) ||
      ids.has(slide.id) ||
      !slide.title.trim() ||
      slide.title.length > 100 ||
      slide.subtitle.length > 160 ||
      slide.buttonLabel.length > 40
    )
      marketplaceError("Revisá los nombres y textos de los slides.");
    ids.add(slide.id);
    const { kind, value } = slide.target;
    if (
      !value ||
      value.length > 160 ||
      (kind === "category" &&
        !DEFAULT_STOREFRONT.categories.some((c) => c.category === value)) ||
      (kind === "view" &&
        !["discover", "videos", "library", "creators"].includes(value))
    )
      marketplaceError("Elegí un destino válido para cada slide.");
  }
  const categories = new Set<string>();
  for (const c of config.categories) {
    if (categories.has(c.category) || !c.label.trim() || c.label.length > 40)
      marketplaceError("Revisá los nombres de las categorías.");
    categories.add(c.category);
  }
  if (
    config.pulse.colors.length < 2 ||
    config.pulse.colors.length > 8 ||
    config.pulse.colors.some((c) => !/^#[\da-f]{6}$/i.test(c))
  )
    marketplaceError("Elegí entre 2 y 8 colores RGB válidos.");
  for (const media of [
    ...config.slides.map((s) => s.media),
    ...config.categories.map((c) => c.media),
  ]) {
    if (!media) continue;
    if (!!media.storageId === !!media.builtinPath)
      marketplaceError("Elegí un archivo para la imagen o video.");
    if (
      media.builtinPath &&
      (!/^\/(marketplace|products|brand)\/[\w./-]+$/.test(media.builtinPath) ||
        media.builtinPath.includes("..") ||
        media.builtinPath.includes("//") ||
        !/\.(png|jpe?g|webp|gif|avif|mp4|webm)$/i.test(media.builtinPath))
    )
      marketplaceError("El archivo de la portada no es válido.");
    if (
      media.builtinPath &&
      /\.(mp4|webm)$/i.test(media.builtinPath) !== (media.mediaType === "video")
    )
      marketplaceError("El tipo de archivo no coincide con el contenido.");
  }
  return config;
}
