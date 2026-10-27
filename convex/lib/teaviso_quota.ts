import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
type Read = Pick<QueryCtx, "db">;
export async function linkedSite(ctx: Read, space: Doc<"teavisoSpaces">) {
  if (space.timbreSiteId) return space.timbreSiteId;
  return space.timbreQrId
    ? (await ctx.db.get("timbreQrs", space.timbreQrId))?.siteId
    : undefined;
}
export async function linkedSpace(
  ctx: Read,
  ownerId: Id<"users">,
  siteId: Id<"timbreSites">,
) {
  const rows = await ctx.db
    .query("teavisoSpaces")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  for (const row of rows)
    if ((await linkedSite(ctx, row)) === siteId) return row;
  return null;
}
export async function locationUsage(
  ctx: Read,
  ownerId: Id<"users">,
  licenseId: Id<"timbreLicenses">,
  omitSpace?: Id<"teavisoSpaces">,
  omitSite?: Id<"timbreSites">,
) {
  const sites = (
    await ctx.db
      .query("timbreSites")
      .withIndex("by_license", (q) => q.eq("licenseId", licenseId))
      .collect()
  ).filter((s) => s._id !== omitSite);
  const spaces = (
    await ctx.db
      .query("teavisoSpaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect()
  ).filter((s) => s.licenseId === licenseId && s._id !== omitSpace);
  const paired = new Set<string>();
  let count = sites.length;
  for (const space of spaces) {
    const id = await linkedSite(ctx, space);
    if (id && sites.some((s) => s._id === id) && !paired.has(id))
      paired.add(id);
    else count++;
  }
  return count;
}
