import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { DeckAction } from "../_lib/action-runner.ts";
import {
  ActionEditor,
  createSimpleAction,
  getActionValidationMessage,
} from "./action-editor.tsx";

const native = vi.hoisted(() => ({
  enabled: false,
  getInstalledApps: vi.fn(),
  configureAllowedApps: vi.fn(),
}));
vi.mock("@/lib/android-native.ts", () => ({
  isAndroidNative: () => native.enabled,
  nativeDeck: {
    getInstalledApps: native.getInstalledApps,
    configureAllowedApps: native.configureAllowedApps,
  },
}));

const installed = [
  {
    packageName: "com.spotify.music",
    name: "Spotify",
    icon: "data:image/png;base64,YQ==",
    allowed: true,
  },
  {
    packageName: "com.google.android.youtube",
    name: "YouTube",
    icon: null,
    allowed: true,
  },
  { packageName: "com.whatsapp", name: "WhatsApp", icon: null, allowed: false },
];

beforeEach(() => {
  native.enabled = false;
  native.getInstalledApps.mockReset().mockResolvedValue(installed);
  native.configureAllowedApps.mockReset().mockResolvedValue([]);
});

const statuses = [
  { _id: "status-one", name: "Disponible", icon: "check", color: "#00ff00" },
];
const pages = [{ _id: "page-one", name: "Principal" }];

describe("action completeness", () => {
  it("creates owned status and page actions with their exact identifiers", () => {
    expect(createSimpleAction("status", statuses, pages)).toEqual({
      type: "status",
      statusId: "status-one",
    });
    expect(createSimpleAction("page", statuses, pages)).toEqual({
      type: "page",
      pageId: "page-one",
    });
    expect(createSimpleAction("status", [], pages)).toEqual({ type: "off" });
  });

  it.each<DeckAction>([
    { type: "url", url: "" },
    { type: "url", url: "javascript:alert(1)" },
    { type: "android-app", packageName: "" },
    { type: "android-app", packageName: "spotify" },
    { type: "page", pageId: "" as Id<"deckPages"> },
    { type: "status", statusId: "" as Id<"statuses"> },
    { type: "rgb", command: "color", deviceId: "", color: "#abcdef" },
    { type: "rgb", command: "color", deviceId: "light.salon", color: "green" },
    { type: "rgb", command: "brightness", deviceId: "light.salon" },
    {
      type: "rgb",
      command: "brightness",
      deviceId: "light.salon",
      brightness: 101,
    },
    { type: "rgb", command: "power", deviceId: "light.salon" },
    { type: "rgb", command: "scene", deviceId: "light.salon", scene: " " },
    { type: "automation", steps: [] },
    {
      type: "automation",
      steps: Array.from({ length: 17 }, () => ({ type: "off" })),
    },
  ])("rejects an incomplete or unsafe action %j", (action) => {
    expect(getActionValidationMessage(action)).toEqual(expect.any(String));
  });

  it.each<DeckAction>([
    { type: "url", url: "https://example.com/path" },
    { type: "android-app", packageName: "com.spotify.music" },
    {
      type: "rgb",
      command: "color",
      deviceId: "light.salon",
      color: "#abcdef",
    },
    {
      type: "rgb",
      command: "brightness",
      deviceId: "light.salon",
      brightness: 0,
    },
    { type: "rgb", command: "power", deviceId: "light.salon", on: false },
    {
      type: "rgb",
      command: "scene",
      deviceId: "light.salon",
      scene: "scene.noche",
    },
    {
      type: "automation",
      steps: Array.from({ length: 16 }, () => ({ type: "off" })),
    },
  ])("accepts a complete action %j", (action) => {
    expect(getActionValidationMessage(action)).toBeNull();
  });

  it("identifies the incomplete step before an automation can be saved", () => {
    expect(
      getActionValidationMessage({
        type: "automation",
        steps: [{ type: "off" }, { type: "url", url: "" }],
      }),
    ).toMatch(/^Paso 2:/);
  });
});

describe("ActionEditor", () => {
  it("does not silently choose or emit an action on opening", () => {
    const onChange = vi.fn();
    render(
      <ActionEditor
        value={{ type: "automation", steps: [] }}
        onChange={onChange}
        statuses={statuses}
        pages={pages}
      />,
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Añade entre 1 y 16 pasos.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Añadir paso (0/16)" }));
    expect(onChange).toHaveBeenCalledWith({
      type: "automation",
      steps: [{ type: "off" }],
    });
  });

  it("keeps a partially edited URL in the controlled value and reports it incomplete", () => {
    const onChange = vi.fn();
    render(
      <ActionEditor
        value={{ type: "url", url: "" }}
        onChange={onChange}
        statuses={statuses}
        pages={pages}
      />,
    );

    fireEvent.change(screen.getByLabelText("Dirección web"), {
      target: { value: "https://" },
    });
    expect(onChange).toHaveBeenCalledWith({ type: "url", url: "https://" });
    expect(screen.getByRole("status")).toHaveTextContent("dirección");
  });

  it("reorders and removes automation steps without changing their actions", () => {
    const initial: DeckAction = {
      type: "automation",
      steps: [{ type: "url", url: "https://example.com" }, { type: "off" }],
    };
    function Harness() {
      const [value, setValue] = useState(initial);
      return (
        <>
          <ActionEditor
            value={value}
            onChange={setValue}
            statuses={statuses}
            pages={pages}
          />
          <output data-testid="action">{JSON.stringify(value)}</output>
        </>
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Subir paso 2" }));
    expect(JSON.parse(screen.getByTestId("action").textContent!)).toEqual({
      type: "automation",
      steps: [{ type: "off" }, initial.steps[0]],
    });
    fireEvent.click(screen.getByRole("button", { name: "Quitar paso 1" }));
    expect(JSON.parse(screen.getByTestId("action").textContent!)).toEqual({
      type: "automation",
      steps: [initial.steps[0]],
    });
  });

  it("prevents adding more than sixteen automation steps", () => {
    render(
      <ActionEditor
        value={{
          type: "automation",
          steps: Array.from({ length: 16 }, () => ({ type: "off" })),
        }}
        onChange={vi.fn()}
        statuses={statuses}
        pages={pages}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Añadir paso (16/16)" }),
    ).toBeDisabled();
  });

  it("allows clearing brightness without replacing it with zero", () => {
    const onChange = vi.fn();
    render(
      <ActionEditor
        value={{
          type: "rgb",
          command: "brightness",
          deviceId: "light.salon",
          brightness: 50,
        }}
        onChange={onChange}
        statuses={statuses}
        pages={pages}
      />,
    );
    fireEvent.change(screen.getByLabelText("Brillo (%)"), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledWith({
      type: "rgb",
      command: "brightness",
      deviceId: "light.salon",
    });
  });
  it("preserves a saved Android action on the web without pretending to list or open apps", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ActionEditor
        value={{ type: "android-app", packageName: "com.spotify.music" }}
        onChange={onChange}
        statuses={statuses}
        pages={pages}
      />,
    );
    expect(
      screen.getByText(/Elige las aplicaciones desde la APK/),
    ).toHaveTextContent("La aplicación guardada se conserva.");
    expect(screen.queryByLabelText("Paquete Android")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("com.spotify.music");
    expect(native.getInstalledApps).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("shows only allowed apps with names and real icons, then assigns the selected app", async () => {
    native.enabled = true;
    const onChange = vi.fn();
    const onAppSelected = vi.fn();
    const { container } = render(
      <ActionEditor
        value={{ type: "android-app", packageName: "" }}
        onChange={onChange}
        onAppSelected={onAppSelected}
        statuses={statuses}
        pages={pages}
      />,
    );
    const spotify = await screen.findByRole("button", { name: "Spotify" });
    expect(spotify.querySelector("img")).toHaveAttribute(
      "src",
      installed[0].icon,
    );
    expect(
      screen.queryByRole("button", { name: "WhatsApp" }),
    ).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /com\.spotify|com\.google|com\.whatsapp/,
    );
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(spotify);
    expect(onChange).toHaveBeenCalledWith({
      type: "android-app",
      packageName: "com.spotify.music",
    });
    expect(onAppSelected).toHaveBeenCalledWith(installed[0]);
  });
  it("searches by app name and preserves the existing selection", async () => {
    native.enabled = true;
    const onChange = vi.fn();
    render(
      <ActionEditor
        value={{ type: "android-app", packageName: "com.spotify.music" }}
        onChange={onChange}
        statuses={statuses}
        pages={pages}
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Spotify" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Buscar aplicaciones"), {
      target: { value: "yOu" },
    });
    expect(
      screen.queryByRole("button", { name: "Spotify" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "YouTube" })).toBeInTheDocument();
    expect(screen.getByText("Seleccionada: Spotify")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("refreshes the real permission selection without emitting an unrelated action", async () => {
    native.enabled = true;
    native.getInstalledApps
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(installed);
    const onChange = vi.fn();
    render(
      <ActionEditor
        value={{ type: "android-app", packageName: "" }}
        onChange={onChange}
        statuses={statuses}
        pages={pages}
      />,
    );
    await screen.findByText(
      "Elige qué aplicaciones permites abrir desde VISO.",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Administrar aplicaciones permitidas",
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Spotify" }),
    ).toBeInTheDocument();
    expect(native.configureAllowedApps).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("reports an uninstalled or disallowed saved app and retains its action", async () => {
    native.enabled = true;
    const onChange = vi.fn();
    render(
      <ActionEditor
        value={{ type: "android-app", packageName: "com.whatsapp" }}
        onChange={onChange}
        statuses={statuses}
        pages={pages}
      />,
    );
    expect(
      await screen.findByText(
        /La aplicación guardada ya no está instalada o permitida/,
      ),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("reports enumeration errors without exposing technical details", async () => {
    native.enabled = true;
    native.getInstalledApps.mockRejectedValueOnce(
      new Error("package com.private.secret failed"),
    );
    render(
      <ActionEditor
        value={{ type: "android-app", packageName: "com.spotify.music" }}
        onChange={vi.fn()}
        statuses={statuses}
        pages={pages}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText("No se pudieron cargar las aplicaciones."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/com.private/)).not.toBeInTheDocument();
  });
});
