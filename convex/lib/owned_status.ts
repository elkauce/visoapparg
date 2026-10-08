import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx } from "../_generated/server";

// Devuelve el estado solo si pertenece al usuario
export async function getOwnedStatus(
  ctx: MutationCtx,
  userId: Id<"users">,
  statusId: Id<"statuses">,
): Promise<Doc<"statuses">> {
  const status = await ctx.db.get("statuses", statusId);
  if (!status) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Estado no encontrado" });
  }
  if (status.userId !== userId) {
    throw new ConvexError({ code: "FORBIDDEN", message: "No tienes permiso" });
  }
  return status;
}
