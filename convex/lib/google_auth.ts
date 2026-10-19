import { ConvexError } from "convex/values";

export function googleAvailable() {
  return Boolean(
    process.env.AUTH_GOOGLE_ID?.trim() &&
    process.env.AUTH_GOOGLE_SECRET?.trim(),
  );
}

export function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ConvexError("Ingresa un correo electrónico válido");
  }
  return email;
}

export function googleProfile(raw: Record<string, unknown>) {
  if (
    raw.email_verified !== true ||
    typeof raw.sub !== "string" ||
    !raw.sub ||
    raw.sub.length > 255
  ) {
    throw new ConvexError("Google no verificó esta cuenta. Elegí otra cuenta.");
  }
  return {
    id: raw.sub,
    googleSubject: raw.sub,
    email: normalizeEmail(raw.email),
    emailVerified: true as const,
    ...(typeof raw.name === "string" && raw.name.trim()
      ? { name: raw.name.trim().slice(0, 80) }
      : {}),
    ...(typeof raw.picture === "string" && raw.picture.startsWith("https://")
      ? { image: raw.picture }
      : {}),
  };
}

export async function hashSocialCode(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function newSocialCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
