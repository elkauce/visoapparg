import { describe, expect, it } from "vitest";
import {
  normalizeTimbreTelegramUsername,
  timbreTelegramUrl,
} from "./timbre_telegram";

const accepted = [
  ["Viso_Casa", "viso_casa"],
  ["@Viso_Casa", "viso_casa"],
  ["  @Viso_Casa  ", "viso_casa"],
  ["t.me/Viso_Casa", "viso_casa"],
  ["https://t.me/Viso_Casa", "viso_casa"],
  ["https://t.me/Viso_Casa/", "viso_casa"],
  ["HTTPS://T.ME/Viso_Casa", "viso_casa"],
  ["Casa1", "casa1"],
  ["A" + "b".repeat(30) + "1", "a" + "b".repeat(30) + "1"],
] as const;

function rejects(values: readonly string[]) {
  for (const value of values) {
    expect(normalizeTimbreTelegramUsername(value), value).toBeNull();
    expect(timbreTelegramUrl(value), value).toBeNull();
  }
}

describe("direct Telegram contact links", () => {
  it("accepts the owner's common pasted forms and produces a canonical username", () => {
    for (const [value, username] of accepted) {
      expect(normalizeTimbreTelegramUsername(value)).toBe(username);
      expect(timbreTelegramUrl(value)).toBe(`https://t.me/${username}`);
    }
  });

  it("keeps every accepted destination on the fixed HTTPS Telegram host", () => {
    for (const [value, username] of accepted) {
      const url = new URL(timbreTelegramUrl(value)!);
      expect(url.origin).toBe("https://t.me");
      expect(url.pathname).toBe(`/${username}`);
      expect(url.username).toBe("");
      expect(url.password).toBe("");
      expect(url.port).toBe("");
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
    }
  });

  it("does not publish phone numbers or phone-based Telegram links", () => {
    rejects([
      "+5491112345678",
      "5491112345678",
      "@5491112345678",
      "tel:+5491112345678",
      "tg://resolve?phone=5491112345678",
      "https://t.me/+5491112345678",
      "https://t.me/5491112345678",
    ]);
  });

  it("rejects foreign destinations, credentials, ports and alternate protocols", () => {
    rejects([
      "http://t.me/viso_casa",
      "javascript:alert(1)",
      "data:text/html,viso_casa",
      "tg://resolve?domain=viso_casa",
      "https://example.test/viso_casa",
      "https://t.me.example.test/viso_casa",
      "https://t.me@evil.example/viso_casa",
      "https://someone:password@t.me/viso_casa",
      "https://t.me:8443/viso_casa",
      "https://t.me:443/viso_casa",
      "//t.me/viso_casa",
      "telegram.me/viso_casa",
    ]);
  });

  it("rejects special Telegram actions and path/query payloads", () => {
    rejects([
      "addstickers",
      "addemoji",
      "addtheme",
      "addlist",
      "share",
      "joinchat",
      "login",
      "proxy",
      "socks",
      "boost",
      "giftcode",
      "invoice",
      "confirmphone",
      "setlanguage",
      "premium_offer",
      "contact",
      "https://t.me/share",
      "https://t.me/viso_casa/extra",
      "https://t.me/viso_casa?profile",
      "https://t.me/viso_casa?start=payload",
      "https://t.me/viso_casa#call",
      "https://t.me/viso_casa?",
      "https://t.me/viso_casa#",
      "https://t.me/other/../viso_casa",
      "https://t.me/%76iso_casa",
      "https://t.me//viso_casa",
    ]);
  });

  it("rejects malformed usernames and hidden characters rather than repairing them", () => {
    rejects([
      "",
      "   ",
      "@",
      "@@viso_casa",
      "casa",
      "a".repeat(33),
      "1visocasa",
      "_visocasa",
      "visocasa_",
      "viso-casa",
      "viso.casa",
      "viso casa",
      "visó_casa",
      "vi\u200bso_casa",
      "viso_casa\u0000",
      "viso\u007fcasa",
      "\n@viso_casa",
      "@viso_casa\t",
    ]);
  });
});
