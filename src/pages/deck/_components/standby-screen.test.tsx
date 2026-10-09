import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StandbyScreen, { type StandbyScreenProps } from "./standby-screen.tsx";
import {
  DEFAULT_STANDBY_SETTINGS,
  saveStandbySettings,
} from "../_lib/standby-settings.ts";
import { listStandbyPhotos } from "../_lib/standby-photos.ts";

const native = vi.hoisted(() => ({ enabled: false, getBattery: vi.fn() }));
vi.mock("@/lib/android-native.ts", () => ({
  isAndroidNative: () => native.enabled,
  nativeDeck: { getStandbyDeviceState: native.getBattery },
}));
vi.mock("../_lib/standby-photos.ts", () => ({
  listStandbyPhotos: vi.fn(async () => []),
  addStandbyPhotos: vi.fn(async () => undefined),
  removeStandbyPhoto: vi.fn(async () => undefined),
}));

const props: StandbyScreenProps = {
  userId: "account-one",
  media: null,
  mediaLoading: false,
  activeStatus: { name: "LIBRE", color: "#22c55e" },
  connected: true,
  onMediaCommand: vi.fn(),
  mediaBusy: false,
};
const media: NonNullable<StandbyScreenProps["media"]> = {
  permissionGranted: true,
  available: true,
  packageName: "com.spotify.music",
  sourceName: "Spotify",
  title: "Título de la sesión",
  artist: "Artista de la sesión",
  album: null,
  artwork: "data:image/png;base64,YXJ0",
  state: "playing",
  positionMs: 30_000,
  durationMs: 120_000,
  canPlayPause: true,
  canNext: true,
  canPrevious: false,
};

describe("Single Standby screen", () => {
  beforeEach(() => {
    localStorage.clear();
    native.enabled = false;
    native.getBattery.mockResolvedValue({
      batteryPercentage: null,
      charging: null,
    });
    vi.mocked(listStandbyPhotos).mockResolvedValue([]);
  });

  it("changes its style inside the same screen and persists only the current account", async () => {
    const { rerender } = render(<StandbyScreen {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Personalizar" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Estilo" }), {
      target: { value: "duo" },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Diseño del reloj" }),
      { target: { value: "analog" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(screen.getByRole("region", { name: "Standby" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Reloj:/ })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    await waitFor(() =>
      expect(listStandbyPhotos).toHaveBeenCalledWith("account-one"),
    );
    rerender(<StandbyScreen {...props} userId="account-two" />);
    expect(screen.queryByRole("img", { name: /^Reloj:/ })).toBeNull();
    rerender(<StandbyScreen {...props} />);
    expect(screen.getByRole("img", { name: /^Reloj:/ })).toBeInTheDocument();
  });

  it("uses supplied session metadata and only exposes supported playback commands", async () => {
    saveStandbySettings(props.userId, {
      ...DEFAULT_STANDBY_SETTINGS,
      style: "music",
    });
    const onMediaCommand = vi.fn();
    render(
      <StandbyScreen
        {...props}
        media={media}
        onMediaCommand={onMediaCommand}
      />,
    );
    expect(screen.getByText(media.title!)).toBeInTheDocument();
    expect(screen.getByText(media.artist!)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Carátula de la reproducción actual" }),
    ).toHaveAttribute("src", media.artwork);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "25",
    );
    expect(
      screen.getByRole("button", { name: "Canción anterior" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    fireEvent.click(screen.getByRole("button", { name: "Canción siguiente" }));
    expect(onMediaCommand.mock.calls).toEqual([["play-pause"], ["next"]]);
    await waitFor(() => expect(listStandbyPhotos).toHaveBeenCalled());
  });

  it("does not fetch external artwork or invent music or battery data in the browser", async () => {
    saveStandbySettings(props.userId, {
      ...DEFAULT_STANDBY_SETTINGS,
      style: "widgets",
    });
    const { rerender } = render(<StandbyScreen {...props} />);
    expect(
      screen.getByText(/información musical.*APK Android/),
    ).toBeInTheDocument();
    expect(screen.queryByText("100%")).toBeNull();
    expect(
      screen.getByRole("group", { name: /^Calendario de/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("LIBRE")).toBeInTheDocument();
    rerender(
      <StandbyScreen
        {...props}
        media={{ ...media, artwork: "https://example.invalid/art.jpg" }}
      />,
    );
    expect(
      screen.queryByRole("img", { name: "Carátula de la reproducción actual" }),
    ).toBeNull();
    expect(
      screen.getByLabelText("Esta sesión no ofrece carátula"),
    ).toBeInTheDocument();
    expect(native.getBattery).not.toHaveBeenCalled();
    await waitFor(() => expect(listStandbyPhotos).toHaveBeenCalled());
  });

  it("shows the real battery value only when Android exposes it", async () => {
    native.enabled = true;
    native.getBattery.mockResolvedValue({
      batteryPercentage: 47,
      charging: true,
    });
    saveStandbySettings(props.userId, {
      ...DEFAULT_STANDBY_SETTINGS,
      style: "widgets",
    });
    render(<StandbyScreen {...props} />);
    expect(await screen.findByText("47%")).toBeInTheDocument();
    expect(screen.getByText("Cargando")).toBeInTheDocument();
    expect(screen.queryByText("100%")).toBeNull();
  });

  it("releases private photo URLs when the user changes account", async () => {
    const create = vi.fn(() => "blob:private-photo");
    const revoke = vi.fn();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = revoke;
      },
    );
    vi.mocked(listStandbyPhotos).mockResolvedValueOnce([
      {
        id: "photo-one",
        blob: new Blob(["photo"], { type: "image/png" }),
        createdAt: 1,
      },
    ]);
    saveStandbySettings(props.userId, {
      ...DEFAULT_STANDBY_SETTINGS,
      style: "photos",
    });
    const { rerender, unmount } = render(<StandbyScreen {...props} />);
    expect(
      await screen.findByRole("img", {
        name: "Fotografía personal de Standby",
      }),
    ).toHaveAttribute("src", "blob:private-photo");
    rerender(<StandbyScreen {...props} userId="account-two" />);
    expect(revoke).toHaveBeenCalledWith("blob:private-photo");
    expect(
      screen.queryByRole("img", { name: "Fotografía personal de Standby" }),
    ).toBeNull();
    unmount();
    vi.unstubAllGlobals();
  });
});
