import { internal } from "./_generated/api";
import { mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireCurrentUser } from "./lib/current_user";
import { setActiveStatus } from "./lib/activate_status";
const DAY = 86400000;
async function digest(secret: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export const enroll = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (!/^[0-9a-f-]{36}$/i.test(args.deviceId))
      throw new ConvexError("Dispositivo inválido");
    const existing = await ctx.db
      .query("presenceDevices")
      .withIndex("by_owner_device", (q) =>
        q.eq("userId", user._id).eq("deviceId", args.deviceId),
      )
      .unique();
    const secret = crypto.randomUUID() + crypto.randomUUID();
    const expires = Date.now() + 90 * DAY;
    const fields = { secretHash: await digest(secret), expires, enabled: true };
    if (existing) await ctx.db.patch("presenceDevices", existing._id, fields);
    else {
      const devices = await ctx.db
        .query("presenceDevices")
        .withIndex("by_owner", (q) => q.eq("userId", user._id))
        .take(21);
      if (devices.length >= 20)
        throw new ConvexError("Demasiados dispositivos");
      await ctx.db.insert("presenceDevices", {
        userId: user._id,
        deviceId: args.deviceId,
        ...fields,
        calling: false,
        suppressed: false,
      });
    }
    return { secret, expires, accountId: user._id };
  },
});
export const revoke = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const device = await ctx.db
      .query("presenceDevices")
      .withIndex("by_owner_device", (q) =>
        q.eq("userId", user._id).eq("deviceId", args.deviceId),
      )
      .unique();
    if (!device) return;
    if (
      device.calling &&
      !device.suppressed &&
      device.appliedRevision === (user.activeStatusRevision ?? 0)
    ) {
      const previous = device.previous
        ? await ctx.db.get("statuses", device.previous)
        : null;
      await setActiveStatus(
        ctx,
        user._id,
        previous?.userId === user._id ? previous._id : null,
      );
    }
    await ctx.db.patch("presenceDevices", device._id, {
      enabled: false,
      calling: false,
      secretHash: "revoked",
    });
  },
});
/** Capability can only read current signaling and set/restore telephone presence for its owner. */
export const signal = mutation({
  args: {
    secret: v.string(),
    calling: v.boolean(),
    disable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.secret.length !== 72) throw new ConvexError("UNAUTHORIZED");
    const secretHash = await digest(args.secret);
    const registered = await ctx.db
      .query("presenceDevices")
      .withIndex("by_secret", (q) => q.eq("secretHash", secretHash))
      .unique();
    if (!registered || !registered.enabled || registered.expires <= Date.now())
      throw new ConvexError("UNAUTHORIZED");
    const user = await ctx.db.get("users", registered.userId);
    if (!user) throw new ConvexError("UNAUTHORIZED");
    const calling = args.calling && !args.disable;
    const revision = user.activeStatusRevision ?? 0;
    if (calling || registered.calling)
      await ctx.db.patch("presenceDevices", registered._id, {
        lastSeen: Date.now(),
      });
    let suppressed = registered.suppressed;
    if (registered.calling && registered.appliedRevision !== revision)
      suppressed = true;
    if (calling && !registered.calling) {
      const other = await ctx.db
        .query("presenceDevices")
        .withIndex("by_owner", (q) => q.eq("userId", user._id))
        .collect();
      if (
        other.some(
          (d) =>
            d._id !== registered._id &&
            d.enabled &&
            d.calling &&
            !d.suppressed &&
            d.expires > Date.now(),
        )
      )
        return snapshot(ctx, user._id);
      const statuses = await ctx.db
        .query("statuses")
        .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
        .collect();
      let status = statuses.find(
        (s) =>
          s.name
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase() === "LLAMADA",
      );
      if (!status) {
        const id = await ctx.db.insert("statuses", {
          userId: user._id,
          name: "LLAMADA",
          color: "#00A9F4",
          icon: "phone",
          order: statuses.length,
        });
        status = (await ctx.db.get("statuses", id))!;
      }
      await setActiveStatus(ctx, user._id, status._id);
      await ctx.scheduler.runAfter(
        90000,
        internal.background_presence.expireCall,
        { deviceId: registered._id, revision: revision + 1 },
      );
      await ctx.db.patch("presenceDevices", registered._id, {
        calling: true,
        suppressed: false,
        previous: user.activeStatusId,
        appliedRevision: revision + 1,
      });
    } else if (!calling && registered.calling) {
      if (!suppressed && revision === registered.appliedRevision) {
        const prev = registered.previous
          ? await ctx.db.get("statuses", registered.previous)
          : null;
        await setActiveStatus(
          ctx,
          user._id,
          prev?.userId === user._id ? prev._id : null,
        );
      }
      await ctx.db.patch("presenceDevices", registered._id, {
        calling: false,
        suppressed: false,
        previous: undefined,
        appliedRevision: undefined,
      });
    } else if (suppressed && !registered.suppressed)
      await ctx.db.patch("presenceDevices", registered._id, {
        suppressed: true,
      });
    if (args.disable)
      await ctx.db.patch("presenceDevices", registered._id, {
        enabled: false,
        secretHash: "revoked",
      });
    return snapshot(ctx, user._id);
  },
});
async function snapshot(
  ctx: import("./_generated/server").MutationCtx,
  id: import("./_generated/dataModel").Id<"users">,
) {
  const user = await ctx.db.get("users", id);
  const status = user?.activeStatusId
    ? await ctx.db.get("statuses", user.activeStatusId)
    : null;
  return {
    accountId: id,
    revision: user?.activeStatusRevision ?? 0,
    status: status ? { name: status.name, color: status.color } : null,
  };
}

export const expireCall = internalMutation({
  args: { deviceId: v.id("presenceDevices"), revision: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const device = await ctx.db.get("presenceDevices", args.deviceId);
    if (
      !device?.calling ||
      (args.revision !== undefined && args.revision !== device.appliedRevision)
    )
      return;
    const elapsed = Date.now() - (device.lastSeen ?? 0);
    if (elapsed < 90000) {
      await ctx.scheduler.runAfter(
        90000 - elapsed,
        internal.background_presence.expireCall,
        args,
      );
      return;
    }
    const user = await ctx.db.get("users", device.userId);
    if (
      user &&
      !device.suppressed &&
      user.activeStatusRevision === device.appliedRevision
    ) {
      const prev = device.previous
        ? await ctx.db.get("statuses", device.previous)
        : null;
      await setActiveStatus(
        ctx,
        user._id,
        prev?.userId === user._id ? prev._id : null,
      );
    }
    await ctx.db.patch("presenceDevices", device._id, {
      calling: true,
      suppressed: true,
      previous: undefined,
      appliedRevision: undefined,
    });
  },
});
