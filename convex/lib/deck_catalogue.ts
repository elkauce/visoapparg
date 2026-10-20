import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { VISO_STATES, findVisoStatus } from "./viso_preset_states";
import { normalizeScreenSettings } from "./screen_settings";
import { MAX_PAGES } from "./deck_keys";

/** Only an empty account receives starter pages. Existing layouts stay intact. */
export async function initializeDeckCatalogue(ctx: MutationCtx, user: Doc<"users">) {
  if ((user.deckCatalogVersion ?? 0) >= 1) return;
  const pages = await ctx.db
    .query("deckPages")
    .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
    .take(MAX_PAGES);
  if (pages.length > 0) {
    await ctx.db.patch("users", user._id, { deckCatalogVersion: 1 });
    return;
  }
  const statuses = await ctx.db
    .query("statuses")
    .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
    .take(100);
  const statePage = await ctx.db.insert("deckPages", {
    userId: user._id,
    name: "Estados VISO",
    order: 0,
    kind: "grid",
    grid: { columns: 3, rows: 2 },
  });
  let statusCount = statuses.length;
  let nextStatusOrder =
    Math.max(-1, ...statuses.map((status) => status.order)) + 1;
  for (const [position, definition] of VISO_STATES.entries()) {
    const status = findVisoStatus(definition, statuses);
    if (!status && statusCount >= 24) continue;
    const statusId =
      status?._id ??
      (await ctx.db.insert("statuses", {
        userId: user._id,
        name: definition.name,
        color: definition.defaultColor,
        icon: definition.icon,
        order: nextStatusOrder++,
      }));
    if (!status) statusCount++;
    await ctx.db.insert("deckKeys", {
      userId: user._id,
      pageId: statePage,
      position,
      content: { kind: "status", statusId },
      appearance: { label: definition.label },
    });
  }
  await ctx.db.insert("deckPages", {
    userId: user._id,
    name: "Clima",
    order: 1,
    kind: "weather",
    marketplaceProductId: "viso-page-weather",
    marketplaceVersion: "1.0.0",
    screenSettings: normalizeScreenSettings({}),
  });
  await ctx.db.patch("users", user._id, { deckCatalogVersion: 1 });
}
