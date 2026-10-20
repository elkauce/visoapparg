import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleSignInButton } from "./google-sign-in";

const fixture = vi.hoisted(() => ({
  native: false,
  signIn: vi.fn(),
  query: vi.fn(),
  mutation: vi.fn(),
  nativeReady: true,
  nativePending: false,
  nativeStart: vi.fn(),
  nativeCancel: vi.fn(),
}));
const client = { query: fixture.query, mutation: fixture.mutation };
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: fixture.signIn }),
}));
vi.mock("convex/react", () => ({ useConvex: () => client }));
vi.mock("@/lib/android-native", () => ({
  isAndroidNative: () => fixture.native,
}));
vi.mock("@/lib/native-google-auth-context", () => ({
  useNativeGoogleAuth: () => ({
    ready: fixture.nativeReady,
    pending: fixture.nativePending,
    start: fixture.nativeStart,
    cancel: fixture.nativeCancel,
  }),
}));

beforeEach(() => {
  sessionStorage.clear();
  vi.unstubAllEnvs();
  fixture.native = false;
  fixture.nativeReady = true;
  fixture.nativePending = false;
  fixture.nativeStart.mockReset().mockResolvedValue(undefined);
  fixture.nativeCancel.mockReset().mockResolvedValue(undefined);
  fixture.signIn
    .mockReset()
    .mockResolvedValue({ redirect: new URL("https://accounts.google.com/") });
  fixture.query
    .mockReset()
    .mockResolvedValue({ google: true, nativeGoogle: true });
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

  it("starts Android Google through the native flow without a WebView redirect", async () => {
    fixture.native = true;
    render(<GoogleSignInButton withEmailSeparator />);
    await userEvent
      .setup()
      .click(
        await screen.findByRole("button", { name: "Continuar con Google" }),
      );
    expect(fixture.nativeStart).toHaveBeenCalledExactlyOnceWith("signin");
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("viso:google-auth-attempt")).toBeNull();
  });

  it("allows cancellation while the native browser flow is pending", async () => {
    fixture.native = true;
    fixture.nativePending = true;
    render(<GoogleSignInButton />);
    expect(
      await screen.findByRole("button", { name: "Abriendo Google…" }),
    ).toBeDisabled();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Cancelar acceso Google" }));
    expect(fixture.nativeCancel).toHaveBeenCalledOnce();
    expect(fixture.signIn).not.toHaveBeenCalled();
  });

  it("keeps password controls locked while native startup is still awaiting the server", async () => {
    fixture.native = true;
    let resolve!: () => void;
    fixture.nativeStart.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const firstPending = vi.fn();
    const { rerender } = render(
      <GoogleSignInButton onPendingChange={firstPending} />,
    );
    await userEvent
      .setup()
      .click(
        await screen.findByRole("button", { name: "Continuar con Google" }),
      );
    expect(firstPending).toHaveBeenLastCalledWith(true);
    const newPending = vi.fn();
    rerender(<GoogleSignInButton onPendingChange={newPending} />);
    expect(newPending).toHaveBeenLastCalledWith(true);
    expect(
      screen.getByRole("button", { name: "Abriendo Google…" }),
    ).toBeDisabled();
    await act(async () => resolve());
    expect(newPending).toHaveBeenLastCalledWith(false);
  });

  it("does not expose native Google before the server supports the return flow", async () => {
    fixture.native = true;
    fixture.query.mockResolvedValue({ google: true });
    render(<GoogleSignInButton />);
    await waitFor(() => expect(fixture.query).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not offer or discover Google in the browser-only Android preview", () => {
    vi.stubEnv("VITE_ANDROID_PREVIEW", "true");
    render(<GoogleSignInButton withEmailSeparator />);
    expect(fixture.query).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("o con tu correo")).toBeNull();
  });
});
