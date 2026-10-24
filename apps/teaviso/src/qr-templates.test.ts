import { describe, it, expect } from "vitest";
import { makeQrPlate, normalizeTemplate, qrTemplates } from "./qr-templates";
describe("Printable plate integrity", () => {
  it("has four distinct layouts with real module paths and a four-module quiet zone", () => {
    const urls = qrTemplates.map((template) =>
      makeQrPlate(
        "https://teaviso.example/w/" + "a".repeat(64),
        "Oficina",
        template.id,
      ),
    );
    expect(new Set(urls.map((x) => x.svg)).size).toBe(4);
    for (const result of urls) {
      const document = new DOMParser().parseFromString(
        result.svg,
        "image/svg+xml",
      );
      expect(document.querySelector("parsererror")).toBeNull();
      expect(
        document.querySelector('svg svg path[shape-rendering="crispEdges"]'),
      ).not.toBeNull();
      expect(document.querySelector("svg svg rect")?.getAttribute("fill")).toBe(
        "#fff",
      );
      expect(document.querySelector("svg svg path")?.getAttribute("d")).toMatch(
        /M4 /,
      );
    }
    expect(urls[3].width).toBeGreaterThan(urls[3].height);
  });
  it("escapes user labels and bounds their display", () => {
    const plate = makeQrPlate(
      "https://teaviso.example/",
      '<script>alert("x")</script> & nombre ' + "largo".repeat(30),
    );
    const document = new DOMParser().parseFromString(
      plate.svg,
      "image/svg+xml",
    );
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("parsererror")).toBeNull();
    expect(plate.svg).toContain("&lt;script&gt;");
  });
  it("falls back for old entries and keeps excessive links out of export", () => {
    expect(normalizeTemplate(undefined)).toBe("minimal");
    expect(normalizeTemplate("unknown")).toBe("minimal");
    expect(normalizeTemplate("urban")).toBe("urban");
    expect(() => makeQrPlate("x".repeat(2049), "Entry")).toThrow();
  });
});
