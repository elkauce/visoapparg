import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AndroidMediaState } from "@/lib/android-native.ts";
import SpotifyScreen, { type SpotifyScreenProps } from "./spotify-screen.tsx";

const platform = vi.hoisted(() => ({ android: true }));
vi.mock("@/lib/android-native.ts", () => ({
  isAndroidNative: () => platform.android,
}));

const media: AndroidMediaState = {
  permissionGranted: true,
  available: true,
  packageName: "com.spotify.music",
  sourceName: "Spotify",
  title: "La canción real de la sesión",
  artist: "Su artista",
  album: "Su álbum",
  artwork: "data:image/jpeg;base64,YXJ0",
  state: "playing",
  positionMs: 120_000,
  durationMs: 180_000,
  canPlayPause: true,
  canNext: false,
  canPrevious: true,
};
const props = (): SpotifyScreenProps => ({
  media,
  loading: false,
  error: null,
  pending: false,
  onCommand: vi.fn(),
  onRequestAccess: vi.fn(),
  onRefresh: vi.fn(),
});

describe("Spotify screen", () => {
  beforeEach(() => {
    platform.android = true;
  });

  it("shows the supplied session metadata and enables only supported transport controls", () => {
    const value = props();
    render(<SpotifyScreen {...value} />);
    expect(screen.getByText(media.title!)).toBeInTheDocument();
    expect(screen.getByText(media.artist!)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Carátula/ })).toHaveAttribute(
      "src",
      media.artwork,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "120000",
    );
    expect(screen.getByText("2:00")).toBeInTheDocument();
    expect(screen.getByText("3:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    expect(value.onCommand).toHaveBeenNthCalledWith(1, "previous");
    expect(value.onCommand).toHaveBeenNthCalledWith(2, "play-pause");
  });

  it("requires actual permission instead of presenting a connected player", () => {
    const value = {
      ...props(),
      media: { ...media, available: false, permissionGranted: false },
    };
    render(<SpotifyScreen {...value} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Autorizar reproducción" }),
    );
    expect(value.onRequestAccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(media.title!)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pausar" }),
    ).not.toBeInTheDocument();
  });

  it("does not show or control another application's session", () => {
    render(
      <SpotifyScreen
        {...props()}
        media={{ ...media, packageName: "com.example.player" }}
      />,
    );
    expect(
      screen.getByText(/No hay una sesión de Spotify/),
    ).toBeInTheDocument();
    expect(screen.queryByText(media.title!)).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not imitate native playback in web", () => {
    platform.android = false;
    render(<SpotifyScreen {...props()} />);
    expect(
      screen.getByText(/disponibles en la app VISO Deck para Android/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(media.title!)).not.toBeInTheDocument();
  });
});
