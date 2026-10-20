import { beforeEach, expect, it, vi } from "vitest";
import {
  externalMarketplaceNavigation,
  marketplaceConnectionsPath,
  marketplaceWebUrl,
  openMarketplaceAsset,
} from "./marketplace-navigation";

const fixture = vi.hoisted(() => ({
  native: false,
  open: vi.fn(),
  error: vi.fn(),
}));
vi.mock("./android-native", () => ({
  isAndroidNative: () => fixture.native,
  actions: { openUrl: fixture.open },
}));
vi.mock("sonner", () => ({ toast: { error: fixture.error } }));
beforeEach(() => {
  fixture.native = false;
  fixture.open.mockReset().mockResolvedValue(undefined);
  fixture.error.mockReset();
});

it("opens the correct plugin configuration route for the web and Android", () => {
  expect(marketplaceConnectionsPath()).toBe("/?section=connections");
  fixture.native = true;
  expect(marketplaceConnectionsPath()).toBe("/android/stream-deck");
});

it("keeps normal browser links and opens affiliate links externally on Android", async () => {
  const event = { preventDefault: vi.fn(), defaultPrevented: false };
  const href = "https://meli.la/ABC?tracking=a%2Bb&campaign=viso";
  externalMarketplaceNavigation(event, href);
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(fixture.open).not.toHaveBeenCalled();
  fixture.native = true;
  externalMarketplaceNavigation(event, href);
  expect(event.preventDefault).toHaveBeenCalledOnce();
  await vi.waitFor(() =>
    expect(fixture.open).toHaveBeenCalledExactlyOnceWith(href),
  );
});

it("opens a bundled resource on the public web without leaking a WebView path", async () => {
  fixture.native = true;
  await openMarketplaceAsset("/marketplace/originals/libre.png");
  expect(fixture.open).toHaveBeenCalledWith(
    "https://viso-deck-android.vercel.app/marketplace/originals/libre.png",
  );
});

it("rejects unsafe links and cross-origin paths before calling the native browser", async () => {
  await expect(openMarketplaceAsset("javascript:alert(1)")).rejects.toThrow(
    "segura",
  );
  await expect(
    openMarketplaceAsset("https://user:secret@example.test/file.png"),
  ).rejects.toThrow("segura");
  expect(() => marketplaceWebUrl("//other.example/test")).toThrow(
    "no es válida",
  );
  expect(fixture.open).not.toHaveBeenCalled();
});
