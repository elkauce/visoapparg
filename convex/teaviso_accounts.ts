import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUserOrNull, requireCurrentUser } from "./lib/current_user";
import {
  enrollTeaviso,
  hasVisoDeck,
  teavisoProfile,
} from "./lib/teaviso_accounts";
import { teavisoText, whatsappPhone } from "./lib/teaviso";
import { isMarketplaceAdmin } from "./marketplace";

async function admin(ctx: QueryCtx | MutationCtx) {
  const user = await requireCurrentUser(ctx);
  if (!isMarketplaceAdmin(user._id))
    throw new ConvexError("No tenés permiso de administración.");
  return user;
}

export const profile = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return null;
    const [account, eligible] = await Promise.all([
      teavisoProfile(ctx, user._id),
      hasVisoDeck(ctx, user._id),
    ]);
    return {
      id: user._id,
      name: account?.name ?? user.name ?? "",
      email: user.email ?? null,
      contactPhone: account?.contactPhone ?? "",
      isAdmin: isMarketplaceAdmin(user._id),
      canLinkDeck: eligible,
      deckLinked: eligible && account?.deckLinked !== false,
      enrolled: !!account,
      updatedAt: account?.updatedAt ?? 0,
    };
  },
});

export const register = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return enrollTeaviso(ctx, user._id);
  },
});

export const saveProfile = mutation({
  args: {
    name: v.string(),
    contactPhone: v.string(),
    expectedUpdatedAt: v.number(),
    deckLinked: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const existing = await teavisoProfile(ctx, user._id);
    if ((existing?.updatedAt ?? 0) !== args.expectedUpdatedAt)
      throw new ConvexError(
        "Tu perfil cambió en otra ventana. Recargá antes de guardar.",
      );
    if (args.deckLinked && !(await hasVisoDeck(ctx, user._id)))
      throw new ConvexError(
        "Esta cuenta todavía no tiene un Deck VISO vinculado.",
      );
    const id = await enrollTeaviso(ctx, user._id);
    if (!id) throw new ConvexError("No encontramos tu cuenta.");
    await ctx.db.patch("teavisoAccounts", id, {
      searchText: `${args.name.trim()} ${user.email ?? ""}`.toLowerCase(),
      name: teavisoText(args.name, 80),
      contactPhone: args.contactPhone.trim()
        ? whatsappPhone(args.contactPhone)
        : "",
      ...(args.deckLinked !== undefined ? { deckLinked: args.deckLinked } : {}),
      updatedAt: Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1),
    });
  },
});

export const directory = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await admin(ctx);
    // Search never enumerates unrelated VISO identities. Filtering stays in this
    // product's paginated membership directory, including its legacy migration.
    const search = args.search?.trim().toLowerCase() ?? "";
    if (search.length > 120)
      throw new ConvexError("La búsqueda es demasiado larga.");
    const result = search
      ? await ctx.db
          .query("teavisoAccounts")
          .withSearchIndex("search", (q) => q.search("searchText", search))
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("teavisoAccounts")
          .order("desc")
          .paginate(args.paginationOpts);
    const rows = await Promise.all(
      result.page.map(async (account) => {
        const user = await ctx.db.get("users", account.userId);
        return {
          id: account.userId,
          name: account.name || user?.name || "Sin nombre",
          email: user?.email ?? "",
          contactPhone: account.contactPhone,
          joinedAt: account.createdAt,
        };
      }),
    );
    return { ...result, page: rows };
  },
});

export const customer = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await admin(ctx);
    const account = await teavisoProfile(ctx, userId);
    if (!account)
      throw new ConvexError("Esta cuenta no es un cliente de Te Aviso.");
    const [user, spaces, qrs, sites, business, licenses, events] =
      await Promise.all([
        ctx.db.get("users", userId),
        ctx.db
          .query("teavisoSpaces")
          .withIndex("by_owner", (q) => q.eq("ownerId", userId))
          .collect(),
        ctx.db
          .query("teavisoWhatsappQrs")
          .withIndex("by_owner", (q) => q.eq("ownerId", userId))
          .collect(),
        ctx.db
          .query("timbreSites")
          .withIndex("by_owner", (q) => q.eq("ownerId", userId))
          .collect(),
        ctx.db
          .query("teavisoBusinessRequests")
          .withIndex("by_owner", (q) => q.eq("ownerId", userId))
          .collect(),
        ctx.db
          .query("timbreLicenses")
          .withIndex("by_owner", (q) => q.eq("ownerId", userId))
          .collect(),
        ctx.db
          .query("teavisoAdminEvents")
          .withIndex("by_owner_created", (q) => q.eq("ownerId", userId))
          .order("desc")
          .take(20),
      ]);
    return {
      id: userId,
      name: account.name || user?.name || "Sin nombre",
      email: user?.email ?? "",
      contactPhone: account.contactPhone,
      updatedAt: account.updatedAt,
      spaces: spaces.map((s) => ({
        id: s._id,
        name: s.name,
        enabled: s.enabled,
        kind: s.kind,
        digital: s.timbreSiteId !== undefined,
        updatedAt: s.updatedAt,
      })),
      qrs: qrs
        .filter(
          (q) => !q.archived && !spaces.some((s) => s.whatsappQrId === q._id),
        )
        .map((q) => ({
          id: q._id,
          name: q.label,
          enabled: q.enabled,
          updatedAt: q.updatedAt,
        })),
      sites: sites
        .filter((s) => !spaces.some((p) => p.timbreSiteId === s._id))
        .map((s) => ({
          id: s._id,
          name: s.name,
          enabled: s.enabled,
          kind: s.kind,
          updatedAt: s.updatedAt,
        })),
      business: business.map((b) => ({
        id: b._id,
        name: b.businessName,
        status: b.status,
      })),
      licenses: licenses.map((l) => ({
        id: l._id,
        name: l.planName,
        status: l.status,
        expiresAt: l.expiresAt,
      })),
      events: events.map((e) => ({
        id: e._id,
        action: e.action,
        reason: e.reason,
        createdAt: e.createdAt,
      })),
    };
  },
});

export const adminSaveProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    contactPhone: v.string(),
    expectedUpdatedAt: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await admin(ctx),
      account = await teavisoProfile(ctx, args.userId);
    if (!account)
      throw new ConvexError("Esta cuenta no es un cliente de Te Aviso.");
    if (account.updatedAt !== args.expectedUpdatedAt)
      throw new ConvexError("El perfil cambió. Recargá antes de guardar.");
    const reason = teavisoText(args.reason, 300);
    const user = await ctx.db.get("users", args.userId);
    await ctx.db.patch("teavisoAccounts", account._id, {
      searchText: `${args.name.trim()} ${user?.email ?? ""}`.toLowerCase(),
      name: teavisoText(args.name, 80),
      contactPhone: args.contactPhone.trim()
        ? whatsappPhone(args.contactPhone)
        : "",
      updatedAt: Math.max(Date.now(), account.updatedAt + 1),
    });
    await ctx.db.insert("teavisoAdminEvents", {
      actorId: actor._id,
      ownerId: args.userId,
      action: "profile.updated",
      targetId: account._id,
      reason,
      createdAt: Date.now(),
    });
  },
});

export const adminSaveDoorbell = mutation({
  args: {
    userId: v.id("users"),
    target: v.union(
      v.literal("space"),
      v.literal("whatsapp"),
      v.literal("digital"),
    ),
    id: v.string(),
    name: v.string(),
    enabled: v.boolean(),
    expectedUpdatedAt: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await admin(ctx);
    if (!(await teavisoProfile(ctx, args.userId)))
      throw new ConvexError("Esta cuenta no es un cliente de Te Aviso.");
    const name = teavisoText(args.name, 100),
      reason = teavisoText(args.reason, 300),
      currentTime = Date.now();
    const table =
      args.target === "space"
        ? "teavisoSpaces"
        : args.target === "digital"
          ? "timbreSites"
          : "teavisoWhatsappQrs";
    const id = ctx.db.normalizeId(table, args.id);
    if (!id) throw new ConvexError("No encontramos este timbre.");
    const row =
      args.target === "space"
        ? await ctx.db.get("teavisoSpaces", id as Id<"teavisoSpaces">)
        : args.target === "digital"
          ? await ctx.db.get("timbreSites", id as Id<"timbreSites">)
          : await ctx.db.get(
              "teavisoWhatsappQrs",
              id as Id<"teavisoWhatsappQrs">,
            );
    if (!row || row.ownerId !== args.userId)
      throw new ConvexError("El timbre no pertenece a este cliente.");
    if (row.updatedAt !== args.expectedUpdatedAt)
      throw new ConvexError(
        "El timbre cambió en otra ventana. Recargá antes de guardar.",
      );
    const now = Math.max(currentTime, row.updatedAt + 1);
    if (args.target === "space") {
      const space = await ctx.db.get(
        "teavisoSpaces",
        id as Id<"teavisoSpaces">,
      );
      if (!space) throw new ConvexError("No encontramos esta entrada.");
      await ctx.db.patch("teavisoSpaces", space._id, {
        name,
        enabled: args.enabled,
        revision: space.revision + 1,
        updatedAt: now,
      });
      if (space.whatsappQrId) {
        const qr = await ctx.db.get("teavisoWhatsappQrs", space.whatsappQrId);
        if (qr?.ownerId === args.userId && !qr.archived)
          await ctx.db.patch("teavisoWhatsappQrs", qr._id, {
            label: name,
            enabled: args.enabled,
            updatedAt: now,
          });
      }
      if (space.timbreSiteId) {
        const site = await ctx.db.get("timbreSites", space.timbreSiteId);
        if (site?.ownerId === args.userId)
          await ctx.db.patch("timbreSites", site._id, {
            name,
            enabled: args.enabled,
            updatedAt: now,
          });
      }
    } else if (args.target === "whatsapp") {
      const qr = await ctx.db.get(
        "teavisoWhatsappQrs",
        id as Id<"teavisoWhatsappQrs">,
      );
      if (!qr || qr.archived)
        throw new ConvexError("Este QR fue eliminado y no se puede reactivar.");
      const linked = await ctx.db
        .query("teavisoSpaces")
        .withIndex("by_whatsapp", (q) => q.eq("whatsappQrId", qr._id))
        .first();
      if (linked)
        throw new ConvexError(
          "Este QR se administra desde su entrada vinculada.",
        );
      await ctx.db.patch("teavisoWhatsappQrs", qr._id, {
        label: name,
        enabled: args.enabled,
        updatedAt: now,
      });
    } else {
      const site = await ctx.db.get("timbreSites", id as Id<"timbreSites">);
      if (!site) throw new ConvexError("No encontramos este timbre.");
      const linked = await ctx.db
        .query("teavisoSpaces")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
        .collect();
      if (linked.some((s) => s.timbreSiteId === site._id))
        throw new ConvexError(
          "Este timbre se administra desde su entrada vinculada.",
        );
      await ctx.db.patch("timbreSites", site._id, {
        name,
        enabled: args.enabled,
        updatedAt: now,
      });
    }
    await ctx.db.insert("teavisoAdminEvents", {
      actorId: actor._id,
      ownerId: args.userId,
      action: `doorbell.${args.enabled ? "enabled" : "paused"}`,
      targetId: args.id,
      reason,
      createdAt: now,
    });
  },
});

const legacySource = v.union(
  v.literal("spaces"),
  v.literal("whatsapp"),
  v.literal("business"),
  v.literal("digital"),
  v.literal("members"),
);
export const migrateLegacyAccounts = internalMutation({
  args: { source: legacySource, cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const options = { numItems: 100, cursor: args.cursor };
    const result =
      args.source === "spaces"
        ? await ctx.db.query("teavisoSpaces").paginate(options)
        : args.source === "whatsapp"
          ? await ctx.db.query("teavisoWhatsappQrs").paginate(options)
          : args.source === "business"
            ? await ctx.db.query("teavisoBusinessRequests").paginate(options)
            : args.source === "digital"
              ? await ctx.db.query("timbreSites").paginate(options)
              : await ctx.db.query("timbreMembers").paginate(options);
    for (const row of result.page)
      await enrollTeaviso(ctx, "ownerId" in row ? row.ownerId : row.userId);
    return {
      cursor: result.continueCursor,
      done: result.isDone,
      count: result.page.length,
    };
  },
});
