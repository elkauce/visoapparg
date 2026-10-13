import {
  VU_STYLES,
  VU_STYLE_LABELS,
  type VuStyle,
} from "@/convex/lib/vu_styles";
export { VU_STYLES, VU_STYLE_LABELS };
export type VuFrame = {
  bands?: number[];
  wave?: number[];
  level?: number;
  peak?: number;
  db?: number;
  bandFrequencies?: number[];
  sampleRate?: number;
  fftSize?: number;
  channelLevels?: number[];
};
export function levelToPosition(level: number, sensitivity = 1) {
  return Math.max(
    0,
    Math.min(
      1,
      (20 *
        Math.log10(
          Math.max(0.001, Number.isFinite(level) ? level * sensitivity : 0),
        ) +
        60) /
        60,
    ),
  );
}
const text = (
  c: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "center",
) => {
  c.font = `600 ${size}px ui-sans-serif, system-ui`;
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(t, x, y);
};
function panel(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: VuStyle,
  level: number,
  label: string,
) {
  c.save();
  c.translate(x, y);
  const green = style === "analog-green",
    blue = style === "analog-blue",
    amber = style === "analog-amber" || style === "analog-bronze";
  const edge = Math.min(w, h) * 0.035;
  const outer = c.createLinearGradient(0, 0, w, h);
  outer.addColorStop(0, style === "analog-bronze" ? "#8a6040" : "#707579");
  outer.addColorStop(0.5, "#191b1c");
  outer.addColorStop(1, style === "analog-bronze" ? "#52321f" : "#53565a");
  c.fillStyle = outer;
  c.beginPath();
  c.roundRect(0, 0, w, h, edge);
  c.fill();
  c.fillStyle = "#08090a";
  c.beginPath();
  c.roundRect(edge, edge, w - edge * 2, h - edge * 2, edge * 0.65);
  c.fill();
  const face = c.createRadialGradient(
    w * 0.5,
    h * 0.3,
    1,
    w * 0.5,
    h * 0.5,
    Math.max(w, h),
  );
  face.addColorStop(
    0,
    green ? "#4effc8" : blue ? "#7de5f4" : amber ? "#fff1a5" : "#f9f9f4",
  );
  face.addColorStop(
    1,
    green ? "#077d60" : blue ? "#20a3c3" : amber ? "#dcac36" : "#c5c8c7",
  );
  c.fillStyle = face;
  c.beginPath();
  c.roundRect(edge * 2, edge * 2, w - edge * 4, h - edge * 4, edge * 0.3);
  c.fill();
  const scale = Math.min((w - edge * 4) / 600, (h - edge * 4) / 360);
  c.translate((w - 600 * scale) / 2, (h - 360 * scale) / 2);
  c.scale(scale, scale);
  const ink = green ? "#073c31" : blue ? "#124e61" : "#333225";
  const cx = 300,
    cy = 325,
    r = 244;
  const at = (a: number, rad: number) =>
    [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad] as const;
  const start = -Math.PI * 0.84,
    end = -Math.PI * 0.16;
  c.lineWidth = 2;
  c.strokeStyle = ink;
  c.beginPath();
  c.arc(cx, cy, r, start, end);
  c.stroke();
  c.strokeStyle = "#af2423";
  c.lineWidth = 11;
  c.beginPath();
  c.arc(cx, cy, r - 6, start + (end - start) * 0.8, end);
  c.stroke();
  for (let i = 0; i <= 30; i++) {
    const a = start + ((end - start) * i) / 30;
    const [x1, y1] = at(a, r - 4),
      [x2, y2] = at(a, r + (i % 5 === 0 ? 20 : 10));
    c.strokeStyle = i >= 25 ? "#972729" : ink;
    c.lineWidth = i % 5 === 0 ? 2.5 : 1;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    if (i % 5 === 0) {
      const [tx, ty] = at(a, r + 39);
      text(c, String(-60 + i * 2), tx, ty + 5, 18, ink);
    }
  }
  text(c, blue ? "OUTPUT LEVEL" : "VU", 300, 220, blue ? 24 : 38, ink);
  text(c, label, 48, 294, 12, ink, "left");
  text(c, "dBFS", 550, 294, 12, ink, "right");
  const a = start + (end - start) * level;
  const [nx, ny] = at(a, r + 16);
  c.shadowColor = "#0009";
  c.shadowBlur = 4;
  c.shadowOffsetX = 3;
  c.strokeStyle = green ? "#08392e" : "#242625";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(nx, ny);
  c.stroke();
  c.shadowBlur = 0;
  c.shadowOffsetX = 0;
  const knob = c.createRadialGradient(cx - 6, cy - 5, 1, cx, cy, 20);
  knob.addColorStop(0, "#edf1f1");
  knob.addColorStop(0.4, "#a2aaab");
  knob.addColorStop(1, "#171b1c");
  c.fillStyle = knob;
  c.beginPath();
  c.arc(cx, cy, 18, 0, Math.PI * 2);
  c.fill();
  for (const [bx, by] of [
    [8, 8],
    [592, 8],
    [8, 352],
    [592, 352],
  ]) {
    c.fillStyle = "#17191a";
    c.beginPath();
    c.arc(bx, by, 3, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
export function drawReferenceMeter(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: VuStyle,
  frame: VuFrame,
  sensitivity: number,
  color: string,
  held: number[],
  smooth: number[],
  deltaMs = 16.67,
) {
  c.shadowBlur = 0;
  c.shadowOffsetX = 0;
  c.shadowOffsetY = 0;
  c.globalAlpha = 1;
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#060708";
  c.fillRect(0, 0, w, h);
  const rms = frame.level ?? 0,
    peak =
      frame.peak ??
      frame.wave?.reduce((m, v) => Math.max(m, Math.abs(v)), 0) ??
      rms;
  const target = levelToPosition(rms, sensitivity),
    targetPeak = levelToPosition(peak, sensitivity);
  const response = 1 - Math.exp(-Math.min(100, Math.max(0, deltaMs)) / 150);
  smooth[0] = (smooth[0] ?? 0) + (target - (smooth[0] ?? 0)) * response;
  smooth[1] =
    (smooth[1] ?? 0) +
    (targetPeak - (smooth[1] ?? 0)) *
      (1 - Math.exp(-Math.min(100, Math.max(0, deltaMs)) / 80));
  if (style.startsWith("analog-")) {
    const double = ["analog-white", "analog-bronze", "analog-green"].includes(
      style,
    );
    const pad = Math.min(w, h) * 0.025;
    if (!double)
      panel(c, pad, pad, w - pad * 2, h - pad * 2, style, smooth[0], "NIVEL");
    else if (w > h) {
      panel(
        c,
        pad,
        pad,
        (w - pad * 3) / 2,
        h - pad * 2,
        style,
        smooth[0],
        "NIVEL",
      );
      panel(
        c,
        (w + pad) / 2,
        pad,
        (w - pad * 3) / 2,
        h - pad * 2,
        style,
        smooth[1],
        "PICO",
      );
    } else {
      panel(
        c,
        pad,
        pad,
        w - pad * 2,
        (h - pad * 3) / 2,
        style,
        smooth[0],
        "NIVEL",
      );
      panel(
        c,
        pad,
        (h + pad) / 2,
        w - pad * 2,
        (h - pad * 3) / 2,
        style,
        smooth[1],
        "PICO",
      );
    }
    return true;
  }
  if (style === "dual-led" || style === "levels") {
    const vertical = h > w;
    const count = style === "dual-led" ? 2 : 1;
    for (let row = 0; row < count; row++) {
      const value = smooth[row];
      for (let i = 0; i < 64; i++) {
        const on = i / 64 < value;
        c.fillStyle = i < 38 ? "#33ff24" : i < 50 ? "#ffb02e" : "#ff303d";
        c.globalAlpha = on ? 1 : 0.08;
        if (vertical) {
          const span = (w * 0.8) / count;
          c.fillRect(
            w * 0.1 + row * span + span * 0.12,
            h * 0.92 - ((i + 1) * h * 0.84) / 64,
            span * 0.76,
            ((h * 0.84) / 64) * 0.72,
          );
        } else {
          const span = (h * 0.8) / count;
          c.fillRect(
            w * 0.08 + (i * w * 0.84) / 64,
            h * 0.1 + row * span + span * 0.12,
            ((w * 0.84) / 64) * 0.72,
            span * 0.76,
          );
        }
      }
    }
    c.globalAlpha = 1;
    return true;
  }
  if (["bars", "mirror", "radial", "wave"].includes(style)) {
    const bands = frame.bands ?? Array(32).fill(rms);
    const decay = (Math.max(0, deltaMs) / 1000) * 0.35;
    if (style === "wave") {
      const samples = frame.wave ?? Array(64).fill(0);
      const gradient = c.createLinearGradient(0, 0, w, 0);
      for (let i = 0; i <= 6; i++)
        gradient.addColorStop(i / 6, `hsl(${i * 60} 100% 60%)`);
      c.strokeStyle = gradient;
      c.lineWidth = Math.max(2, Math.min(w, h) * 0.007);
      c.beginPath();
      samples.forEach((sample, i) => {
        const x = (i * w) / Math.max(1, samples.length - 1);
        const y =
          h / 2 - Math.max(-1, Math.min(1, sample * sensitivity)) * h * 0.45;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.stroke();
      return true;
    }
    bands.forEach((amplitude, i) => {
      const value = levelToPosition(amplitude, sensitivity);
      held[i] = Math.max(value, (held[i] ?? 0) - decay);
      c.fillStyle = color;
      c.strokeStyle = `hsl(${(i / bands.length) * 360} 100% 60%)`;
      const bw = w / bands.length;
      if (style === "radial") {
        const radius = Math.min(w, h) * 0.18;
        const angle = (i / bands.length) * Math.PI * 2;
        c.lineWidth = Math.max(2, Math.min(w, h) * 0.015);
        c.beginPath();
        c.moveTo(
          w / 2 + Math.cos(angle) * radius,
          h / 2 + Math.sin(angle) * radius,
        );
        c.lineTo(
          w / 2 + Math.cos(angle) * (radius + value * Math.min(w, h) * 0.27),
          h / 2 + Math.sin(angle) * (radius + value * Math.min(w, h) * 0.27),
        );
        c.stroke();
      } else if (style === "mirror") {
        c.fillStyle = `hsl(${(i / bands.length) * 360} 100% 60%)`;
        c.fillRect(
          i * bw + bw * 0.12,
          h / 2 - value * h * 0.46,
          bw * 0.76,
          value * h * 0.92,
        );
      } else {
        c.fillRect(
          i * bw + bw * 0.12,
          h - value * h * 0.94,
          bw * 0.76,
          value * h * 0.94,
        );
        c.fillStyle = "#ffffff";
        if (held[i] > 0)
          c.fillRect(
            i * bw + bw * 0.12,
            Math.max(0, h - held[i] * h * 0.94 - 2),
            bw * 0.76,
            2,
          );
      }
    });
    return true;
  }
  if (style === "spectrum" || style === "spectrum-led") {
    const bands = frame.bands ?? Array(32).fill(0);
    const left = w * 0.07,
      top = h * 0.12,
      bottom = h * 0.87,
      ww = w * 0.88,
      hh = bottom - top;
    c.shadowBlur = 0;
    for (let tick = 0; tick <= 6; tick++) {
      const y = bottom - (hh * tick) / 6;
      c.strokeStyle = "#ffffff10";
      c.beginPath();
      c.moveTo(left, y);
      c.lineTo(left + ww, y);
      c.stroke();
      text(
        c,
        String(-60 + tick * 10),
        left - 10,
        y + 4,
        Math.max(10, w * 0.012),
        "#a0a7b6",
        "right",
      );
    }
    bands.forEach((v, i) => {
      const value = levelToPosition(v, sensitivity);
      const bh = value * hh;
      const bw = ww / bands.length;
      held[i] = Math.max(value, (held[i] ?? 0) - 0.006);
      c.fillStyle = `hsl(${(190 + (i / bands.length) * 300) % 360} 88% 60%)`;
      if (style === "spectrum-led") {
        const rows = 26;
        for (let j = 0; j < rows; j++) {
          c.globalAlpha = j / rows < value ? 1 : 0.06;
          c.fillRect(
            left + i * bw + bw * 0.12,
            bottom - ((j + 1) * hh) / rows,
            bw * 0.76,
            (hh / rows) * 0.68,
          );
        }
        c.globalAlpha = 1;
      } else {
        c.fillRect(left + i * bw + bw * 0.12, bottom - bh, bw * 0.76, bh);
      }
      c.fillStyle = "#a5acff";
      c.fillRect(
        left + i * bw + bw * 0.15,
        bottom - held[i] * hh - 3,
        bw * 0.7,
        2,
      );
    });
    if (frame.bandFrequencies?.length === bands.length) {
      for (let i = 0; i < bands.length; i += 4) {
        const hz = frame.bandFrequencies[i];
        text(
          c,
          hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : String(Math.round(hz)),
          left + ((i + 0.5) * ww) / bands.length,
          h * 0.94,
          Math.max(9, w * 0.012),
          "#8892a6",
        );
      }
    } else
      text(
        c,
        "BANDAS DE AUDIO",
        w / 2,
        h * 0.96,
        Math.max(10, w * 0.014),
        "#8892a6",
      );
    return true;
  }
  return false;
}
