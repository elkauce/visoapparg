import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import KeyEditor, { type EditTarget } from "./key-editor.tsx";

const state = vi.hoisted(() => ({
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  error: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    state.mutations[name] ??= vi.fn(async () => null);
    return state.mutations[name];
  },
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthToken: () => "test-token" }));
vi.mock("sonner", () => ({ toast: { error: state.error } }));
vi.mock("@/lib/android-native.ts", () => ({
  isAndroidNative: () => false,
  nativeDeck: {},
}));

const statuses = [
  { _id: "free", name: "Libre", color: "#22c55e", icon: "check-circle" },
];
const pages = [{ _id: "page-one", name: "Principal" }];
const target: EditTarget = {
  pageId: "page-one",
  position: 0,
  keyId: "key-one",
  content: { kind: "status", statusId: "free" as Id<"statuses"> },
  appearance: {
    mediaStorageId: "owned-media" as Id<"_storage">,
    mediaType: "image",
    mediaUrl: "https://example.com/key.gif",
  },
};

beforeEach(() => {
  state.mutations = {};
  state.error.mockReset();
});

describe("KeyEditor persisted visibility", () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
  ])(
    "saves label=%s icon=%s using the current API while keeping the media and action",
    async (showLabel, showIcon) => {
      const onClose = vi.fn();
      render(
        <KeyEditor
          target={target}
          statuses={statuses}
          pages={pages}
          advanced
          onClose={onClose}
        />,
      );
      if (!showLabel)
        fireEvent.click(screen.getByRole("switch", { name: "Mostrar nombre" }));
      if (!showIcon)
        fireEvent.click(screen.getByRole("switch", { name: "Mostrar icono" }));
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(state.mutations["deck_layout:moveKey"]).toHaveBeenCalledWith({
        keyId: "key-one",
        pageId: "page-one",
        position: 0,
        swap: false,
        from: { pageId: "page-one", position: 0 },
        content: target.content,
        appearance: {
          icon: `viso1:check-circle:${Number(showLabel)}${Number(showIcon)}`,
          mediaStorageId: "owned-media",
          mediaType: "image",
        },
      });
      expect(state.error).not.toHaveBeenCalled();
    },
  );

  it("restores preferences from a synchronized key when reopening the editor", () => {
    const saved: EditTarget = {
      ...target,
      appearance: { ...target.appearance, icon: "viso1:check-circle:00" },
    };
    render(
      <KeyEditor
        target={saved}
        statuses={statuses}
        pages={pages}
        advanced
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("switch", { name: "Mostrar nombre" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Mostrar icono" }),
    ).not.toBeChecked();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Libre");
  });

  it("returns to the legacy icon when both elements are visible again", async () => {
    const saved: EditTarget = {
      ...target,
      appearance: { ...target.appearance, icon: "viso1:check-circle:00" },
    };
    const onClose = vi.fn();
    render(
      <KeyEditor
        target={saved}
        statuses={statuses}
        pages={pages}
        advanced
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar nombre" }));
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar icono" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(
      state.mutations["deck_layout:moveKey"].mock.calls[0][0].appearance,
    ).toEqual({
      icon: "check-circle",
      mediaStorageId: "owned-media",
      mediaType: "image",
    });
  });

  it("retains hidden elements when another appearance field changes", async () => {
    const saved: EditTarget = {
      ...target,
      appearance: { ...target.appearance, icon: "viso1:check-circle:00" },
    };
    const onClose = vi.fn();
    render(
      <KeyEditor
        target={saved}
        statuses={statuses}
        pages={pages}
        advanced
        onClose={onClose}
      />,
    );
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Disponible" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(
      state.mutations["deck_layout:moveKey"].mock.calls[0][0],
    ).toMatchObject({
      content: target.content,
      appearance: {
        label: "Disponible",
        icon: "viso1:check-circle:00",
        mediaStorageId: "owned-media",
        mediaType: "image",
      },
    });
  });

  it("restores the original appearance and both visible elements without changing the action", async () => {
    const saved: EditTarget = {
      ...target,
      appearance: { ...target.appearance, icon: "viso1:check-circle:00" },
    };
    const onClose = vi.fn();
    render(
      <KeyEditor
        target={saved}
        statuses={statuses}
        pages={pages}
        advanced
        onClose={onClose}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Restablecer aspecto original" }),
    );
    expect(
      screen.getByRole("switch", { name: "Mostrar nombre" }),
    ).toBeChecked();
    expect(screen.getByRole("switch", { name: "Mostrar icono" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(
      state.mutations["deck_layout:moveKey"].mock.calls[0][0],
    ).toMatchObject({ content: target.content, appearance: null });
  });
});
