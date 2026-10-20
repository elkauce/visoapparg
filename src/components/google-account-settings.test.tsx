import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoogleAccountSettings from "./google-account-settings";

const fixture = vi.hoisted(() => ({
  pending: false,
  linked: false,
  query: vi.fn(),
  mutation: vi.fn(),
  signIn: vi.fn(),
  start: vi.fn(),
  cancel: vi.fn(),
}));
const client = { query: fixture.query, mutation: fixture.mutation };

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: fixture.signIn }),
}));
vi.mock("convex/react", () => ({ useConvex: () => client }));
vi.mock("@/lib/android-native", () => ({ isAndroidNative: () => true }));
vi.mock("@/lib/native-google-auth-context", () => ({
  useNativeGoogleAuth: () => ({
    ready: true,
    pending: fixture.pending,
    start: fixture.start,
    cancel: fixture.cancel,
  }),
}));

beforeEach(() => {
  vi.unstubAllEnvs();
  fixture.pending = false;
  fixture.linked = false;
  fixture.query.mockReset().mockImplementation((reference) =>
    Promise.resolve(
      getFunctionName(reference) === "social_auth:connection"
        ? {
            linked: fixture.linked,
            ...(fixture.linked ? { email: "linked@example.test" } : {}),
          }
        : { google: true, nativeGoogle: true },
    ),
  );
  fixture.mutation.mockReset();
  fixture.signIn.mockReset();
  fixture.start.mockReset().mockResolvedValue(undefined);
  fixture.cancel.mockReset().mockResolvedValue(undefined);
});

describe("Google account settings on Android", () => {
  it("shows the existing Google identity without offering another link", async () => {
    fixture.linked = true;
    const pending = vi.fn();
    render(<GoogleAccountSettings onPendingChange={pending} />);

    expect(await screen.findByText("Google vinculado")).toBeVisible();
    expect(screen.getByText("linked@example.test")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Vincular Google" })).toBeNull();
    expect(pending).toHaveBeenLastCalledWith(false);
    expect(fixture.signIn).not.toHaveBeenCalled();
  });

  it("links through the native account flow when Google is not linked", async () => {
    render(<GoogleAccountSettings onPendingChange={vi.fn()} />);

    await userEvent.setup().click(
      await screen.findByRole("button", { name: "Vincular Google" }),
    );

    expect(fixture.start).toHaveBeenCalledExactlyOnceWith("link");
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(fixture.mutation).not.toHaveBeenCalled();
  });

  it("refreshes after the native callback and releases pending after the link button unmounts", async () => {
    fixture.pending = true;
    const pending = vi.fn();
    const { rerender } = render(
      <GoogleAccountSettings onPendingChange={pending} />,
    );
    expect(
      await screen.findByRole("button", { name: "Abriendo Google…" }),
    ).toBeDisabled();
    expect(pending).toHaveBeenLastCalledWith(true);

    // The provider announces the linked account before its durable cleanup
    // finishes. The successful refresh removes GoogleSignInButton immediately.
    fixture.linked = true;
    await act(async () => {
      window.dispatchEvent(new Event("viso:google-account-changed"));
    });
    expect(await screen.findByText("Google vinculado")).toBeVisible();
    expect(screen.getByText("linked@example.test")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
    expect(pending).toHaveBeenLastCalledWith(true);

    fixture.pending = false;
    rerender(<GoogleAccountSettings onPendingChange={pending} />);
    await waitFor(() => expect(pending).toHaveBeenLastCalledWith(false));
    expect(screen.getByText("Google vinculado")).toBeVisible();
    expect(fixture.signIn).not.toHaveBeenCalled();
  });
});
