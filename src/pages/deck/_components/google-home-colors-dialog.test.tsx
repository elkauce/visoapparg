import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoogleHomeColorsDialog from "./google-home-colors-dialog.tsx";
import { readGoogleHomeColors } from "../_lib/google-home-colors.ts";
import type { GoogleHomeConfiguration, GoogleHomeLight, GoogleHomeStatus } from "@/lib/google-home-native.ts";

const native = vi.hoisted(() => ({
  getStatus: vi.fn(), getConfiguration: vi.fn(), discoverLights: vi.fn(),
  authorize: vi.fn(), saveConfiguration: vi.fn(), disconnect: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/lib/google-home-native.ts", () => ({ googleHomeNative: native, notifyGoogleHomeConfigurationChanged: native.notify }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const authorized: GoogleHomeStatus = {
  sdkPresent: true, available: true, status: "connected", authorized: true,
  configured: false, selectedCount: 0, message: "Google confirmó los permisos de estos dispositivos.",
};
const disconnected: GoogleHomeStatus = { ...authorized, status: "disconnected", authorized: false, message: "Autoriza Google para acceder a las luces." };
const lights: GoogleHomeLight[] = [
  { id: "desk-light", name: "Escritorio", online: true, colorCapable: true, structureId: "my-home" },
  { id: "living-room", name: "Living", online: true, colorCapable: true, structureId: "my-home" },
];
function configuration(selectedIds: string[] = []): GoogleHomeConfiguration {
  return { selectedIds, colorsByState: readGoogleHomeColors("owner-A"), enabled: selectedIds.length > 0, revision: "configuration-1" };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  native.getStatus.mockResolvedValue(authorized);
  native.getConfiguration.mockResolvedValue(configuration());
  native.discoverLights.mockResolvedValue({ ...authorized, lights });
  native.authorize.mockResolvedValue(authorized);
  native.saveConfiguration.mockImplementation(async (options: { selectedIds: string[]; colorsByState: GoogleHomeConfiguration["colorsByState"] }) => ({ ...configuration(options.selectedIds), colorsByState: options.colorsByState }));
  native.disconnect.mockResolvedValue(undefined);
});

describe("Google Home selection inside the states dialog", () => {
  it("lists only SDK color-capable lights and preselects none", async () => {
    native.discoverLights.mockResolvedValue({ ...authorized, lights: [...lights, { id: "white-only", name: "Solo blanco", online: true, colorCapable: false }] });
    render(<GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />);
    const desk = await screen.findByRole("checkbox", { name: "Utilizar Escritorio" });
    expect(desk).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Utilizar Living" })).not.toBeChecked();
    expect(screen.queryByText("Solo blanco")).not.toBeInTheDocument();
    expect(native.authorize).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText(/^Color Google Home /)).toHaveLength(6);
  });

  it("saves only the explicitly chosen device and the six editable colors", async () => {
    const close = vi.fn();
    render(<GoogleHomeColorsDialog userId="owner-A" open onOpenChange={close} />);
    await userEvent.click(await screen.findByRole("checkbox", { name: "Utilizar Escritorio" }));
    fireEvent.change(screen.getByLabelText("Color Google Home LIBRE"), { target: { value: "#12ab34" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar selección y colores" }));
    await waitFor(() => expect(native.saveConfiguration).toHaveBeenCalledWith({ accountId: "owner-A", selectedIds: ["desk-light"], colorsByState: { ...configuration().colorsByState, libre: "#12ab34" } }));
    expect(native.notify).toHaveBeenCalledWith("owner-A");
    expect(close).toHaveBeenCalledWith(false);
  });

  it("can save colors with no selected devices while official consent is pending", async () => {
    native.getStatus.mockResolvedValue(disconnected);
    render(<GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />);
    await screen.findByText(disconnected.message);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guardar colores" }));
    expect(native.saveConfiguration).toHaveBeenCalledWith(expect.objectContaining({ accountId: "owner-A", selectedIds: [] }));
    expect(native.authorize).not.toHaveBeenCalled();
    expect(native.discoverLights).not.toHaveBeenCalled();
  });

  it("uses the official consent action before discovering lights", async () => {
    native.getStatus.mockResolvedValue(disconnected);
    render(<GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Autorizar Google Home" }));
    await screen.findByRole("checkbox", { name: "Utilizar Escritorio" });
    expect(native.authorize).toHaveBeenCalledWith({ accountId: "owner-A" });
    expect(native.discoverLights).toHaveBeenCalledWith({ accountId: "owner-A" });
    expect(native.saveConfiguration).not.toHaveBeenCalled();
  });

  it("shows SDK unavailable without inventing devices or enabling consent", async () => {
    native.getStatus.mockResolvedValue({ ...disconnected, sdkPresent: false, available: false, status: "pending", message: "SDK pendiente en esta APK." });
    render(<GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />);
    await screen.findByText("SDK pendiente en esta APK.");
    expect(screen.getByRole("button", { name: "Autorizar Google Home — pendiente" })).toBeDisabled();
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
    expect(screen.getByRole("button", { name: "Autorizar Google Home — pendiente" })).toBeDisabled();
    permission.resolve(disconnected);
    await screen.findByText(disconnected.message);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(native.discoverLights).toHaveBeenCalledTimes(1);
  });

  it("does not keep old devices visible when a new discovery fails", async () => {
    render(<GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />);
    await screen.findByRole("checkbox", { name: "Utilizar Escritorio" });
    native.discoverLights.mockRejectedValueOnce(new Error("Google retiró acceso a los dispositivos."));
    native.getStatus.mockResolvedValue(disconnected);
    await userEvent.click(screen.getByRole("button", { name: "Actualizar luces" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText(disconnected.message)).toBeInTheDocument();
  });

  it("pauses VISO locally without claiming to revoke the Google account", async () => {
    native.getConfiguration.mockResolvedValue(configuration(["desk-light"]));
    render(<GoogleHomeColorsDialog userId="owner-A" open onOpenChange={vi.fn()} />);
    await screen.findByRole("checkbox", { name: "Utilizar Escritorio" });
    native.getStatus.mockResolvedValue(disconnected);
    native.getConfiguration.mockResolvedValue(configuration());
    await userEvent.click(screen.getByRole("button", { name: "Dejar de usar estas luces en VISO" }));
    await waitFor(() => expect(native.disconnect).toHaveBeenCalledWith({ accountId: "owner-A" }));
    expect(native.notify).toHaveBeenCalledWith("owner-A");
    await screen.findByText(disconnected.message);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
