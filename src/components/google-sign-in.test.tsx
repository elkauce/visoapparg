import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleSignInButton } from "./google-sign-in";

const fixture = vi.hoisted(() => ({
  native: false,
  signIn: vi.fn(),
  query: vi.fn(),
  mutation: vi.fn(),
}));
const client = { query: fixture.query, mutation: fixture.mutation };
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: fixture.signIn }),
}));
vi.mock("convex/react", () => ({ useConvex: () => client }));
vi.mock("@/lib/android-native", () => ({
  isAndroidNative: () => fixture.native,
}));

beforeEach(() => {
  sessionStorage.clear();
  vi.unstubAllEnvs();
  fixture.native = false;
  fixture.signIn
    .mockReset()
    .mockResolvedValue({ redirect: new URL("https://accounts.google.com/") });
  fixture.query.mockReset().mockResolvedValue({ google: true });
  fixture.mutation.mockReset().mockResolvedValue(null);
});

describe("GoogleSignInButton", () => {
  it("arms authenticated linking before redirecting and stores only an attempt marker", async () => {
    let resolve!: () => void;
    fixture.mutation.mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const pending = vi.fn();
    const user = userEvent.setup();
    render(<GoogleSignInButton mode="link" onPendingChange={pending} />);
    await user.dblClick(
      await screen.findByRole("button", { name: "Vincular Google" }),
    );
    expect(fixture.mutation).toHaveBeenCalledOnce();
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Abriendo Google…" }),
    ).toBeDisabled();
    await act(async () => resolve());
    await waitFor(() =>
      expect(fixture.signIn).toHaveBeenCalledExactlyOnceWith("google", {
        redirectTo: "/?google=return",
      }),
    );
    const marker = JSON.parse(
      sessionStorage.getItem("viso:google-auth-attempt")!,
    );
    expect(marker).toEqual({ mode: "link", startedAt: expect.any(Number) });
    expect(pending).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("keeps the account available to retry when linking preparation is rejected", async () => {
    fixture.mutation.mockRejectedValueOnce(
      new Error("Private server diagnostic"),
    );
    const pending = vi.fn();
    const user = userEvent.setup();
    render(<GoogleSignInButton mode="link" onPendingChange={pending} />);
    await user.click(
      await screen.findByRole("button", { name: "Vincular Google" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos abrir Google para vincular tu cuenta",
    );
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(pending.mock.calls).toEqual([[true], [false]]);
    expect(
      screen.getByRole("button", { name: "Vincular Google" }),
    ).toBeEnabled();
    expect(sessionStorage.getItem("viso:google-auth-attempt")).toBeNull();
  });

  it.each(["native", "preview"])(
    "does not offer or discover web Google on %s Android",
    (kind) => {
      if (kind === "native") fixture.native = true;
      else vi.stubEnv("VITE_ANDROID_PREVIEW", "true");
      render(<GoogleSignInButton withEmailSeparator />);
      expect(fixture.query).not.toHaveBeenCalled();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByText("o con tu correo")).toBeNull();
    },
  );
});
