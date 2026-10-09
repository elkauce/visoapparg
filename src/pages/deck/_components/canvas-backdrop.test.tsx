import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CanvasBackdrop,
  type CanvasBackdropProps,
} from "./canvas-backdrop.tsx";

const base: CanvasBackdropProps = {
  mediaUrl: "https://example.com/backdrop.mp4",
  mediaType: "video",
  columns: 5,
  tileWidth: 100,
  tileHeight: 80,
  gap: 12,
  positions: [0, 1, 5],
};

describe("CanvasBackdrop", () => {
  it("uses a single muted video for thirty-two keys", () => {
    const { container } = render(
      <CanvasBackdrop
        {...base}
        columns={8}
        positions={Array.from({ length: 32 }, (_, position) => position)}
      />,
    );
    const videos = container.querySelectorAll("video");

    expect(videos).toHaveLength(1);
    expect(videos[0].muted).toBe(true);
    expect(videos[0]).toHaveAttribute("loop");
    expect(videos[0]).toHaveAttribute("autoplay");
    expect(videos[0]).toHaveAttribute("playsinline");
    expect(videos[0]).toHaveAttribute("preload", "metadata");
    expect(videos[0]).toHaveClass("object-cover", "size-full");
    expect(container.querySelectorAll("rect")).toHaveLength(32);
  });

  it("clips only populated rectangles and leaves twelve-pixel gaps", () => {
    const { container } = render(<CanvasBackdrop {...base} />);
    const rectangles = [...container.querySelectorAll("rect")];

    expect(
      rectangles.map((rectangle) => ({
        x: rectangle.getAttribute("x"),
        y: rectangle.getAttribute("y"),
        width: rectangle.getAttribute("width"),
        height: rectangle.getAttribute("height"),
        rx: rectangle.getAttribute("rx"),
      })),
    ).toEqual([
      { x: "0", y: "0", width: "100", height: "80", rx: "16" },
      { x: "112", y: "0", width: "100", height: "80", rx: "16" },
      { x: "0", y: "92", width: "100", height: "80", rx: "16" },
    ]);
    expect(container.querySelector("clipPath")).toHaveAttribute(
      "clipPathUnits",
      "userSpaceOnUse",
    );
    expect(container.firstElementChild).toHaveStyle({
      backgroundColor: "#000",
    });
  });

  it("recomputes the footprints on orientation change without another plane", () => {
    const { container, rerender } = render(<CanvasBackdrop {...base} />);
    const originalVideo = container.querySelector("video");

    rerender(
      <CanvasBackdrop {...base} columns={3} tileWidth={110} tileHeight={130} />,
    );

    expect(container.querySelectorAll("video")).toHaveLength(1);
    expect(container.querySelector("video")).toBe(originalVideo);
    const last = container.querySelectorAll("rect")[2];
    expect(last).toHaveAttribute("x", "244");
    expect(last).toHaveAttribute("y", "142");
    expect(last).toHaveAttribute("width", "110");
    expect(last).toHaveAttribute("height", "130");
  });

  it("fills the parent bounds and never captures input", () => {
    const { container } = render(<CanvasBackdrop {...base} />);
    const root = container.firstElementChild;

    expect(root).toHaveStyle({
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      overflow: "hidden",
    });
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("video")?.parentElement).toHaveClass(
      "absolute",
      "inset-0",
    );
  });

  it("assigns a unique CSS-safe clip reference to each instance", () => {
    const { container } = render(
      <>
        <CanvasBackdrop {...base} />
        <CanvasBackdrop {...base} />
      </>,
    );
    const clips = [...container.querySelectorAll("clipPath")];
    const ids = clips.map((clip) => clip.id);

    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => /^[a-zA-Z0-9_-]+$/.test(id))).toBe(true);
    const wrappers = [...container.querySelectorAll("video")].map(
      (video) => video.parentElement,
    );
    expect(wrappers[0]).toHaveStyle({ clipPath: `url(#${ids[0]})` });
    expect(wrappers[1]).toHaveStyle({ clipPath: `url(#${ids[1]})` });
  });

  it("uses one image across the entire grid for an image backdrop", () => {
    const { container } = render(
      <CanvasBackdrop
        {...base}
        mediaType="image"
        mediaUrl="https://example.com/backdrop.jpg"
      />,
    );

    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelectorAll("video")).toHaveLength(0);
    expect(container.querySelector("img")).toHaveClass(
      "object-cover",
      "size-full",
    );
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("does not decode a backdrop when there are no populated keys", () => {
    const { container } = render(<CanvasBackdrop {...base} positions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not create duplicate or invalid footprints", () => {
    const { container } = render(
      <CanvasBackdrop {...base} positions={[0, 0, 1, -1, 1.5, Number.NaN]} />,
    );
    expect(container.querySelectorAll("rect")).toHaveLength(2);
    expect(container.querySelectorAll("video")).toHaveLength(1);
  });
});
