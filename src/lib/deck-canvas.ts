import { readableTextColor } from "@/lib/color.ts";

type KeyFace = {
  name: string;
  color: string;
  active: boolean;
};

const FONT = '"Space Grotesk", "Geist", system-ui, sans-serif';

// Parte el nombre en líneas que quepan en el ancho de la tecla
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.slice(0, 3);
}

// Dibuja una tecla del Stream Deck: activa = color completo, inactiva = oscura con barra de color
export function drawKeyFace(
  canvas: HTMLCanvasElement,
  { name, color, active }: KeyFace,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const { width, height } = canvas;

  ctx.fillStyle = active ? color : "#14151a";
  ctx.fillRect(0, 0, width, height);

  if (!active) {
    ctx.fillStyle = color;
    ctx.fillRect(width * 0.18, height - height * 0.09, width * 0.64, height * 0.09);
  }

  ctx.fillStyle = active ? readableTextColor(color) : "#f5f5f0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = Math.round(width * 0.2);
  ctx.font = `700 ${fontSize}px ${FONT}`;
  const lines = wrapText(ctx, name, width * 0.86);
  const lineHeight = fontSize * 1.15;
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, width / 2, startY + i * lineHeight));
}
