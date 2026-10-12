import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { getStatusIcon } from "./status-icons";

export async function createElgatoKeyImages(icon: string, color: string) {
  const tint = /^#[0-9a-f]{6}$/i.test(color) ? color : "#22c55e";
  const container = document.createElement("div");
  const root = createRoot(container);
  let svg: string;
  try {
    flushSync(() =>
      root.render(
        createElement(getStatusIcon(icon), {
          color: tint,
          size: 76,
          strokeWidth: 1.8,
        }),
      ),
    );
    svg = container.querySelector("svg")!.outerHTML;
  } finally {
    root.unmount();
  }
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Icon render failed"));
      image.src = url;
    });
    const render = async (size: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(size / 144, size / 144);
      ctx.fillStyle = "#101216";
      ctx.fillRect(0, 0, 144, 144);
      ctx.strokeStyle = tint;
      ctx.lineWidth = 3;
      ctx.shadowColor = tint;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(5, 5, 134, 134, 20);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.drawImage(image, 34, 20, 76, 76);
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.roundRect(24, 133, 96, 4, 2);
      ctx.fill();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("PNG render failed")),
          "image/png",
        ),
      );
      return new Uint8Array(await blob.arrayBuffer());
    };
    return { normal: await render(72), retina: await render(144) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
