import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/convex/_generated/api";
import {
  NATIVE_GOOGLE_ATTEMPT_KEY,
  nativeGoogleRedirect,
  nativeGoogleVerifierKey,
  type NativeGoogleAttempt,
} from "@/lib/native-google-auth";
import { NativeGoogleAuthProvider } from "./native-google-auth";
import { useNativeGoogleAuth } from "@/lib/native-google-auth-context";

const fixture = vi.hoisted(() => ({
  native: true,
  authenticated: false,
  loading: false,
  storage: new Map<string, string>(),
  handler: null as null | ((event: { url: string }) => void),
  launch: undefined as undefined | { url: string },
  signIn: vi.fn(),
  action: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
  openUrl: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  addListener: vi.fn(),
  getLaunchUrl: vi.fn(),
  removeListener: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  verifierAtRedemption: null as string | null,
}));
const CONVEX_URL = "https://native-test.convex.cloud";
const SITE_URL = "https://native-test.convex.site";
const VERIFIER = "testverifier0123456789";
const CALLBACK_KEY = "viso:native-google-callback";
const VERIFIER_KEY = nativeGoogleVerifierKey(CONVEX_URL);
const SESSION_KEY = "__convexAuthJWT_existing";
const client = {
  url: CONVEX_URL,
  action: fixture.action,
  mutation: fixture.mutation,
  query: fixture.query,
};

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: fixture.signIn }),
}));
vi.mock("convex/react", () => ({
  useConvex: () => client,
  useConvexAuth: () => ({
    isAuthenticated: fixture.authenticated,
    isLoading: fixture.loading,
  }),
}));
vi.mock("@/lib/android-native", () => ({
  isAndroidNative: () => fixture.native,
  actions: { openUrl: fixture.openUrl },
  secureTokenStorage: {
    getItem: fixture.getItem,
    setItem: fixture.setItem,
    removeItem: fixture.removeItem,
  },
}));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: fixture.addListener,
    getLaunchUrl: fixture.getLaunchUrl,
  },
}));
vi.mock("sonner", () => ({
  toast: { success: fixture.success, error: fixture.error },
}));

let controls: ReturnType<typeof useNativeGoogleAuth>;
function Harness() {
  const context = useNativeGoogleAuth();
  useEffect(() => {
    controls = context;
  }, [context]);
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}
function Tree({ path = "/marketplace" }: { path?: string }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <NativeGoogleAuthProvider>
        <Harness />
      </NativeGoogleAuthProvider>
    </MemoryRouter>
  );
}
const renderFlow = (path = "/marketplace") => render(<Tree path={path} />);
const waitReady = () => waitFor(() => expect(controls.ready).toBe(true));
async function start(mode: "signin" | "link" = "signin") {
  await waitReady();
  await act(async () => controls.start(mode));
  return JSON.parse(
    fixture.storage.get(NATIVE_GOOGLE_ATTEMPT_KEY)!,
  ) as NativeGoogleAttempt;
}
async function emit(url: string) {
  await act(async () => fixture.handler?.({ url }));
}
const callback = (attempt: NativeGoogleAttempt, code = "12345678") =>
  `${nativeGoogleRedirect(attempt.nonce)}&code=${code}`;
function seed(mode: "signin" | "link" = "signin", startedAt = Date.now()) {
  const attempt: NativeGoogleAttempt = {
    mode,
    nonce: "a".repeat(64),
    startedAt,
    returnPath: "/android/settings",
    verifier: VERIFIER,
  };
  fixture.storage.set(NATIVE_GOOGLE_ATTEMPT_KEY, JSON.stringify(attempt));
  return attempt;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("VITE_CONVEX_SITE_URL", SITE_URL);
  fixture.native = true;
  fixture.authenticated = false;
  fixture.loading = false;
  fixture.handler = null;
  fixture.launch = undefined;
  fixture.storage.clear();
  fixture.verifierAtRedemption = null;
  fixture.getItem
    .mockReset()
    .mockImplementation(
      async (key: string) => fixture.storage.get(key) ?? null,
    );
  fixture.setItem
    .mockReset()
    .mockImplementation(async (key: string, value: string) => {
      fixture.storage.set(key, value);
    });
  fixture.removeItem.mockReset().mockImplementation(async (key: string) => {
    fixture.storage.delete(key);
  });
  fixture.openUrl.mockReset().mockResolvedValue(undefined);
  fixture.mutation.mockReset().mockResolvedValue({ prepared: true });
  fixture.query.mockReset().mockResolvedValue({ linked: true });
  fixture.signIn.mockReset().mockImplementation(async () => {
    fixture.verifierAtRedemption = fixture.storage.get(VERIFIER_KEY) ?? null;
    return { signingIn: true };
  });
  fixture.action.mockReset().mockImplementation(async (_reference, args) => {
    const url = new URL("/api/auth/signin/google", SITE_URL);
    url.searchParams.set("code", VERIFIER);
    url.searchParams.set("redirectTo", args.params.redirectTo);
    return { redirect: url.toString(), verifier: VERIFIER };
  });
  fixture.removeListener.mockReset().mockResolvedValue(undefined);
  fixture.addListener.mockReset().mockImplementation(async (_name, handler) => {
    fixture.handler = handler;
    return { remove: fixture.removeListener };
  });
  fixture.getLaunchUrl
    .mockReset()
    .mockImplementation(async () => fixture.launch);
  fixture.success.mockReset();
  fixture.error.mockReset();
});

describe("native Google account access", () => {
  it("opens only the external auth route after securely saving the bound attempt", async () => {
    renderFlow();
    const attempt = await start();
    expect(attempt).toMatchObject({
      mode: "signin",
      verifier: VERIFIER,
      returnPath: "/marketplace",
    });
    expect(attempt.nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(fixture.action).toHaveBeenCalledExactlyOnceWith(api.auth.signIn, {
      provider: "google",
      params: { redirectTo: nativeGoogleRedirect(attempt.nonce) },
    });
    expect(fixture.openUrl).toHaveBeenCalledOnce();
    const launched = new URL(fixture.openUrl.mock.calls[0][0]);
    expect(launched.origin).toBe(SITE_URL);
    expect(launched.pathname).toBe("/api/auth/signin/google");
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(fixture.storage.has(VERIFIER_KEY)).toBe(false);
    expect(controls.pending).toBe(true);
  });

  it("redeems a matched callback once through the SDK and cleans only temporary auth state", async () => {
    fixture.storage.set(SESSION_KEY, "existing-session");
    renderFlow();
    const attempt = await start();
    await emit(callback(attempt));
    await waitFor(() => expect(fixture.success).toHaveBeenCalledOnce());
    expect(fixture.signIn).toHaveBeenCalledExactlyOnceWith(undefined, {
      code: "12345678",
    });
    expect(fixture.verifierAtRedemption).toBe(VERIFIER);
    await waitFor(() => expect(controls.pending).toBe(false));
    expect(fixture.storage.has(NATIVE_GOOGLE_ATTEMPT_KEY)).toBe(false);
    expect(fixture.storage.has(CALLBACK_KEY)).toBe(false);
    expect(fixture.storage.has(VERIFIER_KEY)).toBe(false);
    expect(fixture.storage.get(SESSION_KEY)).toBe("existing-session");
    expect(screen.getByTestId("location")).toHaveTextContent("/marketplace");
    await emit(callback(attempt));
    expect(fixture.signIn).toHaveBeenCalledOnce();
  });

  it("ignores wrong nonces and arbitrary Intents without cancelling the real attempt", async () => {
    renderFlow();
    const attempt = await start();
    await emit(
      `com.viso.deck://oauth/google?attempt=${"f".repeat(64)}&code=12345678`,
    );
    await emit(
      `https://attacker.example/?attempt=${attempt.nonce}&code=12345678`,
    );
    await emit(`${callback(attempt)}&redirect=https://attacker.example`);
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(fixture.error).not.toHaveBeenCalled();
    expect(controls.pending).toBe(true);
    expect(fixture.storage.has(NATIVE_GOOGLE_ATTEMPT_KEY)).toBe(true);
    await emit(callback(attempt));
    await waitFor(() => expect(fixture.success).toHaveBeenCalledOnce());
  });

  it("deduplicates retained cold-start event and launch URL for the same attempt", async () => {
    const attempt = seed();
    fixture.launch = { url: callback(attempt) };
    fixture.storage.set(CALLBACK_KEY, callback(attempt));
    renderFlow();
    await waitFor(() => expect(fixture.success).toHaveBeenCalledOnce());
    await emit(callback(attempt));
    expect(fixture.signIn).toHaveBeenCalledOnce();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/android/settings",
    );
  });

  it("restores a saved callback after process death without requiring the launch Intent again", async () => {
    const attempt = seed();
    fixture.storage.set(CALLBACK_KEY, callback(attempt));
    renderFlow();
    await waitFor(() => expect(fixture.success).toHaveBeenCalledOnce());
    expect(fixture.signIn).toHaveBeenCalledOnce();
    expect(fixture.verifierAtRedemption).toBe(VERIFIER);
  });

  it("waits for stored-session hydration before redeeming a cold callback", async () => {
    const attempt = seed();
    fixture.launch = { url: callback(attempt) };
    fixture.loading = true;
    const view = renderFlow();
    await waitReady();
    expect(fixture.storage.has(CALLBACK_KEY)).toBe(true);
    expect(fixture.signIn).not.toHaveBeenCalled();
    fixture.loading = false;
    view.rerender(<Tree />);
    await waitFor(() => expect(fixture.success).toHaveBeenCalledOnce());
    expect(fixture.signIn).toHaveBeenCalledOnce();
  });

  it("arms linking with the current VISO session and confirms its server-side connection", async () => {
    fixture.authenticated = true;
    renderFlow("/android/settings");
    const attempt = await start("link");
    expect(fixture.mutation).toHaveBeenCalledExactlyOnceWith(
      api.social_auth.prepareGoogleLink,
      {},
    );
    expect(fixture.mutation.mock.invocationCallOrder[0]).toBeLessThan(
      fixture.action.mock.invocationCallOrder[0],
    );
    await emit(callback(attempt, "b".repeat(64)));
    await waitFor(() => expect(fixture.success).toHaveBeenCalledOnce());
    expect(fixture.query).toHaveBeenCalledExactlyOnceWith(
      api.social_auth.connection,
      {},
    );
    expect(fixture.success.mock.calls[0][0]).toContain(
      "Tu deck y tus dispositivos se conservan",
    );
  });

  it("never redeems an ordinary signin code as an authenticated account link", async () => {
    fixture.authenticated = true;
    fixture.storage.set(SESSION_KEY, "existing-session");
    renderFlow();
    const attempt = await start("link");
    await emit(callback(attempt));
    await waitFor(() => expect(fixture.error).toHaveBeenCalledOnce());
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(fixture.storage.get(SESSION_KEY)).toBe("existing-session");
    expect(fixture.storage.has(NATIVE_GOOGLE_ATTEMPT_KEY)).toBe(false);
  });

  it("rejects a link return after the previous VISO session disappeared", async () => {
    fixture.authenticated = true;
    const view = renderFlow();
    const attempt = await start("link");
    fixture.authenticated = false;
    view.rerender(<Tree />);
    await emit(callback(attempt, "b".repeat(64)));
    await waitFor(() => expect(fixture.error).toHaveBeenCalledOnce());
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(fixture.query).not.toHaveBeenCalled();
  });

  it("does not report linking success when the connection is not confirmed", async () => {
    fixture.authenticated = true;
    fixture.query.mockResolvedValueOnce({ linked: false });
    renderFlow();
    const attempt = await start("link");
    await emit(callback(attempt, "b".repeat(64)));
    await waitFor(() => expect(fixture.error).toHaveBeenCalledOnce());
    expect(fixture.signIn).toHaveBeenCalledOnce();
    expect(fixture.success).not.toHaveBeenCalled();
  });

  it("lets the user cancel a pending browser flow without clearing their session", async () => {
    fixture.storage.set(SESSION_KEY, "existing-session");
    renderFlow();
    const attempt = await start();
    await act(async () => controls.cancel());
    expect(controls.pending).toBe(false);
    expect(fixture.storage.has(NATIVE_GOOGLE_ATTEMPT_KEY)).toBe(false);
    expect(fixture.storage.get(SESSION_KEY)).toBe("existing-session");
    await emit(callback(attempt));
    expect(fixture.signIn).not.toHaveBeenCalled();
  });

  it("handles a cancelled Google return without trying to redeem or creating a session", async () => {
    renderFlow();
    const attempt = await start();
    await emit(nativeGoogleRedirect(attempt.nonce));
    await waitFor(() => expect(fixture.error).toHaveBeenCalledOnce());
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(fixture.success).not.toHaveBeenCalled();
    expect(controls.pending).toBe(false);
  });

  it("cleans a failed external-browser launch and allows a new attempt", async () => {
    fixture.openUrl.mockRejectedValueOnce(
      new Error("private native diagnostic"),
    );
    renderFlow();
    await waitReady();
    await act(async () => {
      await expect(controls.start("signin")).rejects.toThrow(
        "No pudimos abrir Google",
      );
    });
    expect(fixture.storage.has(NATIVE_GOOGLE_ATTEMPT_KEY)).toBe(false);
    expect(controls.pending).toBe(false);
    await start();
    expect(fixture.openUrl).toHaveBeenCalledTimes(2);
  });

  it("refuses an external or malformed auth redirect before launching the browser", async () => {
    fixture.action.mockResolvedValueOnce({
      redirect: "https://attacker.example/auth",
      verifier: VERIFIER,
    });
    renderFlow();
    await waitReady();
    await act(async () => {
      await expect(controls.start("signin")).rejects.toThrow(
        "No pudimos abrir Google",
      );
    });
    expect(fixture.openUrl).not.toHaveBeenCalled();
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(fixture.storage.has(NATIVE_GOOGLE_ATTEMPT_KEY)).toBe(false);
  });

  it("does not launch Google if secure persistence fails", async () => {
    renderFlow();
    await waitReady();
    fixture.setItem.mockRejectedValueOnce(
      new Error("private vault diagnostic"),
    );
    await act(async () => {
      await expect(controls.start("signin")).rejects.toThrow(
        "No pudimos abrir Google",
      );
    });
    expect(fixture.openUrl).not.toHaveBeenCalled();
    expect(fixture.storage.has(NATIVE_GOOGLE_ATTEMPT_KEY)).toBe(false);
  });

  it("discards an expired cold attempt instead of using its callback", async () => {
    const attempt = seed("signin", Date.now() - 11 * 60_000);
    fixture.launch = { url: callback(attempt) };
    renderFlow();
    await waitReady();
    expect(controls.pending).toBe(false);
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(fixture.storage.has(NATIVE_GOOGLE_ATTEMPT_KEY)).toBe(false);
  });

  it("does not let cancellation race a code already being redeemed", async () => {
    let resolve!: (result: { signingIn: boolean }) => void;
    fixture.signIn.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    renderFlow();
    const attempt = await start();
    await emit(callback(attempt));
    await waitFor(() => expect(fixture.signIn).toHaveBeenCalledOnce());
    await act(async () => controls.cancel());
    expect(controls.pending).toBe(true);
    expect(fixture.storage.has(NATIVE_GOOGLE_ATTEMPT_KEY)).toBe(true);
    await act(async () => resolve({ signingIn: true }));
    await waitFor(() => expect(controls.pending).toBe(false));
    expect(fixture.success).toHaveBeenCalledOnce();
  });

  it("blocks new launches and late callbacks until slow secure cancellation is complete", async () => {
    renderFlow();
    const attempt = await start();
    let releaseDelete!: () => void;
    fixture.removeItem.mockImplementationOnce(
      (key: string) =>
        new Promise<void>((resolve) => {
          releaseDelete = () => {
            fixture.storage.delete(key);
            resolve();
          };
        }),
    );
    let cancellation!: Promise<void>;
    await act(async () => {
      cancellation = controls.cancel();
    });
    expect(controls.pending).toBe(true);
    await act(async () => {
      await expect(controls.start("signin")).rejects.toThrow(
        "Esperá un momento",
      );
    });
    expect(fixture.action).toHaveBeenCalledOnce();
    expect(fixture.openUrl).toHaveBeenCalledOnce();
    await emit(callback(attempt));
    expect(fixture.signIn).not.toHaveBeenCalled();
    await act(async () => {
      releaseDelete();
      await cancellation;
    });
    expect(controls.pending).toBe(false);
    await emit(callback(attempt));
    expect(fixture.signIn).not.toHaveBeenCalled();
    expect(fixture.storage.has(NATIVE_GOOGLE_ATTEMPT_KEY)).toBe(false);
    const replacement = await start();
    expect(replacement.nonce).not.toBe(attempt.nonce);
    expect(fixture.action).toHaveBeenCalledTimes(2);
    expect(fixture.openUrl).toHaveBeenCalledTimes(2);
  });

  it("never starts account linking without an existing VISO session", async () => {
    renderFlow();
    await waitReady();
    await act(async () => {
      await expect(controls.start("link")).rejects.toThrow(
        "Volvé a abrir el acceso de tu cuenta",
      );
    });
    expect(fixture.action).not.toHaveBeenCalled();
    expect(fixture.mutation).not.toHaveBeenCalled();
  });

  it("keeps the web free of native vault and Intent processing", () => {
    fixture.native = false;
    renderFlow();
    expect(fixture.addListener).not.toHaveBeenCalled();
    expect(fixture.getItem).not.toHaveBeenCalled();
    expect(fixture.signIn).not.toHaveBeenCalled();
  });
});
