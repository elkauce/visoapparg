import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoogleAuthReturn from "./google-auth-return";
import { beginGoogleAuthAttempt } from "@/lib/google-auth-flow";

const fixture = vi.hoisted(() => ({
  authenticated: false,
  loading: false,
  native: false,
  signIn: vi.fn(),
  query: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: fixture.signIn }),
}));
vi.mock("convex/react", () => ({
  useConvex: () => ({ query: fixture.query }),
  useConvexAuth: () => ({
    isAuthenticated: fixture.authenticated,
    isLoading: fixture.loading,
  }),
}));
vi.mock("@/lib/android-native", () => ({
  isAndroidNative: () => fixture.native,
}));
vi.mock("sonner", () => ({
  toast: { success: fixture.success, error: fixture.error },
}));

function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  );
}

function renderReturn(
  path = "/?google=return&code=one-time-code&keep=yes#section",
) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <GoogleAuthReturn />
        <Location />
      </MemoryRouter>
    </StrictMode>,
  );
}

const LINK_CODE = "a".repeat(64);
function renderLinkReturn() {
  return renderReturn(`/?google=return&code=${LINK_CODE}&keep=yes#section`);
}

beforeEach(() => {
  sessionStorage.clear();
  fixture.authenticated = false;
  fixture.loading = false;
  fixture.native = false;
  fixture.signIn.mockReset().mockResolvedValue({ signingIn: true });
  fixture.query.mockReset().mockResolvedValue({ linked: true });
  fixture.success.mockReset();
  fixture.error.mockReset();
});

describe("GoogleAuthReturn", () => {
  it("redeems an owned sign-in once through the SDK and preserves unrelated URL fields", async () => {
    beginGoogleAuthAttempt("signin");
    renderReturn();
    await waitFor(() =>
      expect(fixture.success).toHaveBeenCalledWith(
        "Entraste a VISO con Google.",
      ),
    );
    expect(fixture.signIn).toHaveBeenCalledExactlyOnceWith(undefined, {
      code: "one-time-code",
    });
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/?keep=yes#section",
    );
    expect(sessionStorage.getItem("viso:google-auth-attempt")).toBeNull();
  });

  it("catches redemption failure without exposing diagnostics or retaining the return code", async () => {
    beginGoogleAuthAttempt("signin");
    fixture.signIn.mockRejectedValueOnce(new Error("Secret diagnostic"));
    renderReturn();
    await waitFor(() => expect(fixture.error).toHaveBeenCalledOnce());
    expect(fixture.error.mock.calls[0][0]).toContain(
      "entrá con tu contraseña y vinculá Google desde Cuenta",
    );
    expect(fixture.error.mock.calls[0][0]).not.toContain("Secret diagnostic");
    expect(fixture.success).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).not.toHaveTextContent("code=");
  });

  it("requires the previous authenticated session for linking and preserves an unlinked account", async () => {
    beginGoogleAuthAttempt("link");
    renderLinkReturn();
    await waitFor(() => expect(fixture.error).toHaveBeenCalledOnce());
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(fixture.query).not.toHaveBeenCalled();
    expect(fixture.success).not.toHaveBeenCalled();
  });

  it("confirms the actual Google connection before reporting linking success", async () => {
    fixture.authenticated = true;
    beginGoogleAuthAttempt("link");
    fixture.query.mockResolvedValueOnce({ linked: false });
    renderLinkReturn();
    await waitFor(() => expect(fixture.error).toHaveBeenCalledOnce());
    expect(fixture.signIn).toHaveBeenCalledExactlyOnceWith(undefined, {
      code: LINK_CODE,
    });
    expect(fixture.success).not.toHaveBeenCalled();
  });

  it("waits for auth hydration and leaves unrelated codes to Convex Auth", () => {
    fixture.loading = true;
    beginGoogleAuthAttempt("link");
    renderLinkReturn();
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent(
      `code=${LINK_CODE}`,
    );
  });

  it("does not consume codes without its local attempt marker", () => {
    renderReturn();
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "code=one-time-code",
    );
    expect(fixture.error).not.toHaveBeenCalled();
  });

  it("rejects a malformed link code before the SDK can affect the existing session", async () => {
    fixture.authenticated = true;
    beginGoogleAuthAttempt("link");
    renderReturn("/?google=return&code=12345678&keep=yes#section");
    await waitFor(() => expect(fixture.error).toHaveBeenCalledOnce());
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(fixture.query).not.toHaveBeenCalled();
    expect(fixture.success).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("viso:google-auth-attempt")).toBeNull();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/?keep=yes#section",
    );
  });

  it("does not redeem expired attempts or cancelled sign-ins", async () => {
    sessionStorage.setItem(
      "viso:google-auth-attempt",
      JSON.stringify({ mode: "signin", startedAt: Date.now() - 11 * 60_000 }),
    );
    renderReturn();
    await waitFor(() => expect(fixture.error).toHaveBeenCalledOnce());
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).not.toHaveTextContent("code=");
  });

  it.each(["signin", "link"] as const)(
    "never reports a cancelled %s as success because an old session exists",
    async (mode) => {
      fixture.authenticated = true;
      beginGoogleAuthAttempt(mode);
      renderReturn("/?google=return&keep=yes#section");
      await waitFor(() => expect(fixture.error).toHaveBeenCalledOnce());
      expect(fixture.signIn).not.toHaveBeenCalled();
      expect(fixture.query).not.toHaveBeenCalled();
      expect(fixture.success).not.toHaveBeenCalled();
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/?keep=yes#section",
      );
    },
  );
});
