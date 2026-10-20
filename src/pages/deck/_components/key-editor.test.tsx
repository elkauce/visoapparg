import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import KeyEditor, { type EditTarget } from "./key-editor.tsx";

const state = vi.hoisted(() => ({
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  error: vi.fn(),
  upload: vi.fn(),
  libraryLoad: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    state.mutations[name] ??= vi.fn(async () => null);
    return state.mutations[name];
  },
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthToken: () => "test-token" }));
vi.mock("sonner", () => ({ toast: { error: state.error, success: vi.fn() } }));
vi.mock("@/lib/android-native.ts", () => ({
  isAndroidNative: () => false,
  nativeDeck: {},
}));
vi.mock("../_lib/upload-media.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../_lib/upload-media.ts")>()),
  uploadKeyMedia: state.upload,
}));
vi.mock("@/components/marketplace/key-asset-picker.tsx", () => ({
  default: ({
    onSelect,
  }: {
    onSelect: (selection: {
      id: string;
      name: string;
      previewUrl: string;
      mediaType: "video";
      load: typeof state.libraryLoad;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onSelect({
          id: "creator-pack/animated-logo",
          name: "Logo animado",
          previewUrl: "https://example.com/logo.mp4",
          mediaType: "video",
          load: state.libraryLoad,
        })
      }
    >
      Seleccionar logo animado
    </button>
  ),
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
  state.upload.mockReset().mockResolvedValue({
    storageId: "new-owned-media",
    mediaType: "image",
  });
  state.libraryLoad.mockReset().mockResolvedValue({
    storageId: "copied-owned-media",
    mediaType: "video",
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:local-key-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
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

it.each([
  { name: "Jugando", rgb: "#12abef", existing: statuses },
  { name: "Pepe", rgb: "#ffff00", existing: [] },
])(
  "creates $name with its own RGB even without any preset",
  async ({ name, rgb, existing }) => {
    const onClose = vi.fn();
    render(
      <KeyEditor
        target={{
          ...target,
          keyId: null,
          content: null,
          appearance: undefined,
        }}
        statuses={existing}
        pages={pages}
        advanced
        onClose={onClose}
      />,
    );
    state.mutations["statuses:create"].mockResolvedValue("playing");
    fireEvent.change(screen.getByLabelText("O creá tu propio estado"), {
      target: { value: name },
    });
    fireEvent.change(screen.getByLabelText("Color RGB"), {
      target: { value: rgb },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear y usar" }));
    await waitFor(() =>
      expect(state.mutations["statuses:create"]).toHaveBeenCalledWith({
        name,
        color: rgb,
        icon: "star",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(state.mutations["deck_layout:setKey"]).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { kind: "status", statusId: "playing" },
      }),
    );
  },
);

it("saves Pepe as an independent yellow RGB key without creating or selecting a status", async () => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  const onClose = vi.fn();
  render(
    <KeyEditor
      target={{ ...target, keyId: null, content: null, appearance: undefined }}
      statuses={statuses}
      pages={pages}
      advanced
      onClose={onClose}
    />,
  );
  fireEvent.keyDown(screen.getAllByRole("combobox")[0], { key: "ArrowDown" });
  fireEvent.click(
    await screen.findByRole("option", { name: "Tecla personalizada RGB" }),
  );
  fireEvent.change(screen.getByLabelText("Nombre"), {
    target: { value: "Pepe" },
  });
  fireEvent.change(screen.getByLabelText("Color personalizado"), {
    target: { value: "#ffff00" },
  });
  expect(screen.queryByText("O creá tu propio estado")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(state.mutations["statuses:create"]).not.toHaveBeenCalled();
  expect(state.mutations["deck_layout:setKey"]).toHaveBeenCalledWith(
    expect.objectContaining({
      content: {
        kind: "action",
        label: "Pepe",
        icon: "star",
        color: "#ffff00",
        action: {
          type: "rgb",
          command: "color",
          deviceId: "viso:google-home:selected",
          color: "#ffff00",
        },
      },
      appearance: expect.objectContaining({
        label: "Pepe",
        color: "#ffff00",
        icon: "viso1:star:10",
      }),
    }),
  );
});

it("removes only the key media while retaining its custom appearance", async () => {
  const onClose = vi.fn();
  render(
    <KeyEditor
      target={{
        ...target,
        appearance: {
          ...target.appearance,
          label: "Mi estado",
          color: "#abcdef",
          icon: "star",
        },
      }}
      statuses={statuses}
      pages={pages}
      advanced
      onClose={onClose}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Quitar fondo de la tecla" }),
  );
  expect(
    screen.queryByLabelText("Vista previa de la tecla"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  const saved = state.mutations["deck_layout:moveKey"].mock.calls[0][0];
  expect(saved.appearance).toMatchObject({
    label: "Mi estado",
    color: "#abcdef",
    icon: "star",
  });
  expect(saved.appearance).not.toHaveProperty("mediaStorageId");
  expect(saved.content).toEqual(target.content);
});

describe("personal media on every key", () => {
  it.each([
    { kind: "clock" } as const,
    {
      kind: "weather",
      label: "Buenos Aires",
      latitude: -34.6,
      longitude: -58.4,
    } as const,
  ])(
    "saves a visual on a $kind button without changing its live-content configuration",
    async (content) => {
      const onClose = vi.fn();
      render(
        <KeyEditor
          target={{ ...target, content, appearance: undefined }}
          statuses={statuses}
          pages={pages}
          onClose={onClose}
        />,
      );
      fireEvent.click(screen.getByRole("tab", { name: "Mis archivos" }));
      fireEvent.change(
        screen.getByLabelText("Imagen, GIF o video de la tecla"),
        {
          target: {
            files: [new File(["content"], "marca.gif", { type: "image/gif" })],
          },
        },
      );
      expect(
        screen.getByRole("switch", { name: "Mostrar nombre" }),
      ).not.toBeChecked();
      expect(
        screen.getByRole("switch", { name: "Mostrar icono" }),
      ).not.toBeChecked();
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      expect(state.mutations["deck_layout:setKey"]).toHaveBeenCalledWith({
        pageId: "page-one",
        position: 0,
        content,
        appearance: {
          icon: "viso1:globe:00",
          mediaStorageId: "new-owned-media",
          mediaType: "image",
        },
      });
    },
  );

  it.each([
    ["image/png", "marca.png", "image", "img"],
    ["image/gif", "marca.gif", "image", "img"],
    ["video/mp4", "marca.mp4", "video", "video"],
  ] as const)(
    "previews and saves %s in the normal editor without changing the status or Display",
    async (mime, filename, mediaType, element) => {
      const onClose = vi.fn();
      const { container } = render(
        <KeyEditor
          target={{ ...target, appearance: undefined }}
          statuses={[
            {
              ...statuses[0],
              mediaUrl: "https://example.com/display-background.mp4",
              mediaType: "video",
            },
          ]}
          pages={pages}
          onClose={onClose}
        />,
      );
      state.upload.mockResolvedValueOnce({
        storageId: "new-owned-media",
        mediaType,
      });
      fireEvent.click(screen.getByRole("tab", { name: "Mis archivos" }));
      const file = new File(["content"], filename, { type: mime });
      fireEvent.change(
        screen.getByLabelText("Imagen, GIF o video de la tecla"),
        {
          target: { files: [file] },
        },
      );
      const preview = screen.getByLabelText("Vista previa de la tecla");
      expect(preview.querySelector(element)).toHaveAttribute(
        "src",
        "blob:local-key-preview",
      );
      expect(container.querySelector('[src*="display-background"]')).toBeNull();
      expect(state.upload).not.toHaveBeenCalled();
      if (mediaType === "video") {
        const video = preview.querySelector("video")!;
        expect(video.muted).toBe(true);
        expect(video).toHaveAttribute("loop");
        expect(video).toHaveAttribute("autoplay");
        expect(video).toHaveAttribute("playsinline");
      }
      expect(preview.querySelector("svg")).toBeNull();
      expect(preview.querySelector("span.relative")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      expect(state.upload).toHaveBeenCalledExactlyOnceWith(file, "test-token");
      expect(state.mutations["deck_layout:setKey"]).toHaveBeenCalledWith({
        pageId: "page-one",
        position: 0,
        content: target.content,
        appearance: {
          icon: "viso1:check-circle:00",
          mediaStorageId: "new-owned-media",
          mediaType,
        },
      });
      expect(state.mutations["deck_layout:moveKey"]).not.toHaveBeenCalled();
      expect(state.mutations["statuses:create"]).not.toHaveBeenCalled();
    },
  );

  it("keeps a custom RGB action and color when its visual is replaced", async () => {
    const custom: EditTarget = {
      ...target,
      content: {
        kind: "action",
        label: "Pepe",
        color: "#ffff00",
        icon: "star",
        action: {
          type: "rgb",
          deviceId: "viso:google-home:selected",
          command: "color",
          color: "#ffff00",
        },
      },
      appearance: undefined,
    };
    const onClose = vi.fn();
    render(
      <KeyEditor
        target={custom}
        statuses={statuses}
        pages={pages}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Biblioteca" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Seleccionar logo animado" }),
    );
    expect(state.libraryLoad).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(state.libraryLoad).toHaveBeenCalledExactlyOnceWith("test-token");
    expect(state.upload).not.toHaveBeenCalled();
    expect(state.mutations["deck_layout:setKey"]).toHaveBeenCalledWith({
      pageId: "page-one",
      position: 0,
      content: custom.content,
      appearance: {
        icon: "viso1:star:00",
        mediaStorageId: "copied-owned-media",
        mediaType: "video",
      },
    });
  });

  it("lets the user show the name again over an uploaded visual", async () => {
    const onClose = vi.fn();
    render(
      <KeyEditor
        target={{ ...target, appearance: undefined }}
        statuses={statuses}
        pages={pages}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Mis archivos" }));
    fireEvent.change(screen.getByLabelText("Imagen, GIF o video de la tecla"), {
      target: {
        files: [new File(["content"], "marca.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar nombre" }));
    expect(screen.getByLabelText("Vista previa de la tecla")).toHaveTextContent(
      "Libre",
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(
      state.mutations["deck_layout:setKey"].mock.calls[0][0].appearance,
    ).toMatchObject({
      icon: "viso1:check-circle:10",
      mediaStorageId: "new-owned-media",
    });
  });

  it("reuses an uploaded library copy after a failed key save and allows a retry", async () => {
    const onClose = vi.fn();
    render(
      <KeyEditor
        target={{ ...target, appearance: undefined }}
        statuses={statuses}
        pages={pages}
        onClose={onClose}
      />,
    );
    state.mutations["deck_layout:setKey"].mockRejectedValueOnce(
      new Error("offline"),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Biblioteca" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Seleccionar logo animado" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(state.error).toHaveBeenCalledOnce());
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(state.libraryLoad).toHaveBeenCalledOnce();
    expect(state.mutations["deck_layout:setKey"]).toHaveBeenCalledTimes(2);
  });

  it("restores the VISO visual in normal editing without changing the key's command", async () => {
    const onClose = vi.fn();
    render(
      <KeyEditor
        target={target}
        statuses={statuses}
        pages={pages}
        onClose={onClose}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Restablecer aspecto original" }),
    );
    expect(
      screen.queryByLabelText("Vista previa de la tecla"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(state.mutations["deck_layout:setKey"]).toHaveBeenCalledWith({
      pageId: "page-one",
      position: 0,
      content: target.content,
      appearance: null,
    });
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("removing a visual restores visible controls instead of leaving a blank key", async () => {
    const onClose = vi.fn();
    render(
      <KeyEditor
        target={{
          ...target,
          appearance: { ...target.appearance, icon: "viso1:check-circle:00" },
        }}
        statuses={statuses}
        pages={pages}
        onClose={onClose}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar fondo de la tecla" }),
    );
    expect(
      screen.getByRole("switch", { name: "Mostrar nombre" }),
    ).toBeChecked();
    expect(screen.getByRole("switch", { name: "Mostrar icono" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(state.mutations["deck_layout:setKey"]).toHaveBeenCalledWith({
      pageId: "page-one",
      position: 0,
      content: target.content,
      appearance: { icon: "check-circle" },
    });
  });

  it("rejects an unsupported upload without losing the existing visual", () => {
    render(
      <KeyEditor
        target={target}
        statuses={statuses}
        pages={pages}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Imagen, GIF o video de la tecla"), {
      target: {
        files: [new File(["svg"], "unsafe.svg", { type: "image/svg+xml" })],
      },
    });
    expect(state.error).toHaveBeenCalledWith(
      expect.stringContaining("compatible"),
    );
    expect(
      screen.getByLabelText("Vista previa de la tecla").querySelector("img"),
    ).toHaveAttribute("src", "https://example.com/key.gif");
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("makes the media source tabs operable with the keyboard", () => {
    render(
      <KeyEditor
        target={{ ...target, appearance: undefined }}
        statuses={statuses}
        pages={pages}
        onClose={vi.fn()}
      />,
    );
    const icons = screen.getByRole("tab", { name: "Iconos VISO" });
    fireEvent.keyDown(icons, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Mis archivos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByLabelText("Imagen, GIF o video de la tecla"),
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Mis archivos" }), {
      key: "Home",
    });
    expect(icons).toHaveAttribute("aria-selected", "true");
  });
});
