import {
  screenKind,
  normalizeScreenSettings,
  validateScreenSettingsPatch,
} from "./lib/screen_settings";
import { VISO_STATES, findVisoStatus } from "./lib/viso_preset_states";
import { normalizeStandbySettings } from "./lib/clock_settings";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUserOrNull,
  requireCurrentUser,
} from "./lib/current_user.ts";
import { deckKeyContent } from "./lib/deck_key_content.ts";
import {
  deckGrid,
  MAX_SLOTS_PER_PAGE,
  pageSlots,
  validateGrid,
  validatePosition,
} from "./lib/deck_grid.ts";
import {
  deckAppearance,
  deckCanvas,
  validateAppearance,
  validateCanvas,
} from "./lib/deck_appearance.ts";
import {
  cleanLabel,
  contentTargetsPage,
  deleteDanglingKeys,
  getOwnedPage,
  MAX_KEYS,
  MAX_PAGES,
  SLOTS_PER_PAGE,
  validateKeyContent,
} from "./lib/deck_keys.ts";

// Páginas y teclas del usuario actual (null si no hay sesión)
export const get = query({
  args: { unified: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return null;
    }
    const pages = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_PAGES);
    const keys = await ctx.db
      .query("deckKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(MAX_KEYS);
    const withMedia = await Promise.all(
      keys.map(async (key) => ({
        ...key,
        appearance: key.appearance
          ? {
              ...key.appearance,
              mediaUrl: key.appearance.mediaStorageId
                ? await ctx.storage.getUrl(key.appearance.mediaStorageId)
                : null,
            }
          : undefined,
      })),
    );
    const pagesWithMedia = await Promise.all(
      pages.map(async (page) => ({
        ...page,
        standbyPhotoUrls: await Promise.all(
          (page.standbyPhotos ?? []).map(async (id) => ({
            id,
            url: await ctx.storage.getUrl(id),
          })),
        ),
        canvas: page.canvas
          ? {
              ...page.canvas,
              mediaUrl: await ctx.storage.getUrl(page.canvas.mediaStorageId),
            }
          : undefined,
      })),
    );
    return {
      catalogReady: (user.deckCatalogVersion ?? 0) >= 1,
      pages: args.unified
        ? pagesWithMedia
        : pagesWithMedia.filter((page) => !page.kind),
      keys: args.unified
        ? withMedia
        : withMedia.filter((key) =>
            pages.some((page) => !page.kind && page._id === key.pageId),
          ),
      volume: user.displayVolume ?? 0,
    };
  },
});

// Primera vez: crea la página "Principal" con tus estados y una tecla para apagar
export const ensureDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .first();
    if (existing) {
      return null;
    }
    const pageId = await ctx.db.insert("deckPages", {
      userId: user._id,
      name: "Principal",
      order: 0,
    });
    const statuses = await ctx.db
      .query("statuses")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(SLOTS_PER_PAGE - 1);
    let position = 0;
    for (const status of statuses) {
      await ctx.db.insert("deckKeys", {
        userId: user._id,
        pageId,
        position: position++,
        content: { kind: "status", statusId: status._id },
      });
    }
    await ctx.db.insert("deckKeys", {
      userId: user._id,
      pageId,
      position,
      content: { kind: "off" },
    });
    return null;
  },
});

export const createPage = mutation({
  args: { name: v.string(), grid: v.optional(deckGrid) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const pages = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_PAGES);
    if (pages.length >= MAX_PAGES) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Máximo ${MAX_PAGES} páginas`,
      });
    }
    const last = pages[pages.length - 1];
    return await ctx.db.insert("deckPages", {
      userId: user._id,
      name: cleanLabel(args.name, 20),
      order: last ? last.order + 1 : 0,
      ...(args.grid ? { grid: validateGrid(args.grid) } : {}),
    });
  },
});

export const renamePage = mutation({
  args: { pageId: v.id("deckPages"), name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await getOwnedPage(ctx, user._id, args.pageId);
    await ctx.db.patch("deckPages", args.pageId, {
      name: cleanLabel(args.name, 20),
    });
    return null;
  },
});

// Cambiar la cuadrícula nunca elimina teclas que ya están configuradas.
export const configurePage = mutation({
  args: {
    pageId: v.id("deckPages"),
    grid: deckGrid,
    canvas: v.optional(v.union(v.null(), deckCanvas)),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await getOwnedPage(ctx, user._id, args.pageId);
    const grid = validateGrid(args.grid);
    const keys = await ctx.db
      .query("deckKeys")
      .withIndex("by_page_and_position", (q) => q.eq("pageId", args.pageId))
      .take(MAX_SLOTS_PER_PAGE);
    if (keys.some((key) => key.position >= pageSlots({ grid }))) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "Mueve o elimina las teclas fuera de la nueva cuadrícula antes de reducirla",
      });
    }
    const canvas = args.canvas
      ? await validateCanvas(ctx, user._id, args.canvas)
      : undefined;
    await ctx.db.patch("deckPages", args.pageId, {
      grid,
      ...(args.canvas !== undefined ? { canvas } : {}),
    });
    return null;
  },
});

export const duplicatePage = mutation({
  args: { pageId: v.id("deckPages"), name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const source = await getOwnedPage(ctx, user._id, args.pageId);
    const pages = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_PAGES);
    if (pages.length >= MAX_PAGES) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Máximo ${MAX_PAGES} páginas`,
      });
    }
    const pageId = await ctx.db.insert("deckPages", {
      userId: user._id,
      name: cleanLabel(args.name ?? `${source.name.slice(0, 14)} copia`, 20),
      order: (pages[pages.length - 1]?.order ?? -1) + 1,
      ...(source.kind ? { kind: source.kind } : {}),
      ...(source.screenSettings
        ? { screenSettings: source.screenSettings }
        : {}),
      ...(source.standbySettings
        ? { standbySettings: source.standbySettings }
        : {}),
      ...(source.standbyPhotos ? { standbyPhotos: source.standbyPhotos } : {}),
      ...(source.grid ? { grid: source.grid } : {}),
      ...(source.canvas ? { canvas: source.canvas } : {}),
    });
    const keys = await ctx.db
      .query("deckKeys")
      .withIndex("by_page_and_position", (q) => q.eq("pageId", source._id))
      .take(MAX_SLOTS_PER_PAGE);
    for (const key of keys) {
      if (key.userId !== user._id) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "No tienes permiso",
        });
      }
      await ctx.db.insert("deckKeys", {
        userId: user._id,
        pageId,
        position: key.position,
        content: key.content,
        ...(key.appearance ? { appearance: key.appearance } : {}),
      });
    }
    return pageId;
  },
});

// Exige el conjunto completo para evitar órdenes duplicados o páginas ajenas.
export const reorderPages = mutation({
  args: { pageIds: v.array(v.id("deckPages")) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const pages = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_PAGES);
    if (
      args.pageIds.length !== pages.length ||
      new Set(args.pageIds).size !== pages.length ||
      args.pageIds.some((pageId) => !pages.some((page) => page._id === pageId))
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Incluye todas tus páginas una sola vez",
      });
    }
    for (const [order, pageId] of args.pageIds.entries()) {
      await ctx.db.patch("deckPages", pageId, { order });
    }
    return null;
  },
});

export const removePage = mutation({
  args: { pageId: v.id("deckPages") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await getOwnedPage(ctx, user._id, args.pageId);
    const pages = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_PAGES);
    if (pages.length <= 1) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Debe quedar al menos una página",
      });
    }
    // Borra las teclas de la página y las carpetas que llevaban a ella
    await deleteDanglingKeys(ctx, user._id, (content) =>
      contentTargetsPage(content, args.pageId),
    );
    const keys = await ctx.db
      .query("deckKeys")
      .withIndex("by_page_and_position", (q) => q.eq("pageId", args.pageId))
      .take(MAX_SLOTS_PER_PAGE);
    for (const key of keys) {
      await ctx.db.delete("deckKeys", key._id);
    }
    await ctx.db.delete("deckPages", args.pageId);
    return null;
  },
});

// Coloca (o reemplaza) la tecla de una posición
export const setKey = mutation({
  args: {
    pageId: v.id("deckPages"),
    position: v.number(),
    content: deckKeyContent,
    appearance: v.optional(v.union(v.null(), deckAppearance)),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const page = await getOwnedPage(ctx, user._id, args.pageId);
    validatePosition(args.position, page);
    if (
      args.content.kind === "folder" &&
      args.content.targetPageId === args.pageId
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Una carpeta no puede llevar a su propia página",
      });
    }
    const content = await validateKeyContent(ctx, user._id, args.content);
    const appearance = args.appearance
      ? await validateAppearance(ctx, user._id, args.appearance)
      : undefined;
    const existing = await ctx.db
      .query("deckKeys")
      .withIndex("by_page_and_position", (q) =>
        q.eq("pageId", args.pageId).eq("position", args.position),
      )
      .first();
    if (existing) {
      if (existing.userId !== user._id) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "No tienes permiso",
        });
      }
      await ctx.db.patch("deckKeys", existing._id, {
        content,
        ...(args.appearance !== undefined ? { appearance } : {}),
      });
    } else {
      await ctx.db.insert("deckKeys", {
        userId: user._id,
        pageId: args.pageId,
        position: args.position,
        content,
        ...(appearance ? { appearance } : {}),
      });
    }
    return null;
  },
});

export const removeKey = mutation({
  args: { keyId: v.id("deckKeys") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const key = await ctx.db.get("deckKeys", args.keyId);
    if (!key || key.userId !== user._id) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tecla no encontrada",
      });
    }
    await ctx.db.delete("deckKeys", args.keyId);
    return null;
  },
});

// Una sola transacción mueve ambas teclas; Convex reintenta conflictos concurrentes.
export const moveKey = mutation({
  args: {
    keyId: v.id("deckKeys"),
    pageId: v.id("deckPages"),
    position: v.number(),
    swap: v.optional(v.boolean()),
    content: v.optional(deckKeyContent),
    appearance: v.optional(v.union(v.null(), deckAppearance)),
    from: v.optional(
      v.object({ pageId: v.id("deckPages"), position: v.number() }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const key = await ctx.db.get("deckKeys", args.keyId);
    if (!key || key.userId !== user._id) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tecla no encontrada",
      });
    }
    const source = await getOwnedPage(ctx, user._id, key.pageId);
    const destination = await getOwnedPage(ctx, user._id, args.pageId);
    validatePosition(args.position, destination);
    if (
      args.from &&
      (args.from.pageId !== key.pageId || args.from.position !== key.position)
    ) {
      throw new ConvexError({
        code: "CONFLICT",
        message:
          "La tecla se movió desde otro dispositivo; vuelve a intentarlo",
      });
    }
    const content = args.content
      ? await validateKeyContent(ctx, user._id, args.content)
      : key.content;
    const appearance = args.appearance
      ? await validateAppearance(ctx, user._id, args.appearance)
      : undefined;
    if (content.kind === "folder" && content.targetPageId === args.pageId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Una carpeta no puede llevar a su propia página",
      });
    }
    if (key.pageId === args.pageId && key.position === args.position) {
      await ctx.db.patch("deckKeys", key._id, {
        content,
        ...(args.appearance !== undefined ? { appearance } : {}),
      });
      return null;
    }
    const existing = await ctx.db
      .query("deckKeys")
      .withIndex("by_page_and_position", (q) =>
        q.eq("pageId", args.pageId).eq("position", args.position),
      )
      .unique();
    if (existing) {
      if (existing.userId !== user._id) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "No tienes permiso",
        });
      }
      if (!args.swap) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "La posición está ocupada; elige intercambiar",
        });
      }
      validatePosition(key.position, source);
      if (
        existing.content.kind === "folder" &&
        existing.content.targetPageId === key.pageId
      ) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Una carpeta no puede llevar a su propia página",
        });
      }
      await ctx.db.patch("deckKeys", existing._id, {
        pageId: key.pageId,
        position: key.position,
      });
    }
    await ctx.db.patch("deckKeys", key._id, {
      pageId: args.pageId,
      position: args.position,
      content,
      ...(args.appearance !== undefined ? { appearance } : {}),
    });
    return null;
  },
});

// Explicit idempotent account migration. Never recreate deleted screens.
export const ensureCatalogue = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    if ((user.deckCatalogVersion ?? 0) >= 1) return;
    const pages = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_PAGES);
    if (pages.length > MAX_PAGES - 3)
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No hay espacio para migrar tus páginas sin perder datos.",
      });
    for (const page of pages)
      await ctx.db.patch("deckPages", page._id, { order: page.order + 3 });
    const statuses = await ctx.db
      .query("statuses")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(100);
    const statePage = await ctx.db.insert("deckPages", {
      userId: user._id,
      name: "Estados VISO",
      order: 0,
      kind: "grid",
      grid: { columns: 3, rows: 2 },
    });
    let statusCount = statuses.length;
    let nextStatusOrder =
      Math.max(-1, ...statuses.map((status) => status.order)) + 1;
    for (const [position, definition] of VISO_STATES.entries()) {
      const status = findVisoStatus(definition, statuses);
      if (!status && statusCount >= 24) continue;
      const statusId =
        status?._id ??
        (await ctx.db.insert("statuses", {
          userId: user._id,
          name: definition.name,
          color: definition.defaultColor,
          icon: definition.icon,
          order: nextStatusOrder++,
        }));
      if (!status) statusCount++;
      await ctx.db.insert("deckKeys", {
        userId: user._id,
        pageId: statePage,
        position,
        content: { kind: "status", statusId },
        appearance: { label: definition.label },
      });
    }
    await ctx.db.insert("deckPages", {
      userId: user._id,
      name: "Spotify",
      order: 1,
      kind: "spotify",
    });
    await ctx.db.insert("deckPages", {
      userId: user._id,
      name: "Reloj",
      order: 2,
      kind: "standby",
    });
    await ctx.db.patch("users", user._id, { deckCatalogVersion: 1 });
  },
});

export const configureScreen = mutation({
  args: {
    pageId: v.id("deckPages"),
    kind: v.optional(screenKind),
    settings: v.optional(v.any()),
    screenSettings: v.optional(v.any()),
    photos: v.optional(v.array(v.id("_storage"))),
    photoOperation: v.optional(
      v.union(v.literal("append"), v.literal("remove")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const page = await getOwnedPage(ctx, user._id, args.pageId);
    const photos =
      args.photos === undefined
        ? undefined
        : args.photoOperation === "append"
          ? [...new Set([...(page.standbyPhotos ?? []), ...args.photos])]
          : args.photoOperation === "remove"
            ? (page.standbyPhotos ?? []).filter(
                (id) => !args.photos!.includes(id),
              )
            : args.photos;
    if (photos) {
      let totalBytes = 0;
      if (photos.length > 8 || new Set(photos).size !== photos.length)
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Hasta 8 fotografías por página.",
        });
      for (const id of photos) {
        const file = await ctx.db
          .query("deckMedia")
          .withIndex("by_storage", (q) => q.eq("storageId", id))
          .unique();
        const meta = await ctx.db.system.get("_storage", id);
        if (!meta || meta.size > 8 * 1024 * 1024)
          throw new ConvexError({
            code: "BAD_REQUEST",
            message: "Cada foto puede ocupar hasta 8 MB.",
          });
        totalBytes += meta.size;
        if (totalBytes > 24 * 1024 * 1024)
          throw new ConvexError({
            code: "BAD_REQUEST",
            message: "Hasta 24 MB de fotografías por página.",
          });
        if (!file || file.userId !== user._id || file.mediaType !== "image")
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Fotografía no autorizada.",
          });
      }
    }
    await ctx.db.patch("deckPages", args.pageId, {
      ...(args.kind ? { kind: args.kind } : {}),
      ...(args.screenSettings !== undefined
        ? {
            screenSettings: normalizeScreenSettings({
              ...page.screenSettings,
              ...validateScreenSettingsPatch(args.screenSettings),
            }),
          }
        : {}),
      ...(args.settings !== undefined
        ? {
            standbySettings: normalizeStandbySettings({
              ...page.standbySettings,
              ...args.settings,
            }),
          }
        : {}),
      ...(photos ? { standbyPhotos: photos } : {}),
    });
  },
});
