import { useId } from "react";

export type CanvasBackdropProps = {
  mediaUrl: string;
  mediaType: "image" | "video";
  columns: number;
  tileWidth: number;
  tileHeight: number;
  gap: number;
  /** Populated positions relative to the currently visible grid. */
  positions: number[];
};

/** A single media plane, revealed only through the populated tile footprints. */
export function CanvasBackdrop({
  mediaUrl,
  mediaType,
  columns,
  tileWidth,
  tileHeight,
  gap,
  positions,
}: CanvasBackdropProps) {
  const id = useId();
  const clipId = `deck-canvas-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const visiblePositions = [...new Set(positions)].filter(
    (position) => Number.isInteger(position) && position >= 0,
  );
  if (
    !mediaUrl ||
    !Number.isInteger(columns) ||
    columns < 1 ||
    !Number.isFinite(tileWidth) ||
    tileWidth <= 0 ||
    !Number.isFinite(tileHeight) ||
    tileHeight <= 0 ||
    !Number.isFinite(gap) ||
    gap < 0 ||
    visiblePositions.length === 0
  )
    return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <svg
        width="0"
        height="0"
        focusable="false"
        style={{ position: "absolute" }}
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            {visiblePositions.map((position) => (
              <rect
                key={position}
                x={(position % columns) * (tileWidth + gap)}
                y={Math.floor(position / columns) * (tileHeight + gap)}
                width={tileWidth}
                height={tileHeight}
                rx={16}
              />
            ))}
          </clipPath>
        </defs>
      </svg>
      <div className="absolute inset-0" style={{ clipPath: `url(#${clipId})` }}>
        {mediaType === "video" ? (
          <video
            src={mediaUrl}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <img
            src={mediaUrl}
            alt=""
            draggable={false}
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <span className="absolute inset-0 bg-black/35" />
      </div>
    </div>
  );
}

export default CanvasBackdrop;
