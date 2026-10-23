import { describe, expect, it } from "vitest";
import {
  defaultTimbreQrDesign, makeTimbreSvg, timbreContrast, timbrePngAt300Dpi,
  timbrePrintSpecification, timbreQrRaster, validateTimbreQrDesign,
  validateTimbreQrUrl, verifyTimbreQrRaster,
} from "./timbre-qr";

const URL = "https://viso-deck-android.vercel.app/t/QRpublicoAleatorio01234567890123456789";

describe("Timbre printing safety", () => {
  it("encodes a real public URL that an independent QR decoder can read", () => {
    const raster = timbreQrRaster(URL);
    expect(verifyTimbreQrRaster(raster.data, raster.width, raster.height, URL)).toBe(true);
    expect(verifyTimbreQrRaster(raster.data, raster.width, raster.height, URL.replace("QRpublico", "OTROtoken"))).toBe(false);
    expect(verifyTimbreQrRaster(new Uint8ClampedArray(raster.data.length).fill(255), raster.width, raster.height, URL)).toBe(false);
  });

  it("preserves a four-module quiet zone on every side", () => {
    const raster = timbreQrRaster(URL, 4), zone = 16;
    for (let y = 0; y < raster.height; y++) for (let x = 0; x < raster.width; x++) {
      if (x < zone || y < zone || x >= raster.width - zone || y >= raster.height - zone)
        expect(raster.data[(y * raster.width + x) * 4]).toBe(255);
    }
  });

  it.each([
    "http://example.com/t/QRpublicoAleatorio01234567890123456789",
    "https://someone:secret@example.com/t/QRpublicoAleatorio01234567890123456789",
    "https://example.com/t/too-short", "tel:+541112345678",
    `${URL}?phone=541112345678`, `${URL}#admin`, "javascript:alert(1)",
  ])("refuses non-public or unsafe URL %s", (url) => expect(() => validateTimbreQrUrl(url)).toThrow());

  it("requires high contrast and dark modules on a light background", () => {
    const design = defaultTimbreQrDesign();
    expect(timbreContrast("#000000", "#FFFFFF")).toBeCloseTo(21);
    expect(() => validateTimbreQrDesign({ ...design, qrColor: "#AAAAAA" })).toThrow(/contraste/);
    expect(() => validateTimbreQrDesign({ ...design, qrColor: "#FFFFFF", qrBackground: "#000000" })).toThrow(/oscuros/);
    expect(() => validateTimbreQrDesign({ ...design, textColor: "#EEEEEE" })).toThrow(/texto/);
  });

  it("records real physical dimensions and rejects undersized modules", () => {
    const design = defaultTimbreQrDesign();
    expect(timbrePrintSpecification(URL, design)).toMatchObject({ trimWidthMm: 90, trimHeightMm: 130, bleedMm: 3, safeMarginMm: 6, quietZoneModules: 4, dpi: 300, decodedUrlVerified: false });
    expect(timbrePrintSpecification(URL, design).qrModuleMm).toBeGreaterThanOrEqual(.35);
    expect(timbrePrintSpecification(URL, design, true)).toMatchObject({ trimWidthMm: 90, trimHeightMm: 90, bleedMm: 0 });
    expect(() => timbrePrintSpecification(URL, { ...design, widthMm: 50, heightMm: 50 })).toThrow(/tamaño/);
    expect(() => validateTimbreQrDesign({ ...design, widthMm: 301 })).toThrow(/300/);
  });

  it("escapes user text and refuses executable uploaded images", () => {
    const design = defaultTimbreQrDesign('<script>alert("x")</script>');
    const svg = makeTimbreSvg(URL, design);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(() => makeTimbreSvg(URL, { ...design, imageDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" })).toThrow(/PNG o JPEG/);
    expect(() => makeTimbreSvg(URL, { ...design, imageDataUrl: 'https://example.com/image.png" onload="alert(1)' })).toThrow();
    expect(svg).toContain('width="96mm" height="136mm"');
  });

  it("exports QR independently of names, logos and plate decoration", () => {
    const svg = makeTimbreSvg(URL, { ...defaultTimbreQrDesign(), familyName: "Familia privada" }, true);
    expect(svg).not.toContain("Familia privada");
    expect(svg).not.toContain("clipPath");
    expect(svg).toContain('width="90mm" height="90mm"');
  });

  it("writes unambiguous 300 dpi PNG print metadata without duplicating it", () => {
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1kAAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
    const output = timbrePngAt300Dpi(png), view = new DataView(output.buffer);
    expect(String.fromCharCode(...output.slice(37, 41))).toBe("pHYs");
    expect(view.getUint32(41)).toBe(11811);
    expect(view.getUint32(45)).toBe(11811);
    expect(output[49]).toBe(1);
    expect(timbrePngAt300Dpi(output)).toEqual(output);
    expect(() => timbrePngAt300Dpi(new Uint8Array(60))).toThrow(/PNG/);
  });
});
