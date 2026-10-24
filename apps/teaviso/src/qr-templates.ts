import QRCode from "qrcode";
export const qrTemplates = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Blanco, limpio y discreto.",
    width: 900,
    height: 1200,
  },
  {
    id: "night",
    name: "Noche",
    description: "Grafito y acentos VISO.",
    width: 900,
    height: 1200,
  },
  {
    id: "signal",
    name: "Señal",
    description: "Alto contraste para accesos.",
    width: 900,
    height: 1200,
  },
  {
    id: "urban",
    name: "Urbano",
    description: "Formato horizontal para tu entrada.",
    width: 1200,
    height: 800,
  },
] as const;
export type QrTemplate = (typeof qrTemplates)[number]["id"];
export const normalizeTemplate = (value: unknown): QrTemplate =>
  qrTemplates.find((t) => t.id === value)?.id ?? "minimal";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[ch]!,
  );
function labelLines(
  label: string,
  x: number,
  y: number,
  color: string,
  max = 31,
) {
  const words = label.trim().slice(0, 80).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines
    .slice(0, 2)
    .map(
      (text, i) =>
        `<text x="${x}" y="${y + i * 38}" fill="${color}" font-size="27" font-weight="600">${escape(text.length > max ? text.slice(0, max - 1) + "…" : i === 1 && lines.length > 2 ? text.slice(0, max - 1) + "…" : text)}</text>`,
    )
    .join("");
}
function mark(x: number, y: number) {
  return `<svg x="${x}" y="${y}" width="45" height="45" viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="19" fill="#17191d"/><rect x="8" y="8" width="22" height="22" rx="7" fill="#00d562"/><rect x="34" y="8" width="22" height="22" rx="7" fill="#ff303b"/><rect x="8" y="34" width="22" height="22" rx="7" fill="#ffd51b"/><rect x="34" y="34" width="22" height="22" rx="7" fill="#ff7300"/></svg>`;
}
function brand(x: number, y: number, color: string) {
  return `${mark(x, y - 35)}<text x="${x + 60}" y="${y}" font-size="35" font-weight="750" letter-spacing="-1.5" fill="${color}">Te a Viso</text>`;
}
function qrGraphic(url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const segments: string[] = [];
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++)
      if (qr.modules.get(row, col))
        segments.push(`M${col + 4} ${row + 4}h1v1h-1z`);
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${n + 8} ${n + 8}"><rect width="${n + 8}" height="${n + 8}" fill="#fff"/><path d="${segments.join("")}" fill="#17191d" shape-rendering="crispEdges"/></svg>`;
}
/** Same SVG feeds the preview and both downloads; the QR's quiet zone stays intact. */
export function makeQrPlate(
  url: string,
  label: string,
  template: QrTemplate = "minimal",
) {
  const style = qrTemplates.find((t) => t.id === template) ?? qrTemplates[0];
  if (!url || url.length > 2048)
    throw new Error("El enlace del QR no es válido.");
  let content = "";
  if (style.id === "minimal")
    content = `<rect width="900" height="1200" rx="40" fill="#fff"/><rect x="24" y="24" width="852" height="1152" rx="25" fill="none" stroke="#ded8cf" stroke-width="2"/>${brand(74, 115, "#17191d")}<text x="74" y="245" font-size="76" font-weight="750" letter-spacing="-4">¿Llegaste?</text><text x="74" y="300" font-size="27" fill="#60646c">Tu visita empieza acá.</text>${qrGraphic(url, 190, 365, 520)}<path d="M75 950h750" stroke="#ded8cf"/><text x="74" y="1015" font-size="19" letter-spacing="3" fill="#e84300">ESCANEÁ PARA AVISAR</text>${labelLines(label, 74, 1070, "#17191d")}`;
  if (style.id === "night")
    content = `<defs><radialGradient id="halo"><stop stop-color="#e84300" stop-opacity=".38"/><stop offset="1" stop-color="#17191d" stop-opacity="0"/></radialGradient></defs><rect width="900" height="1200" rx="40" fill="#17191d"/><ellipse cx="750" cy="180" rx="700" ry="600" fill="url(#halo)"/>${brand(74, 115, "#fff")}<text x="74" y="240" font-size="70" font-weight="700" letter-spacing="-3" fill="#fff">Estás en</text><text x="74" y="320" font-size="70" font-weight="700" letter-spacing="-3" fill="#ffbf8f">el lugar correcto.</text><rect x="176" y="380" width="548" height="548" rx="30" fill="#fff"/>${qrGraphic(url, 190, 394, 520)}<text x="450" y="997" text-anchor="middle" font-size="20" letter-spacing="3" fill="#ffbf8f">ESCANEÁ Y AVISANOS</text><g transform="translate(0 0)">${labelLines(label, 74, 1090, "#fff")}</g>`;
  if (style.id === "signal")
    content = `<rect width="900" height="1200" rx="40" fill="#e84300"/>${brand(74, 115, "#fff")}<text x="74" y="242" font-size="86" font-weight="750" letter-spacing="-5" fill="#fff">Tocá timbre.</text><text x="74" y="298" font-size="26" fill="#fff0e6">Desde tu celular. Estés donde estés.</text><rect x="116" y="357" width="668" height="600" rx="32" fill="#fff"/>${qrGraphic(url, 190, 395, 520)}<path d="M70 1020h760" stroke="#ffffff55"/>${labelLines(label, 74, 1080, "#fff")}<path d="M746 1098h72m-23-23 23 23-23 23" stroke="#fff" stroke-width="6" fill="none"/>`;
  if (style.id === "urban")
    content = `<rect width="1200" height="800" rx="36" fill="#f5f3ef"/><path d="M0 0h560v800H0z" fill="#17191d"/>${brand(60, 105, "#fff")}<text x="60" y="285" font-size="76" font-weight="700" letter-spacing="-4" fill="#fff">Tu visita.</text><text x="60" y="375" font-size="76" font-weight="700" letter-spacing="-4" fill="#ffbf8f">Un aviso.</text><text x="60" y="466" font-size="24" fill="#dbc9bd">Escaneá para comunicarte.</text>${labelLines(label, 60, 650, "#fff", 25)}${qrGraphic(url, 625, 152, 510)}<text x="880" y="725" text-anchor="middle" font-size="18" letter-spacing="3" fill="#e84300">ESCANEÁ PARA AVISAR</text>`;
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${style.width / 10}mm" height="${style.height / 10}mm" viewBox="0 0 ${style.width} ${style.height}" role="img" aria-label="${escape(`Placa ${style.name}: ${label}`)}"><title>${escape(`Te a Viso · ${label}`)}</title><g font-family="Arial, Helvetica, sans-serif" fill="#17191d">${content}</g></svg>`,
    width: style.width,
    height: style.height,
  };
}
export async function qrPlatePng(svg: string, width: number, height: number) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la imagen.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
