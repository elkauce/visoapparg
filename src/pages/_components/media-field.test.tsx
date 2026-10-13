import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { getFunctionName } from "convex/server";
const state = vi.hoisted(() => ({ clear: vi.fn(), error: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "media:clearMedia" ? state.clear : vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: state.error } }));
import MediaField from "./media-field";
beforeEach(() => {
  state.clear.mockReset();
  state.error.mockReset();
});
it("removes the preview immediately after a successful clear even when the parent keeps the old snapshot", async () => {
  state.clear.mockResolvedValue(null);
  render(
    <MediaField
      statusId="busy"
      mediaUrl="https://example.test/bg.png"
      mediaType="image"
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Quitar fondo del estado" }),
  );
  await waitFor(() =>
    expect(screen.queryByAltText("Fondo del estado")).not.toBeInTheDocument(),
  );
  expect(state.clear).toHaveBeenCalledWith({ statusId: "busy" });
  expect(
    screen.getByRole("button", { name: "Subir imagen o video" }),
  ).toBeInTheDocument();
});
it("retains the existing background on a failed server clear", async () => {
  state.clear.mockRejectedValue(new Error("offline"));
  render(
    <MediaField
      statusId="busy"
      mediaUrl="https://example.test/bg.png"
      mediaType="image"
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Quitar fondo del estado" }),
  );
  await waitFor(() => expect(state.error).toHaveBeenCalled());
  expect(screen.getByAltText("Fondo del estado")).toHaveAttribute(
    "src",
    "https://example.test/bg.png",
  );
});
