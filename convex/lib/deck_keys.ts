import { ConvexError } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx } from "../_generated/server";
import { getOwnedStatus } from "./owned_status.ts";
import { isSportsLeague } from "./sports_leagues.ts";
import { MAX_SLOTS_PER_PAGE } from "./deck_grid.ts";
import type { deckAction, deckSimpleAction } from "./deck_action_content.ts";

export const MAX_PAGES = 8;
export const SLOTS_PER_PAGE = 15;
// Tope de teclas de un usuario: páginas x posiciones
export const MAX_KEYS = MAX_PAGES * MAX_SLOTS_PER_PAGE;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

type KeyContent = Doc<"deckKeys">["content"];

function bad(message: string): never {
  throw new ConvexError({ code: "BAD_REQUEST", message });
}

export function cleanLabel(raw: string, max: number): string {
  const label = raw.trim();
  if (label.length === 0 || label.length > max) {
    bad(`El nombre debe tener entre 1 y ${max} caracteres`);
  }
  return label;
}

export async function getOwnedPage(
  ctx: MutationCtx,
  userId: Id<"users">,
  pageId: Id<"deckPages">,
): Promise<Doc<"deckPages">> {
  const page = await ctx.db.get("deckPages", pageId);
  if (!page) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Página no encontrada",
    });
  }
  if (page.userId !== userId) {
    throw new ConvexError({ code: "FORBIDDEN", message: "No tienes permiso" });
  }
  return page;
}

// Solo http(s): evita esquemas peligrosos como javascript:
function cleanUrl(raw: string): string {
  const value = raw.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return bad("La dirección no es válida");
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    value.length > 500
  ) {
    bad("Usa una dirección que empiece por https://");
  }
  return url.toString();
}

function checkColor(color: string): void {
  if (!HEX_COLOR.test(color)) {
    bad("Color inválido");
  }
}

async function validateSimpleAction(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: Infer<typeof deckSimpleAction>,
): Promise<Infer<typeof deckSimpleAction>> {
  switch (action.type) {
    case "status":
      await getOwnedStatus(ctx, userId, action.statusId);
      return action;
    case "page":
      await getOwnedPage(ctx, userId, action.pageId);
      return action;
    case "url":
      return { ...action, url: cleanUrl(action.url) };
    case "android-app":
      if (
        action.packageName.length > 200 ||
        !/^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)+$/.test(action.packageName)
      ) {
        bad("Nombre de aplicación Android inválido");
      }
      return action;
    case "rgb":
      if (action.color !== undefined) checkColor(action.color);
      if (
        action.brightness !== undefined &&
        (!Number.isFinite(action.brightness) ||
          action.brightness < 0 ||
          action.brightness > 100)
      ) {
        bad("El brillo debe estar entre 0 y 100");
      }
      if (
        (action.command === "color" && action.color === undefined) ||
        (action.command === "brightness" && action.brightness === undefined) ||
        (action.command === "power" && action.on === undefined) ||
        (action.command === "scene" && action.scene === undefined)
      )
        bad("Falta la configuración de la acción RGB");
      return {
        ...action,
        deviceId: cleanLabel(action.deviceId, 200),
        ...(action.scene !== undefined
          ? { scene: cleanLabel(action.scene, 100) }
          : {}),
      };
    case "off":
    case "display":
    case "media":
      return action;
  }
}

async function validateAction(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: Infer<typeof deckAction>,
) {
  if (action.type !== "automation")
    return await validateSimpleAction(ctx, userId, action);
  if (action.steps.length < 1 || action.steps.length > 16)
    bad("Una automatización admite entre 1 y 16 acciones");
  const steps = [];
  for (const step of action.steps)
    steps.push(await validateSimpleAction(ctx, userId, step));
  return { ...action, steps };
}

function actionSteps(content: KeyContent): Infer<typeof deckSimpleAction>[] {
  if (content.kind !== "action") return [];
  return content.action.type === "automation"
    ? content.action.steps
    : [content.action];
}

export function contentTargetsStatus(
  content: KeyContent,
  statusId: Id<"statuses">,
) {
  return (
    (content.kind === "status" && content.statusId === statusId) ||
    actionSteps(content).some(
      (action) => action.type === "status" && action.statusId === statusId,
    )
  );
}

export function contentTargetsPage(
  content: KeyContent,
  pageId: Id<"deckPages">,
) {
  return (
    (content.kind === "folder" && content.targetPageId === pageId) ||
    actionSteps(content).some(
      (action) => action.type === "page" && action.pageId === pageId,
    )
  );
}

// Valida y limpia el contenido de una tecla antes de guardarlo
export async function validateKeyContent(
  ctx: MutationCtx,
  userId: Id<"users">,
  content: KeyContent,
): Promise<KeyContent> {
  switch (content.kind) {
    case "status":
      await getOwnedStatus(ctx, userId, content.statusId);
      return content;
    case "off":
    case "clock":
    case "volume":
      return content;
    case "weather":
      if (
        !Number.isFinite(content.latitude) ||
        !Number.isFinite(content.longitude) ||
        Math.abs(content.latitude) > 90 ||
        Math.abs(content.longitude) > 180
      ) {
        bad("Ubicación inválida");
      }
      return { ...content, label: cleanLabel(content.label, 30) };
    case "sports":
      if (!isSportsLeague(content.league)) {
        bad("Liga no disponible");
      }
      return content;
    case "link":
      checkColor(content.color);
      return {
        ...content,
        label: cleanLabel(content.label, 20),
        url: cleanUrl(content.url),
      };
    case "folder":
      checkColor(content.color);
      await getOwnedPage(ctx, userId, content.targetPageId);
      return { ...content, label: cleanLabel(content.label, 20) };
    case "action":
      checkColor(content.color);
      return {
        ...content,
        label: cleanLabel(content.label, 20),
        icon: cleanLabel(content.icon, 60),
        action: await validateAction(ctx, userId, content.action),
      };
  }
}

// Borra las teclas que apuntan a algo que ya no existe (un estado o una página)
export async function deleteDanglingKeys(
  ctx: MutationCtx,
  userId: Id<"users">,
  isDangling: (content: KeyContent) => boolean,
): Promise<void> {
  const keys = await ctx.db
    .query("deckKeys")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_KEYS);
  for (const key of keys) {
    if (isDangling(key.content)) {
      await ctx.db.delete("deckKeys", key._id);
    }
  }
}
