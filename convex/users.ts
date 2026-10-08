import { mutation, query } from "./_generated/server";
import {
  getCurrentUserOrNull,
  requireCurrentUser,
} from "./lib/current_user.ts";

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    // Convex Auth crea la fila al registrar la cuenta. Nunca se duplica por sesión.
    return (await requireCurrentUser(ctx))._id;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUserOrNull(ctx);
  },
});
