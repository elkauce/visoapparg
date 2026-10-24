import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export function teavisoText(value: string, max: number, required = true) {
  const text = value.trim();
  if (
    (required && !text) ||
    text.length > max ||
    Array.from(text).some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 && ![9, 10, 13].includes(code);
    })
  )
    throw new ConvexError("Revisá los datos ingresados.");
  return text;
}
export function whatsappPhone(value: string) {
  const phone = value.replace(/[\s()+-]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(phone))
    throw new ConvexError(
      "Ingresá el teléfono internacional completo, sin 0 ni 15.",
    );
  return phone;
}
export function whatsappUrl(phone: string, message: string) {
  return `https://wa.me/${whatsappPhone(phone)}?text=${encodeURIComponent(teavisoText(message, 500, false))}`;
}
export function teavisoOrigin(value: string | undefined): string | null {
  if (!value || value.length > 2048 || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      value.replace(/\/$/, "") !== url.origin
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Called only after marketplace validates provider amount, owner, currency and event. */
export async function applyTeavisoOrderPayment(
  ctx: MutationCtx,
  order: Doc<"marketplaceOrders">,
  status: string,
) {
  const request = await ctx.db
    .query("teavisoBusinessRequests")
    .withIndex("by_order", (q) => q.eq("orderId", order._id))
    .unique();
  if (!request || request.ownerId !== order.buyerId) return;
  if (status === "approved" && request.status === "awaiting_payment") {
    await ctx.db.patch("teavisoBusinessRequests", request._id, {
      status: "paid",
      updatedAt: Date.now(),
    });
  } else if (["refunded", "charged_back"].includes(status)) {
    await ctx.db.patch("teavisoBusinessRequests", request._id, {
      status: "cancelled",
      enabled: false,
      updatedAt: Date.now(),
    });
  }
}
