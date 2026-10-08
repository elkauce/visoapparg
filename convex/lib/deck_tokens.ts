import type { Doc, Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx } from "../_generated/server";

const TOKEN_BYTES = 24;

// Token criptográfico (hex): es el "secreto" que protege las URLs del Stream Deck
function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureDeckToken(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"deckTokens">> {
  const existing = await ctx.db
    .query("deckTokens")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing) {
    return existing;
  }
  const id = await ctx.db.insert("deckTokens", {
    userId,
    token: generateToken(),
  });
  const created = await ctx.db.get("deckTokens", id);
  if (!created) {
    throw new Error("No se pudo crear el token");
  }
  return created;
}

// Rota el token (invalida todas las URLs anteriores)
export async function rotateDeckToken(
  ctx: MutationCtx,
  tokenDoc: Doc<"deckTokens">,
): Promise<string> {
  const token = generateToken();
  await ctx.db.patch("deckTokens", tokenDoc._id, { token });
  return token;
}
