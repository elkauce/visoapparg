import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeckKey, { type KeyFace } from "./deck-key.tsx";

vi.mock("@/components/android-app-icon.tsx", () => ({
  default: ({ packageName }: { packageName: string }) => (
    <span data-testid="app-icon" data-package={packageName} />
  ),
}));

const face: KeyFace = {
  label: "Libre",
  icon: "check-circle",
  color: "#22c55e",
  active: false,
  mediaUrl: "https://example.com/key.gif",
  mediaType: "image",
};

describe("Deck key visual preferences", () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    "renders label=%s icon=%s independently while preserving accessibility and the action",
    (showLabel, showIcon) => {
      const onPress = vi.fn();
      const { container } = render(
        <DeckKey
          face={{ ...face, showLabel, showIcon }}
          editMode={false}
          onPress={onPress}
        />,
      );
      const button = screen.getByRole("button", { name: "Libre" });
      expect(Boolean(screen.queryByText("Libre"))).toBe(showLabel);
      expect(container.querySelectorAll("svg")).toHaveLength(showIcon ? 1 : 0);
      expect(Boolean(container.querySelector('[class~="bg-black/40"]'))).toBe(
        showLabel || showIcon,
      );
      expect(container.querySelector("img")).toHaveClass(
        "size-full",
        "object-cover",
      );
      expect(button).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(button);
      expect(onPress).toHaveBeenCalledTimes(1);
    },
  );

  it("retains the original default labels, icon and selected style", () => {
    const { container } = render(
      <DeckKey
        face={{ ...face, active: true, mediaUrl: null }}
        editMode={false}
        onPress={vi.fn()}
      />,
    );
    expect(screen.getByText("Libre")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Libre" })).toHaveStyle({
      backgroundColor: "#22c55e",
    });
  });

  it("keeps a shared Canvas transparent and does not create another media decoder", () => {
    const { container } = render(
      <DeckKey
        face={{ ...face, mediaUrl: null, showLabel: false, showIcon: false }}
        editMode={false}
        canvas
        onPress={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Libre" }).style.backgroundColor,
    ).toBe("transparent");
    expect(container.querySelector("img,video")).toBeNull();
    expect(container.querySelector('[class~="bg-black/40"]')).toBeNull();
  });

  it("shows a muted looping video at its original aspect ratio without text or icon", () => {
    const { container } = render(
      <DeckKey
        face={{
          ...face,
          mediaType: "video",
          showLabel: false,
          showIcon: false,
        }}
        editMode={false}
        onPress={vi.fn()}
      />,
    );
    const video = container.querySelector("video")!;
    expect(video).toHaveClass("object-cover", "size-full");
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("playsinline");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("uses the Android application's icon only when it has not been replaced", () => {
    const { rerender } = render(
      <DeckKey
        face={{
          ...face,
          icon: "android-app",
          appPackageName: "com.spotify.music",
        }}
        editMode={false}
        onPress={vi.fn()}
      />,
    );
    expect(screen.getByTestId("app-icon")).toHaveAttribute(
      "data-package",
      "com.spotify.music",
    );
    rerender(
      <DeckKey
        face={{ ...face, icon: "music", appPackageName: "com.spotify.music" }}
        editMode={false}
        onPress={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("app-icon")).not.toBeInTheDocument();
  });
});
