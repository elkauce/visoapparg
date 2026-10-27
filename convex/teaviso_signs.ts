import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/current_user";
import { enrollTeaviso } from "./lib/teaviso_accounts";
import { isMarketplaceAdmin } from "./marketplace";
import { teavisoText } from "./lib/teaviso";
import {
  signModel,
  signMaterial,
  signFields,
  signState,
} from "./lib/teaviso_signs";

export const request = mutation({
  args: {
    spaceId: v.id("teavisoSpaces"),
    model: signModel,
    material: signMaterial,
    fields: signFields,
    requestKey: v.string(),
    reviewed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx),
      space = await ctx.db.get("teavisoSpaces", args.spaceId);
    if (!space || space.ownerId !== user._id)
      throw new ConvexError("Elegí un timbre de tu cuenta.");
    if (!args.reviewed)
      throw new ConvexError("Revisá la vista previa y confirmá los datos.");
    if (!/^[a-f0-9]{64}$/.test(args.requestKey))
      throw new ConvexError("Volvé a abrir el formulario.");
    const fields = {
      street: teavisoText(args.fields.street, 60, false),
      number: teavisoText(args.fields.number, 15, false),
      name: teavisoText(args.fields.name, 60, false),
      profession: teavisoText(args.fields.profession, 60, false),
      registration: teavisoText(args.fields.registration, 35, false),
      details: teavisoText(args.fields.details, 120, false),
    };
    if (args.model === "address" && (!fields.street || !fields.number))
      throw new ConvexError("Completá calle y número.");
    if (args.model === "professional" && (!fields.name || !fields.profession))
      throw new ConvexError("Completá nombre y profesión.");
    const previous = await ctx.db
      .query("teavisoSignRequests")
      .withIndex("by_owner_key", (q) =>
        q.eq("ownerId", user._id).eq("requestKey", args.requestKey),
      )
      .unique();
    if (previous) {
      if (
        previous.spaceId !== space._id ||
        previous.model !== args.model ||
        previous.material !== args.material ||
        (Object.keys(fields) as (keyof typeof fields)[]).some(
          (key) => previous.fields[key] !== fields[key],
        )
      )
        throw new ConvexError(
          "La solicitud anterior tiene otros datos. Iniciá una nueva.",
        );
      return previous._id;
    }
    const requests = await ctx.db
      .query("teavisoSignRequests")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(50);
    const now = Date.now();
    if (requests.filter((r) => r.createdAt > now - 86400000).length >= 10)
      throw new ConvexError(
        "Alcanzaste las solicitudes de hoy. Podés consultar las que ya enviaste.",
      );
    if (space.whatsappQrId) {
      const qr = await ctx.db.get("teavisoWhatsappQrs", space.whatsappQrId);
      if (!qr || qr.archived || qr.ownerId !== user._id)
        throw new ConvexError("Este QR ya no está disponible.");
    }
    await enrollTeaviso(ctx, user._id);
    return ctx.db.insert("teavisoSignRequests", {
      ownerId: user._id,
      spaceId: space._id,
      spaceName: space.name,
      qrToken: space.token,
      model: args.model,
      material: args.material,
      fields,
      requestKey: args.requestKey,
      status: "requested",
      adminNotes: "",
      reviewedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const rows = await ctx.db
      .query("teavisoSignRequests")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(100);
    return rows.map((r) => ({
      _id: r._id,
      spaceName: r.spaceName,
      model: r.model,
      material: r.material,
      status: r.status,
      createdAt: r.createdAt,
    }));
  },
});
export const adminList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const admin = await requireCurrentUser(ctx);
    if (!isMarketplaceAdmin(admin._id))
      throw new ConvexError("No tenés permiso de administración.");
    const result = await ctx.db
      .query("teavisoSignRequests")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (row) => {
          const user = await ctx.db.get("users", row.ownerId);
          return { ...row, email: user?.email ?? "" };
        }),
      ),
    };
  },
});
export const adminUpdate = mutation({
  args: {
    id: v.id("teavisoSignRequests"),
    status: signState,
    notes: v.string(),
    expectedUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await requireCurrentUser(ctx);
    if (!isMarketplaceAdmin(admin._id))
      throw new ConvexError("No tenés permiso de administración.");
    const row = await ctx.db.get("teavisoSignRequests", args.id);
    if (!row) throw new ConvexError("No encontramos la solicitud.");
    if (row.updatedAt !== args.expectedUpdatedAt)
      throw new ConvexError("La solicitud cambió. Recargá antes de guardar.");
    await ctx.db.patch("teavisoSignRequests", row._id, {
      status: args.status,
      adminNotes: teavisoText(args.notes, 1000, false),
      updatedAt: Math.max(Date.now(), row.updatedAt + 1),
    });
    await ctx.db.insert("teavisoAdminEvents", {
      actorId: admin._id,
      ownerId: row.ownerId,
      action: "sign.reviewed",
      targetId: row._id,
      reason: `Solicitud de cartel: ${args.status}`,
      createdAt: Date.now(),
    });
  },
});
