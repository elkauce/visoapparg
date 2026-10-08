import type { Id } from "../_generated/dataModel.d.ts";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

export const OFF_COLOR = "#000000";
export const OFF_NAME = "Apagado";

// Programa el aviso a una URL (se envía desde el servidor, sin bloquear al usuario)
export async function scheduleWebhook(
  ctx: MutationCtx,
  url: string,
  statusName: string,
  color: string,
  off: boolean,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.lights.fireWebhook, {
    url,
    statusName,
    color,
    off,
  });
}

// Cambia el estado activo y avisa a los webhooks. Un solo punto para app, Stream Deck y URLs
export async function setActiveStatus(
  ctx: MutationCtx,
  userId: Id<"users">,
  statusId: Id<"statuses"> | null,
): Promise<void> {
  await ctx.db.patch("users", userId, {
    activeStatusId: statusId ?? undefined,
  });
  const user = await ctx.db.get("users", userId);
  const status = statusId ? await ctx.db.get("statuses", statusId) : null;
  const name = status?.name ?? OFF_NAME;
  const color = status?.color ?? OFF_COLOR;
  const off = status === null;

  // Webhook general (luces de la casa): se avisa con cada cambio, incluido apagar
  if (user?.homeWebhookUrl) {
    await scheduleWebhook(ctx, user.homeWebhookUrl, name, color, off);
  }
  // Webhook propio del estado (por ejemplo una rutina de Alexa distinta por estado)
  if (status?.webhookUrl && status.webhookUrl !== user?.homeWebhookUrl) {
    await scheduleWebhook(ctx, status.webhookUrl, name, color, false);
  }
}
