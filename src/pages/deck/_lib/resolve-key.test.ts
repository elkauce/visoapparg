import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { resolveKeyFace, type DeckStatusInfo } from "./resolve-key.ts";

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
});
