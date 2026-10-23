import { afterEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ enabled: false }));
vi.mock("./android-native", () => ({ isAndroidNative: () => native.enabled }));
import { timbrePublicOrigin, timbrePublicQrUrl } from "./timbre-public-url";

afterEach(() => {
  vi.unstubAllEnvs();
  native.enabled = false;
});
describe("public Timbre links", () => {
  it("never prints Capacitor's private origin from the Android app", () => {
    native.enabled = true;
    vi.stubEnv("VITE_PUBLIC_APP_URL", "");
    vi.stubEnv("VITE_VISO_WEB_URL", "");
    expect(timbrePublicQrUrl("a".repeat(64))).toBe(
      `https://viso-deck-android.vercel.app/t/${"a".repeat(64)}`,
    );
  });
  it("uses the configured shared HTTPS website for every exported code", () => {
    native.enabled = true;
    vi.stubEnv("VITE_PUBLIC_APP_URL", "https://viso.example/");
    expect(timbrePublicQrUrl("b".repeat(64))).toBe(
      `https://viso.example/t/${"b".repeat(64)}`,
    );
  });
  it.each([
    "https://localhost",
    "http://viso.example",
    "https://user:secret@viso.example",
    "https://viso.example/?key=secret",
  ])("rejects unsafe public configuration %s", (url) => {
    native.enabled = true;
    vi.stubEnv("VITE_PUBLIC_APP_URL", url);
    expect(() => timbrePublicOrigin()).toThrow("dirección pública");
  });
  it("rejects a token containing a path, query or invitation credential", () => {
    vi.stubEnv("VITE_PUBLIC_APP_URL", "https://viso.example");
    expect(() => timbrePublicQrUrl("../?account=someone")).toThrow(
      "identificador",
    );
  });
});
