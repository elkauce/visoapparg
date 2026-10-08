import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// Versión sin errores para queries reactivas: null si aún no hay sesión o fila de usuario
export async function getCurrentUserOrNull(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get("users", userId);
}

// Obtiene el usuario autenticado a partir de la identidad del servidor (nunca del cliente)
export async function requireCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Debes iniciar sesión",
    });
  }
  const user = await ctx.db.get("users", userId);
  if (!user) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Usuario no encontrado",
    });
  }
  return user;
}
