import type { Doc, Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx } from "../_generated/server";

const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const SLUG_LENGTH = 10;

function randomSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    slug += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return slug;
}

async function createUniqueSlug(ctx: MutationCtx): Promise<string> {
  for (;;) {
    const slug = randomSlug();
    const taken = await ctx.db
      .query("publicLinks")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!taken) {
      return slug;
    }
  }
}

// Crea el link público del usuario si todavía no tiene uno
export async function ensurePublicLink(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"publicLinks">> {
  const existing = await ctx.db
    .query("publicLinks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing) {
    return existing;
  }
  const slug = await createUniqueSlug(ctx);
  const id = await ctx.db.insert("publicLinks", { userId, slug });
  const created = await ctx.db.get("publicLinks", id);
  if (!created) {
    throw new Error("No se pudo crear el link público");
  }
  return created;
}

// Cambia el slug (invalida el link anterior)
export async function regenerateSlug(
  ctx: MutationCtx,
  link: Doc<"publicLinks">,
): Promise<string> {
  const slug = await createUniqueSlug(ctx);
  await ctx.db.patch("publicLinks", link._id, { slug });
  return slug;
}
