import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoogleHomeColorsDialog from "./google-home-colors-dialog.tsx";
import { readGoogleHomeColors } from "../_lib/google-home-colors.ts";
import type {
  GoogleHomeConfiguration,
  GoogleHomeLight,
  GoogleHomeStatus,
} from "@/lib/google-home-native.ts";

const native = vi.hoisted(() => ({
  getStatus: vi.fn(),
  getConfiguration: vi.fn(),
  discoverLights: vi.fn(),
  authorize: vi.fn(),
  saveConfiguration: vi.fn(),
  disconnect: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/lib/google-home-native.ts", () => ({
  googleHomeNative: native,
  notifyGoogleHomeConfigurationChanged: native.notify,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const authorized: GoogleHomeStatus = {
  sdkPresent: true,
  available: true,
  status: "connected",
  authorized: true,
  configured: false,
  selectedCount: 0,
  message: "Google confirmó los permisos de estos dispositivos.",
};
const disconnected: GoogleHomeStatus = {
  ...authorized,
  status: "disconnected",
  authorized: false,
  message: "Autoriza Google para acceder a las luces.",
};
const lights: GoogleHomeLight[] = [
  {
    id: "desk-light",
    name: "Escritorio",
    online: true,
    colorCapable: true,
    structureId: "my-home",
  },
  {
    id: "living-room",
    name: "Living",
    online: true,
    colorCapable: true,
    structureId: "my-home",
  },
];
function configuration(selectedIds: string[] = []): GoogleHomeConfiguration {
  return {
    selectedIds,
    colorsByState: readGoogleHomeColors("owner-A"),
    enabled: selectedIds.length > 0,
    revision: "configuration-1",
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  native.getStatus.mockResolvedValue(authorized);
  native.getConfiguration.mockResolvedValue(configuration());
  native.discoverLights.mockResolvedValue({ ...authorized, lights });
  native.authorize.mockResolvedValue(authorized);
  native.saveConfiguration.mockImplementation(
    async (options: {
      selectedIds: string[];
      colorsByState: GoogleHomeConfiguration["colorsByState"];
    }) => ({
      ...configuration(options.selectedIds),
      colorsByState: options.colorsByState,
    }),
  );
  native.disconnect.mockResolvedValue(undefined);
});

describe("Google Home selection inside the states dialog", () => {
  it("lists only SDK color-capable lights and preselects none", async () => {
    native.discoverLights.mockResolvedValue({
      ...authorized,
      lights: [
        ...lights,
        {
          id: "white-only",
          name: "Solo blanco",
          online: true,
          colorCapable: false,
        },
      ],
    });
    render(
      <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
    );
    const desk = await screen.findByRole("checkbox", {
      name: "Utilizar Escritorio",
    });
    expect(desk).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Utilizar Living" }),
    ).not.toBeChecked();
    expect(screen.queryByText("Solo blanco")).not.toBeInTheDocument();
    expect(native.authorize).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText(/^Color Google Home /)).toHaveLength(6);
  });

  it("saves only the explicitly chosen device and the six editable colors", async () => {
    const close = vi.fn();
    render(
      <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={close} />,
    );
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Utilizar Escritorio" }),
    );
    fireEvent.change(screen.getByLabelText("Color Google Home LIBRE"), {
      target: { value: "#12ab34" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar selección y colores" }),
    );
    await waitFor(() =>
      expect(native.saveConfiguration).toHaveBeenCalledWith({
        accountId: "owner-A",
        selectedIds: ["desk-light"],
        colorsByState: { ...configuration().colorsByState, libre: "#12ab34" },
      }),
    );
    expect(native.notify).toHaveBeenCalledWith("owner-A");
    expect(close).toHaveBeenCalledWith(false);
  });

  it("can save colors with no selected devices while official consent is pending", async () => {
    native.getStatus.mockResolvedValue(disconnected);
    render(
      <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
    );
    await screen.findByText(disconnected.message);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar colores" }),
    );
    expect(native.saveConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "owner-A", selectedIds: [] }),
    );
    expect(native.authorize).not.toHaveBeenCalled();
    expect(native.discoverLights).not.toHaveBeenCalled();
  });

  it("uses the official consent action before discovering lights", async () => {
    native.getStatus.mockResolvedValue(disconnected);
    render(
      <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Autorizar Google Home" }),
    );
    await screen.findByRole("checkbox", { name: "Utilizar Escritorio" });
    expect(native.authorize).toHaveBeenCalledWith({ accountId: "owner-A" });
    expect(native.discoverLights).toHaveBeenCalledWith({
      accountId: "owner-A",
    });
    expect(native.saveConfiguration).not.toHaveBeenCalled();
  });

  it("shows SDK unavailable without inventing devices or enabling consent", async () => {
    native.getStatus.mockResolvedValue({
      ...disconnected,
      sdkPresent: false,
      available: false,
      status: "pending",
      message: "SDK pendiente en esta APK.",
    });
    render(
      <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
    );
    await screen.findByText("SDK pendiente en esta APK.");
    expect(
      screen.getByRole("button", { name: "Autorizar Google Home — pendiente" }),
    ).toBeDisabled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(native.discoverLights).not.toHaveBeenCalled();
  });

  it("invalidates the prior opening while rechecking revoked permissions", async () => {
    const props = { userId: "owner-A", onOpenChange: vi.fn() };
    const view = render(<GoogleHomeColorsDialog {...props} open />);
    await screen.findByRole("checkbox", { name: "Utilizar Escritorio" });
    view.rerender(<GoogleHomeColorsDialog {...props} open={false} />);
    const permission = deferred<GoogleHomeStatus>();
    native.getStatus.mockReturnValueOnce(permission.promise);
    view.rerender(<GoogleHomeColorsDialog {...props} open />);
    await screen.findByText("Consultando Google Home…");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Autorizar Google Home — pendiente" }),
    ).toBeDisabled();
    permission.resolve(disconnected);
    await screen.findByText(disconnected.message);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(native.discoverLights).toHaveBeenCalledTimes(1);
  });

  it("does not keep old devices visible when a new discovery fails", async () => {
    render(
      <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
    );
    await screen.findByRole("checkbox", { name: "Utilizar Escritorio" });
    native.discoverLights.mockRejectedValueOnce(
      new Error("Google retiró acceso a los dispositivos."),
    );
    native.getStatus.mockResolvedValue(disconnected);
    await userEvent.click(
      screen.getByRole("button", { name: "Actualizar luces" }),
    );
    await screen.findByRole("alert");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText(disconnected.message)).toBeInTheDocument();
  });

  it("pauses VISO locally without claiming to revoke the Google account", async () => {
    native.getConfiguration.mockResolvedValue(configuration(["desk-light"]));
    render(
      <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
    );
    await screen.findByRole("checkbox", { name: "Utilizar Escritorio" });
    native.getStatus.mockResolvedValue(disconnected);
    native.getConfiguration.mockResolvedValue(configuration());
    await userEvent.click(
      screen.getByRole("button", { name: "Dejar de usar estas luces en VISO" }),
    );
    await waitFor(() =>
      expect(native.disconnect).toHaveBeenCalledWith({ accountId: "owner-A" }),
    );
    expect(native.notify).toHaveBeenCalledWith("owner-A");
    await screen.findByText(disconnected.message);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

it("recovers from a failed initial permission query without requiring reopening or faking authorization", async () => {
  native.getStatus.mockRejectedValueOnce(
    new Error("Consultar permisos. Código Google: 10."),
  );
  render(
    <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
  );
  await screen.findByText("Consultar permisos. Código Google: 10.");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(native.authorize).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Comprobar de nuevo" }),
  );
  await screen.findByRole("checkbox", { name: "Utilizar Escritorio" });
  expect(native.authorize).not.toHaveBeenCalled();
});

it("allows retry after consent discovery and its fallback query both fail", async () => {
  native.getStatus
    .mockResolvedValueOnce(disconnected)
    .mockRejectedValueOnce(new Error("Session resuming"));
  native.discoverLights.mockRejectedValueOnce(
    new Error("Discovery returned too early"),
  );
  render(
    <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Autorizar Google Home" }),
  );
  await screen.findByText("Discovery returned too early");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Comprobar de nuevo" }),
  );
  await screen.findByRole("checkbox", { name: "Utilizar Escritorio" });
  expect(native.authorize).toHaveBeenCalledTimes(1);
  expect(native.saveConfiguration).not.toHaveBeenCalled();
});

it("preserves saved lights absent from a partial discovery when saving colors", async () => {
  native.getConfiguration.mockResolvedValue(
    configuration(["desk-light", "living-room"]),
  );
  native.discoverLights.mockResolvedValue({
    ...authorized,
    lights: [lights[0]],
  });
  render(
    <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
  );
  expect(
    await screen.findByRole("checkbox", { name: "Conservar luz guardada 1" }),
  ).toBeChecked();
  fireEvent.change(screen.getByLabelText("Color Google Home LIBRE"), {
    target: { value: "#abcdef" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar selección y colores" }),
  );
  expect(native.saveConfiguration).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: "owner-A",
      selectedIds: ["desk-light", "living-room"],
      colorsByState: expect.objectContaining({ libre: "#abcdef" }),
    }),
  );
});

it("removes an unavailable saved light only when the owner explicitly deselects it", async () => {
  native.getConfiguration.mockResolvedValue(
    configuration(["desk-light", "living-room"]),
  );
  native.discoverLights.mockResolvedValue({
    ...authorized,
    lights: [lights[0]],
  });
  render(
    <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
  );
  await userEvent.click(
    await screen.findByRole("checkbox", { name: "Conservar luz guardada 1" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar selección y colores" }),
  );
  expect(native.saveConfiguration).toHaveBeenCalledWith(
    expect.objectContaining({
      selectedIds: ["desk-light"],
    }),
  );
});

it("keeps saved selections and colors editable through an unverified permission lookup", async () => {
  native.getConfiguration.mockResolvedValue(configuration(["desk-light"]));
  native.getStatus.mockRejectedValueOnce(
    new Error("Google Home no respondió a tiempo."),
  );
  render(
    <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
  );
  await screen.findByText("Google Home no respondió a tiempo.");
  expect(
    screen.getByText(/tu selección y colores se conservan/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Volvé a autorizar/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Color Google Home LIBRE"), {
    target: { value: "#123abc" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar selección y colores" }),
  );
  expect(native.saveConfiguration).toHaveBeenCalledWith(
    expect.objectContaining({
      selectedIds: ["desk-light"],
      colorsByState: expect.objectContaining({ libre: "#123abc" }),
    }),
  );
  expect(native.authorize).not.toHaveBeenCalled();
  expect(native.discoverLights).not.toHaveBeenCalled();
});

it("does not overwrite an unread saved configuration with defaults", async () => {
  native.getConfiguration.mockRejectedValueOnce(
    new Error("No se pudo leer la configuración guardada."),
  );
  render(
    <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
  );
  await screen.findByText("No se pudo leer la configuración guardada.");
  expect(
    screen.getByRole("button", { name: "Guardar colores" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Color Google Home LIBRE")).toBeDisabled();
  expect(native.saveConfiguration).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Comprobar de nuevo" }),
  );
  await screen.findByRole("checkbox", { name: "Utilizar Escritorio" });
  expect(screen.getByRole("button", { name: "Guardar colores" })).toBeEnabled();
});

it("isolates drafts and delayed discovery results when the signed-in owner changes", async () => {
  const oldDiscovery = deferred<
    GoogleHomeStatus & { lights: GoogleHomeLight[] }
  >();
  native.getConfiguration.mockResolvedValueOnce({
    ...configuration(["desk-light"]),
    colorsByState: { ...configuration().colorsByState, libre: "#abcdef" },
  });
  native.discoverLights.mockReturnValueOnce(oldDiscovery.promise);
  const view = render(
    <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
  );
  await waitFor(() =>
    expect(native.discoverLights).toHaveBeenCalledWith({
      accountId: "owner-A",
    }),
  );
  native.getConfiguration.mockResolvedValue(configuration(["living-room"]));
  native.discoverLights.mockResolvedValue({
    ...authorized,
    lights: [lights[1]],
  });
  view.rerender(
    <GoogleHomeColorsDialog userId="owner-B" open onOpenChange={vi.fn()} />,
  );
  expect(
    await screen.findByRole("checkbox", { name: "Utilizar Living" }),
  ).toBeChecked();
  oldDiscovery.resolve({ ...authorized, lights: [lights[0]] });
  await waitFor(() =>
    expect(
      screen.queryByRole("checkbox", { name: "Utilizar Escritorio" }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByLabelText("Color Google Home LIBRE")).not.toHaveValue(
    "#abcdef",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar selección y colores" }),
  );
  expect(native.saveConfiguration).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: "owner-B",
      selectedIds: ["living-room"],
    }),
  );
});

it("rechecks on reconnection without duplicate reads or losing unsaved edits", async () => {
  native.getConfiguration.mockResolvedValue(configuration(["desk-light"]));
  render(
    <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
  );
  await userEvent.click(
    await screen.findByRole("checkbox", { name: "Utilizar Living" }),
  );
  fireEvent.change(screen.getByLabelText("Color Google Home LIBRE"), {
    target: { value: "#abc123" },
  });
  const pending = deferred<GoogleHomeStatus>();
  native.getStatus.mockReturnValueOnce(pending.promise);
  fireEvent(window, new Event("online"));
  fireEvent(window, new Event("online"));
  expect(native.getStatus).toHaveBeenCalledTimes(2);
  pending.resolve(authorized);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Guardar selección y colores" }),
    ).toBeEnabled(),
  );
  expect(
    screen.getByRole("checkbox", { name: "Utilizar Escritorio" }),
  ).toBeChecked();
  expect(
    screen.getByRole("checkbox", { name: "Utilizar Living" }),
  ).toBeChecked();
  expect(screen.getByLabelText("Color Google Home LIBRE")).toHaveValue(
    "#abc123",
  );
  expect(native.authorize).not.toHaveBeenCalled();
});

it("forces the Google consent screen only for an explicit review of existing permissions", async () => {
  render(
    <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
  );
  await screen.findByRole("checkbox", { name: "Utilizar Escritorio" });
  await userEvent.click(
    screen.getByRole("button", { name: "Revisar permisos de Google" }),
  );
  expect(native.authorize).toHaveBeenCalledWith({
    accountId: "owner-A",
    force: true,
  });
});

it("offers rechecking rather than launching consent during a transient SDK verification", async () => {
  native.getConfiguration.mockResolvedValue(configuration(["desk-light"]));
  native.getStatus.mockResolvedValue({
    ...disconnected,
    status: "pending",
    verificationPending: true,
    requiresAuthorization: false,
    permissionState: "unknown",
    message:
      "Google Home no pudo verificar los permisos. Reintentá la conexión.",
  });
  render(
    <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
  );
  await screen.findByText(
    "Google Home no pudo verificar los permisos. Reintentá la conexión.",
  );
  expect(
    screen.getByRole("button", { name: "Autorizar Google Home — pendiente" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Comprobar de nuevo" }),
  ).toBeEnabled();
  expect(screen.queryByText(/Volvé a autorizar/)).not.toBeInTheDocument();
  expect(native.authorize).not.toHaveBeenCalled();
});

it("recovers a transient permission verification automatically without launching Google consent", async () => {
  vi.useFakeTimers();
  try {
    native.getStatus.mockResolvedValueOnce({
      ...disconnected,
      status: "pending",
      verificationPending: true,
      requiresAuthorization: false,
      permissionState: "unknown",
      message: "Google está retomando la conexión.",
    });
    await act(async () => {
      render(
        <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
      );
    });
    expect(
      screen.getByText("Google está retomando la conexión."),
    ).toBeInTheDocument();
    expect(native.getStatus).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(
      screen.getByRole("checkbox", { name: "Utilizar Escritorio" }),
    ).toBeInTheDocument();
    expect(native.getStatus).toHaveBeenCalledTimes(2);
    expect(native.authorize).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it("bounds automatic verification retries and keeps manual recovery available", async () => {
  vi.useFakeTimers();
  try {
    native.getStatus.mockResolvedValue({
      ...disconnected,
      status: "pending",
      verificationPending: true,
      requiresAuthorization: false,
      permissionState: "unknown",
      message: "Google no está disponible temporalmente.",
    });
    await act(async () => {
      render(
        <GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />,
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(native.getStatus).toHaveBeenCalledTimes(3);
    expect(native.authorize).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Comprobar de nuevo" }),
    ).toBeEnabled();
  } finally {
    vi.useRealTimers();
  }
});

it("cancels a scheduled connection retry when the dialog closes", async () => {
  vi.useFakeTimers();
  try {
    native.getStatus.mockResolvedValue({
      ...disconnected,
      status: "pending",
      verificationPending: true,
      requiresAuthorization: false,
      message: "Verificando conexión.",
    });
    const props = { userId: "owner-A", onOpenChange: vi.fn() };
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<GoogleHomeColorsDialog {...props} open />);
    });
    await act(async () => {
      view.rerender(<GoogleHomeColorsDialog {...props} open={false} />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(native.getStatus).toHaveBeenCalledTimes(1);
    expect(native.authorize).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
