import QRCode from "qrcode";
import jsQR from "jsqr";

export type TimbreQrDesign = {
  title: string;
  streetNumber: string;
  familyName: string;
  businessName: string;
  unit: string;
  legend: string;
  backgroundColor: string;
  textColor: string;
  qrColor: string;
  qrBackground: string;
  font: "sans" | "serif" | "mono";
  emblem: "none" | "bell" | "home" | "office" | "flag-ar" | "flag-br" | "flag-uy";
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  imageDataUrl?: string;
};
export type TimbreQrExport = {
  blob: Blob;
  extension: "png" | "svg" | "pdf";
  filename: string;
  specification: TimbrePrintSpecification;
};
export type TimbrePrintSpecification = {
  trimWidthMm: number;
  trimHeightMm: number;
  bleedMm: number;
  safeMarginMm: number;
  dpi: 300;
  quietZoneModules: 4;
  qrModules: number;
  qrModuleMm: number;
  decodedUrlVerified: boolean;
};

const FONTS = { sans: "Arial, sans-serif", serif: "Georgia, serif", mono: "Courier New, monospace" };
const QUIET = 4;
const SAFE = 6;
const DPI = 300;
const MM_TO_PT = 72 / 25.4;
const MAX_IMAGE_BYTES = 700 * 1024;
const MAX_EXPORT_PIXELS = 16_000_000;

export function defaultTimbreQrDesign(label = "Timbre VISO"): TimbreQrDesign {
  return {
    title: label.slice(0, 80), streetNumber: "", familyName: "", businessName: "", unit: "",
    legend: "Escaneá para comunicarte", backgroundColor: "#F5F3EF", textColor: "#17191D",
    qrColor: "#17191D", qrBackground: "#FFFFFF", font: "sans", emblem: "bell",
    widthMm: 90, heightMm: 130, bleedMm: 3,
  };
}
function luminance(color: string) {
  const channels = color.slice(1).match(/../g)!.map((c) => parseInt(c, 16) / 255)
    .map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
export function timbreContrast(a: string, b: string) {
  if (!/^#[\da-f]{6}$/i.test(a) || !/^#[\da-f]{6}$/i.test(b)) return 0;
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}
export function validateTimbreQrUrl(value: string) {
  if (value.length > 600) throw new Error("El enlace del timbre es demasiado largo.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("El enlace del timbre no es válido."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.username || url.password || url.hash || url.search ||
      !/^\/t\/[A-Za-z0-9_-]{20,128}\/?$/.test(url.pathname)) {
    throw new Error("Usá el enlace público seguro que generó VISO para este timbre.");
  }
  return url.href;
}
export function validateTimbreQrDesign(design: TimbreQrDesign) {
  for (const color of [design.backgroundColor, design.textColor, design.qrColor, design.qrBackground])
    if (!/^#[\da-f]{6}$/i.test(color)) throw new Error("Elegí colores HEX válidos.");
  if (timbreContrast(design.qrColor, design.qrBackground) < 7 || luminance(design.qrColor) >= luminance(design.qrBackground))
    throw new Error("El QR necesita módulos oscuros y un fondo claro, con contraste mínimo 7:1.");
  if (timbreContrast(design.textColor, design.backgroundColor) < 4.5)
    throw new Error("Aumentá el contraste entre el texto y el fondo del diseño (mínimo 4,5:1).");
  for (const mm of [design.widthMm, design.heightMm])
    if (!Number.isFinite(mm) || mm < 50 || mm > 300) throw new Error("Cada lado de la placa debe medir entre 50 y 300 mm.");
  if (Math.max(design.widthMm, design.heightMm) / Math.min(design.widthMm, design.heightMm) > 2.8)
    throw new Error("La proporción de la placa no puede superar 2,8:1.");
  if (!Number.isFinite(design.bleedMm) || design.bleedMm < 0 || design.bleedMm > 5)
    throw new Error("La sangre debe estar entre 0 y 5 mm.");
  if (!(design.font in FONTS)) throw new Error("La tipografía no está disponible.");
  if (!["none", "bell", "home", "office", "flag-ar", "flag-br", "flag-uy"].includes(design.emblem))
    throw new Error("El ícono no está disponible.");
  for (const [field, max] of [[design.title, 80], [design.streetNumber, 16], [design.familyName, 80], [design.businessName, 80], [design.unit, 40], [design.legend, 140]] as const)
    if (typeof field !== "string" || field.length > max) throw new Error("Uno de los textos supera el largo permitido.");
  if (design.imageDataUrl && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(design.imageDataUrl))
    throw new Error("La imagen debe ser un PNG o JPEG seguro.");
  if (design.imageDataUrl && design.imageDataUrl.length > MAX_IMAGE_BYTES * 1.4)
    throw new Error("La imagen es demasiado grande para este diseño.");
}
function matrix(url: string) {
  const value = validateTimbreQrUrl(url);
  const qr = QRCode.create(value, { errorCorrectionLevel: "H" });
  return { value, size: qr.modules.size, data: qr.modules.data };
}
export function timbreQrRaster(url: string, modulePixels = 8) {
  if (!Number.isInteger(modulePixels) || modulePixels < 4 || modulePixels > 20) throw new Error("Resolución de QR inválida.");
  const qr = matrix(url), width = (qr.size + QUIET * 2) * modulePixels;
  const rgba = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < qr.size; row++) for (let col = 0; col < qr.size; col++) {
    if (!qr.data[row * qr.size + col]) continue;
    for (let y = 0; y < modulePixels; y++) for (let x = 0; x < modulePixels; x++) {
      const index = (((row + QUIET) * modulePixels + y) * width + (col + QUIET) * modulePixels + x) * 4;
      rgba[index] = rgba[index + 1] = rgba[index + 2] = 0;
    }
  }
  return { data: rgba, width, height: width, qrModules: qr.size };
}
export function verifyTimbreQrRaster(data: Uint8ClampedArray, width: number, height: number, url: string) {
  const decoded = jsQR(data, width, height, { inversionAttempts: "dontInvert" });
  return decoded?.data === validateTimbreQrUrl(url);
}
function layout(design: TimbreQrDesign, modules: number, qrOnly: boolean) {
  const wide = design.widthMm > design.heightMm;
  // Reserve an independent footer and keep all decoration outside the quiet zone.
  const portraitSpace = design.heightMm * .6 - SAFE - 3.625 - 2.9 - 3;
  const qrSize = qrOnly ? Math.min(design.widthMm, design.heightMm)
    : Math.min(wide ? design.heightMm - 2 * SAFE : portraitSpace, wide ? design.widthMm * 0.43 : design.widthMm - 2 * SAFE);
  const width = qrOnly ? qrSize : design.widthMm, height = qrOnly ? qrSize : design.heightMm;
  const x = qrOnly ? 0 : wide ? width - SAFE - qrSize : (width - qrSize) / 2;
  const y = qrOnly ? 0 : wide ? (height - qrSize) / 2 : height * 0.40;
  const moduleMm = qrSize / (modules + QUIET * 2);
  if (moduleMm < 0.35 || qrSize < 24) throw new Error("Aumentá el tamaño del diseño: el QR necesita módulos de al menos 0,35 mm y un lado de 24 mm.");
  return { width, height, x, y, qrSize, moduleMm, wide, bleed: qrOnly ? 0 : design.bleedMm };
}
function escape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function wrap(value: string, width: number, fontSize: number, limit: number) {
  const max = Math.max(3, Math.floor(width / (fontSize * 0.57))), lines: string[] = [];
  for (const word of value.trim().split(/\s+/)) {
    if (!word) continue;
    if (!lines.length || lines[lines.length - 1].length + word.length + 1 > max) lines.push(word);
    else lines[lines.length - 1] += " " + word;
  }
  return lines.slice(0, limit).map((l) => l.length > max ? l.slice(0, max - 1) + "…" : l);
}
function svgText(value: string, x: number, y: number, width: number, fontSize: number, maxLines: number, design: TimbreQrDesign, bold = false) {
  const lines = wrap(value, width, fontSize, maxLines);
  return `<text x="${x}" y="${y}" fill="${design.textColor}" font-family="${FONTS[design.font]}" font-size="${fontSize}" font-weight="${bold ? 700 : 400}">${lines.map((v, i) => `<tspan x="${x}" dy="${i ? fontSize * 1.25 : 0}">${escape(v)}</tspan>`).join("")}</text>`;
}
function emblemSvg(kind: TimbreQrDesign["emblem"], x: number, y: number, size: number, color: string) {
  const start = `<g transform="translate(${x},${y}) scale(${size / 24})">`, end = "</g>";
  if (kind === "flag-ar") return `${start}<path fill="#75aadb" d="M0 0h24v16H0z"/><path fill="#fff" d="M0 5.33h24v5.34H0z"/><circle cx="12" cy="8" r="1.6" fill="#f5b335"/>${end}`;
  if (kind === "flag-br") return `${start}<path fill="#168a45" d="M0 0h24v16H0z"/><path fill="#ffdf33" d="M12 1.5 22 8 12 14.5 2 8z"/><circle cx="12" cy="8" r="4" fill="#2456a5"/>${end}`;
  if (kind === "flag-uy") return `${start}<path fill="#fff" d="M0 0h24v16H0z"/><path stroke="#73a5dc" stroke-width="1.8" d="M0 3h24M0 7h24M0 11h24M0 15h24"/><path fill="#fff" d="M0 0h9v9H0z"/><circle cx="4.5" cy="4.5" r="2.5" fill="#e7b849"/>${end}`;
  const paths = {
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    home: '<path d="m3 10 9-7 9 7v11H3zM9 21v-8h6v8"/>',
    office: '<path d="M4 21V3h16v18M9 21v-4h6v4M8 7h1m6 0h1M8 11h1m6 0h1"/>',
    none: "",
  };
  if (!(kind in paths)) return "";
  return `${start}<g stroke="${color}" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[kind as keyof typeof paths]}</g>${end}`;
}
export function timbrePrintSpecification(url: string, design: TimbreQrDesign, qrOnly = false): TimbrePrintSpecification {
  validateTimbreQrDesign(design); const qr = matrix(url), p = layout(design, qr.size, qrOnly);
  return { trimWidthMm: p.width, trimHeightMm: p.height, bleedMm: p.bleed, safeMarginMm: qrOnly ? 0 : SAFE, dpi: DPI, quietZoneModules: QUIET, qrModules: qr.size, qrModuleMm: p.moduleMm, decodedUrlVerified: false };
}
/** Images, text and decorations never intersect the independent QR area. */
export function makeTimbreSvg(url: string, design: TimbreQrDesign, qrOnly = false, omitQr = false) {
  validateTimbreQrDesign(design);
  return renderTimbreSvg(design, qrOnly, omitQr, matrix(url));
}
/** Pre-purchase artwork never contains a functioning QR or a visitor URL. */
export function makeTimbrePreviewSvg(design: TimbreQrDesign) {
  validateTimbreQrDesign(design);
  return renderTimbreSvg(design, false, false);
}
function renderTimbreSvg(design: TimbreQrDesign, qrOnly: boolean, omitQr: boolean, qr?: ReturnType<typeof matrix>) {
  const p = layout(design, qr?.size ?? 33, qrOnly);
  const bg = qrOnly ? design.qrBackground : design.backgroundColor;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${p.width + p.bleed * 2}mm" height="${p.height + p.bleed * 2}mm" viewBox="${-p.bleed} ${-p.bleed} ${p.width + p.bleed * 2} ${p.height + p.bleed * 2}" role="img" aria-label="Timbre VISO"><rect x="${-p.bleed}" y="${-p.bleed}" width="${p.width + p.bleed * 2}" height="${p.height + p.bleed * 2}" fill="${bg}"/>`];
  if (!qrOnly) {
    const headWidth = p.wide ? p.x - SAFE * 2 : p.width - SAFE * 2;
    const imageSize = Math.min(18, headWidth * 0.27), hasArt = design.imageDataUrl || design.emblem !== "none";
    const titleWidth = hasArt ? headWidth - imageSize - 3 : headWidth;
    const headBottom = p.wide ? p.height - SAFE : p.y - 3;
    parts.push(`<defs><clipPath id="head"><rect x="${SAFE}" y="${SAFE}" width="${headWidth}" height="${headBottom - SAFE}"/></clipPath></defs><g clip-path="url(#head)">`);
    parts.push(svgText(design.title, SAFE, SAFE + 4, titleWidth, 3.7, 2, design, true));
    if (design.imageDataUrl) parts.push(`<image href="${design.imageDataUrl}" x="${SAFE + headWidth - imageSize}" y="${SAFE}" width="${imageSize}" height="${imageSize}" preserveAspectRatio="xMidYMid meet"/>`);
    else if (hasArt) parts.push(emblemSvg(design.emblem, SAFE + headWidth - imageSize, SAFE, imageSize, design.textColor));
    parts.push(svgText(design.streetNumber, SAFE, p.wide ? p.height * .45 : p.height * .21, headWidth, Math.min(11, p.height * .10), 1, design, true));
    const names = [design.familyName, design.businessName, design.unit ? `Unidad ${design.unit}` : ""].filter(Boolean).join(" · ");
    parts.push(svgText(names, SAFE, p.wide ? p.height * .64 : p.height * .29, headWidth, 3.5, p.wide ? 2 : 3, design));
    if (p.wide) parts.push(svgText(design.legend, SAFE, p.height - SAFE - 4, headWidth, 2.9, 2, design));
    parts.push("</g>");
    if (!p.wide) parts.push(svgText(design.legend, SAFE, p.height - SAFE - 3.625, p.width - SAFE * 2, 2.9, 2, design));
  }
  if (!omitQr) {
    parts.push(`<rect x="${p.x}" y="${p.y}" width="${p.qrSize}" height="${p.qrSize}" fill="${design.qrBackground}"/>`);
    if (!qr) {
      parts.push(`<rect x="${p.x + 2}" y="${p.y + 2}" width="${p.qrSize - 4}" height="${p.qrSize - 4}" rx="3" stroke="${design.qrColor}" stroke-width=".4" stroke-dasharray="1.5 1.5" fill="none"/>`);
      parts.push(emblemSvg("bell", p.x + p.qrSize / 2 - 5, p.y + p.qrSize / 2 - 11, 10, design.qrColor));
      parts.push(`<text x="${p.x + p.qrSize / 2}" y="${p.y + p.qrSize / 2 + 5}" text-anchor="middle" fill="${design.qrColor}" font-size="3.2" font-family="Arial, sans-serif">QR pendiente</text><text x="${p.x + p.qrSize / 2}" y="${p.y + p.qrSize / 2 + 10}" text-anchor="middle" fill="${design.qrColor}" font-size="2.2" font-family="Arial, sans-serif">Se vincula después del pago</text>`);
    } else {
    // Integer QR coordinates are transformed together; the quiet zone is never decorated.
    parts.push(`<g fill="${design.qrColor}" transform="translate(${p.x},${p.y}) scale(${p.moduleMm})" shape-rendering="crispEdges">`);
    for (let row = 0; row < qr.size; row++) for (let col = 0; col < qr.size; col++)
      if (qr.data[row * qr.size + col]) parts.push(`<rect x="${col + QUIET}" y="${row + QUIET}" width="1" height="1"/>`);
    parts.push("</g>");
    }
  }
  parts.push("</svg>"); return parts.join("");
}
export async function loadTimbreImage(source: File | string) {
  let blob: Blob;
  if (typeof source !== "string") blob = source;
  else {
    const url = new URL(source, window.location.origin);
    if (url.protocol !== "https:" && url.origin !== window.location.origin) throw new Error("La imagen de biblioteca necesita un enlace HTTPS seguro.");
    if (url.username || url.password) throw new Error("La imagen de biblioteca no es válida.");
    const response = await fetch(url.href, { credentials: "omit", redirect: "error" });
    if (!response.ok) throw new Error("No se pudo leer la imagen de la biblioteca.");
    const type = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (!["image/png", "image/jpeg"].includes(type)) throw new Error("Elegí una imagen PNG o JPEG de la biblioteca.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No se pudo leer la imagen de la biblioteca.");
    const chunks: Uint8Array<ArrayBuffer>[] = []; let length = 0;
    while (true) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength;
      if (length > MAX_IMAGE_BYTES) { await reader.cancel(); throw new Error("La imagen debe pesar hasta 700 KB."); }
      chunks.push(new Uint8Array(next.value));
    }
    blob = new Blob(chunks, { type });
  }
  if (!["image/png", "image/jpeg"].includes(blob.type) || blob.size > MAX_IMAGE_BYTES)
    throw new Error("Elegí un PNG o JPEG de hasta 700 KB.");
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if ((blob.type === "image/png" && !png) || (blob.type === "image/jpeg" && !jpeg)) throw new Error("El archivo no corresponde a una imagen válida.");
  const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("No se pudo leer la imagen.")); reader.readAsDataURL(blob); });
  const image = await imageElement(dataUrl);
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 4096 || image.naturalHeight > 4096)
    throw new Error("La imagen debe medir hasta 4096 × 4096 píxeles.");
  return dataUrl;
}
function imageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("No se pudo preparar la imagen para imprimir.")); image.src = source; });
}
async function canvasFromSvg(svg: string, widthMm: number, heightMm: number) {
  const width = Math.ceil(widthMm / 25.4 * DPI), height = Math.ceil(heightMm / 25.4 * DPI);
  if (width * height > MAX_EXPORT_PIXELS) throw new Error("El diseño supera el límite de resolución para exportar.");
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d"); if (!context) throw new Error("Este navegador no permite generar el archivo.");
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try { const image = await imageElement(objectUrl); context.drawImage(image, 0, 0, width, height); }
  finally { URL.revokeObjectURL(objectUrl); }
  return { canvas, context, width, height };
}
async function pngBlob(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("No se pudo generar el PNG.")), "image/png"));
  return new Blob([timbrePngAt300Dpi(new Uint8Array(await blob.arrayBuffer()))], { type: "image/png" });
}
/** Set PNG physical resolution so printing software receives 300 dpi, not 96 dpi. */
export function timbrePngAt300Dpi(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 33 || view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a || view.getUint32(12) !== 0x49484452)
    throw new Error("No se pudo preparar el archivo PNG de impresión.");
  const chunk = new Uint8Array(21), data = new DataView(chunk.buffer);
  data.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4);
  const pixelsPerMetre = Math.round(DPI / .0254);
  data.setUint32(8, pixelsPerMetre); data.setUint32(12, pixelsPerMetre); chunk[16] = 1;
  let crc = 0xffffffff;
  for (const byte of chunk.slice(4, 17)) { crc ^= byte; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  data.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const parts: Uint8Array[] = [bytes.slice(0, 33), chunk];
  for (let offset = 33; offset < bytes.length;) {
    if (offset + 12 > bytes.length) throw new Error("El PNG está incompleto.");
    const length = view.getUint32(offset), end = offset + length + 12;
    if (end > bytes.length) throw new Error("El PNG está incompleto.");
    if (view.getUint32(offset + 4) !== 0x70485973) parts.push(bytes.slice(offset, end));
    offset = end;
  }
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function pngBytes(canvas: HTMLCanvasElement) {
  const base64 = canvas.toDataURL("image/png").split(",")[1];
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
/** Export is refused unless jsQR decodes the actual 300-dpi rendered artifact. */
export async function exportTimbreQr(url: string, design: TimbreQrDesign, format: "png" | "svg" | "pdf", qrOnly = false): Promise<TimbreQrExport> {
  const specification = timbrePrintSpecification(url, design, qrOnly);
  const svg = makeTimbreSvg(url, design, qrOnly);
  const fullWidth = specification.trimWidthMm + specification.bleedMm * 2, fullHeight = specification.trimHeightMm + specification.bleedMm * 2;
  const rendered = await canvasFromSvg(svg, fullWidth, fullHeight);
  const pixels = rendered.context.getImageData(0, 0, rendered.width, rendered.height);
  if (!verifyTimbreQrRaster(pixels.data, rendered.width, rendered.height, url)) throw new Error("El diseño no superó la comprobación de lectura. Aumentá tamaño y contraste.");
  specification.decodedUrlVerified = true;
  let blob: Blob;
  if (format === "png") blob = await pngBlob(rendered.canvas);
  else if (format === "svg") blob = new Blob([svg], { type: "image/svg+xml" });
  else {
    const { PDFDocument, rgb } = await import("pdf-lib");
    const document = await PDFDocument.create(); document.setTitle("Timbre VISO · Archivo de impresión"); document.setCreator("VISO");
    const page = document.addPage([fullWidth * MM_TO_PT, fullHeight * MM_TO_PT]);
    page.setTrimBox(specification.bleedMm * MM_TO_PT, specification.bleedMm * MM_TO_PT, specification.trimWidthMm * MM_TO_PT, specification.trimHeightMm * MM_TO_PT);
    page.setBleedBox(0, 0, fullWidth * MM_TO_PT, fullHeight * MM_TO_PT);
    const qr = matrix(url), p = layout(design, qr.size, qrOnly);
    if (!qrOnly) {
      const decoration = await canvasFromSvg(makeTimbreSvg(url, design, false, true), fullWidth, fullHeight);
      const image = await document.embedPng(pngBytes(decoration.canvas));
      page.drawImage(image, { x: 0, y: 0, width: fullWidth * MM_TO_PT, height: fullHeight * MM_TO_PT });
    }
    const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
    const originX = (p.x + p.bleed) * MM_TO_PT, originTop = (p.y + p.bleed) * MM_TO_PT, size = p.qrSize * MM_TO_PT;
    page.drawRectangle({ x: originX, y: fullHeight * MM_TO_PT - originTop - size, width: size, height: size, color: color(design.qrBackground) });
    const module = p.moduleMm * MM_TO_PT;
    for (let row = 0; row < qr.size; row++) for (let col = 0; col < qr.size; col++) if (qr.data[row * qr.size + col])
      page.drawRectangle({ x: originX + (col + QUIET) * module, y: fullHeight * MM_TO_PT - originTop - (row + QUIET + 1) * module, width: module, height: module, color: color(design.qrColor) });
    const bytes = await document.save(); blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  }
  return { blob, extension: format, filename: `VISO-Timbre-${qrOnly ? "QR" : "Diseno"}-${specification.trimWidthMm}x${specification.trimHeightMm}mm.${format}`, specification };
}
export function downloadTimbreExport(file: TimbreQrExport) {
  const url = URL.createObjectURL(file.blob), a = document.createElement("a"); a.href = url; a.download = file.filename; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
