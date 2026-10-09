import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  resolveKeyFace,
  type DeckStatusInfo,
  type KeyContent,
} from "./resolve-key.ts";
import { encodeKeyVisibility } from "./key-visibility.ts";

const statuses: DeckStatusInfo[] = [
  { _id: "free", name: "Libre", color: "#22c55e", icon: "check-circle" },
  { _id: "busy", name: "Ocupado", color: "#ef4444", icon: "ban" },
];

describe("original Deck faces", () => {
  it("preserves each original status colour and icon when selected", () => {
    expect(
      resolveKeyFace(
        { kind: "status", statusId: "free" as Id<"statuses"> },
        statuses,
        "free",
        0,
      ),
    ).toEqual({
      label: "Libre",
      icon: "check-circle",
      color: "#22c55e",
      active: true,
    });
    expect(
      resolveKeyFace(
        { kind: "status", statusId: "busy" as Id<"statuses"> },
        statuses,
        "free",
        0,
      ),
    ).toEqual({
      label: "Ocupado",
      icon: "ban",
      color: "#ef4444",
      active: false,
    });
  });
  it("does not create invented faces for deleted statuses or live widgets", () => {
    expect(
      resolveKeyFace(
        { kind: "status", statusId: "removed" as Id<"statuses"> },
        statuses,
        "free",
        0,
      ),
    ).toBeNull();
    expect(resolveKeyFace({ kind: "clock" }, statuses, "free", 0)).toBeNull();
  });
  it("shows off as selected only when Convex confirms no active status", () => {
    expect(resolveKeyFace({ kind: "off" }, statuses, null, 0)).toEqual({
      label: "Apagar",
      icon: "power",
      color: "#64748b",
      active: true,
    });
    expect(resolveKeyFace({ kind: "off" }, statuses, "busy", 0)?.active).toBe(
      false,
    );
  });
  it("applies only saved, explicit appearance overrides without mutating statuses", () => {
    const original = structuredClone(statuses);
    const face = resolveKeyFace(
      { kind: "status", statusId: "free" as Id<"statuses"> },
      statuses,
      "free",
      0,
      {
        label: "Disponible",
        color: "#123456",
        mediaUrl: "https://example.com/deck.gif",
        mediaType: "image",
      },
    );
    expect(face).toMatchObject({
      label: "Disponible",
      color: "#123456",
      icon: "check-circle",
      active: true,
      mediaType: "image",
    });
    expect(statuses).toEqual(original);
  });
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    "reads per-key label=%s icon=%s without changing its action or other keys",
    (showLabel, showIcon) => {
      const content: KeyContent = {
        kind: "status",
        statusId: "free" as Id<"statuses">,
      };
      const original = structuredClone(content);
      const face = resolveKeyFace(content, statuses, "free", 0, {
        icon: encodeKeyVisibility("check-circle", showLabel, showIcon),
        mediaUrl: "https://example.com/deck.mp4",
        mediaType: "video",
      });
      expect(face).toMatchObject({
        label: "Libre",
        icon: "check-circle",
        showLabel,
        showIcon,
        active: true,
        mediaType: "video",
        mediaUrl: "https://example.com/deck.mp4",
      });
      expect(content).toEqual(original);
      expect(
        resolveKeyFace(
          { kind: "status", statusId: "busy" as Id<"statuses"> },
          statuses,
          "free",
          0,
        ),
      ).toEqual({
        label: "Ocupado",
        icon: "ban",
        color: "#ef4444",
        active: false,
      });
    },
  );
  it("uses the real app icon as the default and preserves a custom icon", () => {
    const content: KeyContent = {
      kind: "action",
      label: "Spotify",
      icon: "globe",
      color: "#22c55e",
      action: { type: "android-app", packageName: "com.spotify.music" },
    };
    expect(resolveKeyFace(content, [], null, 0)).toMatchObject({
      icon: "android-app",
      appPackageName: "com.spotify.music",
    });
    expect(
      resolveKeyFace(content, [], null, 0, { icon: "music" }),
    ).toMatchObject({ icon: "music" });
    expect(
      resolveKeyFace(content, [], null, 0, { icon: "music" }),
    ).not.toHaveProperty("appPackageName");
    expect(
      resolveKeyFace({ ...content, icon: "headphones" }, [], null, 0),
    ).toMatchObject({ icon: "headphones" });
  });
});
