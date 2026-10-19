import { convexTest } from "convex-test";
import { beforeAll, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { googleProfile, hashSocialCode } from "./lib/google_auth";

// These tests exercise the trusted internal dispatcher after a simulated OAuth
// callback. They do not pretend to verify Google signatures or a real account.
vi.stubEnv("AUTH_GOOGLE_ID", "test-web-client.apps.googleusercontent.com");
vi.stubEnv("AUTH_GOOGLE_SECRET", "local-test-only-google-secret");
vi.stubEnv("CONVEX_SITE_URL", "https://auth-test.example.test");

beforeAll(async () => {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", keys.privateKey),
  );
  const encoded = btoa(String.fromCharCode(...bytes));
  vi.stubEnv(
    "JWT_PRIVATE_KEY",
    `-----BEGIN PRIVATE KEY-----\n${encoded.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`,
  );
});

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert("users", {
      email: "alice@example.test",
      name: "My edited name",
      displayVolume: 43,
    });
    const bobId = await ctx.db.insert("users", {
      email: "bob@example.test",
      name: "Bob",
    });
    const sessionId = await ctx.db.insert("authSessions", {
      userId: aliceId,
      expirationTime: Date.now() + 3600_000,
    });
    const bobSessionId = await ctx.db.insert("authSessions", {
      userId: bobId,
      expirationTime: Date.now() + 3600_000,
    });
    await ctx.db.insert("authAccounts", {
      userId: aliceId,
      provider: "password",
      providerAccountId: "alice@example.test",
      secret: "fixture-not-a-login",
    });
    const pageId = await ctx.db.insert("deckPages", {
      userId: aliceId,
      name: "My deck",
      order: 0,
    });
    return { aliceId, bobId, sessionId, bobSessionId, pageId };
  });
  return {
    t,
    ...ids,
    alice: t.withIdentity({ subject: `${ids.aliceId}|${ids.sessionId}` }),
    bob: t.withIdentity({ subject: `${ids.bobId}|${ids.bobSessionId}` }),
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function oauth(
  f: Fixture,
  options: {
    subject?: string;
    email?: string;
    session?: boolean;
    arm?: boolean;
  } = {},
) {
  if (options.arm)
    await f.alice.mutation(api.social_auth.prepareGoogleLink, {});
  const signature = crypto.randomUUID();
  const verifier = await f.t.run((ctx) =>
    ctx.db.insert("authVerifiers", {
      signature,
      ...(options.session ? { sessionId: f.sessionId } : {}),
    }),
  );
  const subject = options.subject ?? "google-alice";
  const code = (await f.t.mutation(internal.auth.store, {
    args: {
      type: "userOAuth",
      provider: "google",
      providerAccountId: subject,
      signature,
      profile: {
        email: options.email ?? "alice@example.test",
        emailVerified: true,
        googleSubject: subject,
        name: "Google name",
      },
    },
  })) as string;
  return { code, verifier, signature };
}
function redeem(code: string, verifier: string) {
  return {
    args: {
      type: "verifyCodeAndSignIn",
      params: { code },
      verifier,
      generateTokens: false,
      allowExtraProviders: false,
    },
  };
}

it("reports only availability and own Google connection; refuses anonymous or fake-session link intents", async () => {
  const f = await fixture();
  expect(await f.t.query(api.social_auth.availability, {})).toEqual({
    google: true,
  });
  expect(await f.t.query(api.social_auth.connection, {})).toEqual({
    linked: false,
  });
  await expect(
    f.t.mutation(api.social_auth.prepareGoogleLink, {}),
  ).rejects.toThrow(/sesión/);
  const fakeSession = f.t.withIdentity({
    subject: `${f.aliceId}|${f.bobSessionId}`,
  });
  await expect(
    fakeSession.mutation(api.social_auth.prepareGoogleLink, {}),
  ).rejects.toThrow(/sesión/);
  await f.t.run((ctx) =>
    ctx.db.insert("authAccounts", {
      userId: f.aliceId,
      provider: "google",
      providerAccountId: "only-alice",
      emailVerified: "connected@example.test",
    }),
  );
  expect(await f.alice.query(api.social_auth.connection, {})).toEqual({
    linked: true,
    email: "connected@example.test",
  });
  expect(await f.bob.query(api.social_auth.connection, {})).toEqual({
    linked: false,
  });
});

it("requires explicit link intent created before the verifier and a live source session", async () => {
  const f = await fixture();
  await expect(oauth(f, { session: true })).rejects.toThrow(/panel VISO/);
  await f.alice.mutation(api.social_auth.prepareGoogleLink, {});
  await f.t.run(async (ctx) => {
    const intent = (await ctx.db.query("socialLinkIntents").first())!;
    await ctx.db.patch("socialLinkIntents", intent._id, {
      createdAt: Date.now() + 10000,
    });
  });
  await expect(oauth(f, { session: true })).rejects.toThrow(/panel VISO/);
  await f.t.run((ctx) =>
    ctx.db.patch("authSessions", f.sessionId, {
      expirationTime: Date.now() - 1,
    }),
  );
  await expect(oauth(f, { session: true })).rejects.toThrow(/sesión/);
  expect(
    await f.t.run((ctx) => ctx.db.query("socialPendingLinks").collect()),
  ).toHaveLength(0);
});

it("defers account attachment until both session and PKCE proof, preserving VISO data and primary email", async () => {
  const f = await fixture();
  const before = await f.t.run((ctx) => ctx.db.get("users", f.aliceId));
  const { code, verifier } = await oauth(f, {
    session: true,
    arm: true,
    email: "another-owned-google@example.test",
  });
  const pending = await f.t.run((ctx) =>
    ctx.db.query("socialPendingLinks").first(),
  );
  expect(code).toMatch(/^[a-f0-9]{64}$/);
  expect(pending?.codeHash).toBe(await hashSocialCode(code));
  expect(JSON.stringify(pending)).not.toContain(code);
  expect(await f.alice.query(api.social_auth.connection, {})).toEqual({
    linked: false,
  });
  expect(await f.t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
    2,
  );
  await expect(
    f.t.mutation(internal.auth.store, redeem(code, verifier)),
  ).rejects.toThrow(/confirmar tu sesión/);
  await expect(
    f.bob.mutation(internal.auth.store, redeem(code, verifier)),
  ).rejects.toThrow(/confirmar tu sesión/);
  await expect(
    f.alice.mutation(internal.auth.store, redeem(code, "wrong-pkce")),
  ).rejects.toThrow(/confirmar tu sesión/);
  const result = (await f.alice.mutation(
    internal.auth.store,
    redeem(code, verifier),
  )) as { userId: string; sessionId: string };
  expect(result.userId).toBe(f.aliceId);
  expect(await f.t.run((ctx) => ctx.db.get("users", f.aliceId))).toEqual(
    before,
  );
  expect(
    await f.t.run((ctx) => ctx.db.get("deckPages", f.pageId)),
  ).toMatchObject({ name: "My deck", userId: f.aliceId });
  expect(await f.alice.query(api.social_auth.connection, {})).toEqual({
    linked: true,
    email: "another-owned-google@example.test",
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("socialPendingLinks").collect()),
  ).toHaveLength(0);
  const linkedSession = f.t.withIdentity({
    subject: `${f.aliceId}|${result.sessionId}`,
  });
  const sessionsBeforeReplay = await f.t.run((ctx) =>
    ctx.db.query("authSessions").collect(),
  );
  await expect(
    linkedSession.mutation(internal.auth.store, redeem(code, verifier)),
  ).rejects.toThrow(/vinculación venció o ya fue utilizada/);
  expect(
    await f.t.run((ctx) => ctx.db.query("authSessions").collect()),
  ).toEqual(sessionsBeforeReplay);
});

it("rejects expired codes and cleans temporary records without changing users or links", async () => {
  const f = await fixture();
  const { code, verifier } = await oauth(f, { session: true, arm: true });
  const pending = (await f.t.run((ctx) =>
    ctx.db.query("socialPendingLinks").first(),
  ))!;
  await f.t.run((ctx) =>
    ctx.db.patch("socialPendingLinks", pending._id, {
      expires: Date.now() - 1,
    }),
  );
  await expect(
    f.alice.mutation(internal.auth.store, redeem(code, verifier)),
  ).rejects.toThrow(/confirmar tu sesión/);
  await f.t.mutation(internal.social_auth.expirePending, { id: pending._id });
  expect(
    await f.t.run((ctx) => ctx.db.get("authVerifiers", verifier)),
  ).toBeNull();
  const sessionBeforeRetry = await f.t.run((ctx) =>
    ctx.db.get("authSessions", f.sessionId),
  );
  await expect(
    f.alice.mutation(internal.auth.store, redeem(code, verifier)),
  ).rejects.toThrow(/vinculación venció o ya fue utilizada/);
  expect(
    await f.t.run((ctx) => ctx.db.get("authSessions", f.sessionId)),
  ).toEqual(sessionBeforeRetry);
  expect(await f.alice.query(api.social_auth.connection, {})).toEqual({
    linked: false,
  });
  expect(await f.t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
    2,
  );
});

it("throws for unknown reserved link codes without invoking stock sign-in or clearing the existing session", async () => {
  const f = await fixture();
  const before = await f.t.run((ctx) =>
    ctx.db.get("authSessions", f.sessionId),
  );
  for (const code of ["a".repeat(64), "F".repeat(64)]) {
    await expect(
      f.alice.mutation(internal.auth.store, redeem(code, "unknown-verifier")),
    ).rejects.toThrow(/vinculación venció o ya fue utilizada/);
  }
  expect(
    await f.t.run((ctx) => ctx.db.get("authSessions", f.sessionId)),
  ).toEqual(before);
  expect(await f.alice.query(api.social_auth.connection, {})).toEqual({
    linked: false,
  });
  // The ordinary OAuth eight-digit code path retains the library's semantics.
  expect(
    await f.t.mutation(
      internal.auth.store,
      redeem("12345678", "wrong-verifier"),
    ),
  ).toBeNull();
});

it("never migrates another user's Google subject, including a link-ownership race", async () => {
  const f = await fixture();
  const { code, verifier } = await oauth(f, { session: true, arm: true });
  await f.t.run((ctx) =>
    ctx.db.insert("authAccounts", {
      provider: "google",
      providerAccountId: "google-alice",
      userId: f.bobId,
      emailVerified: "alice@example.test",
    }),
  );
  await expect(
    f.alice.mutation(internal.auth.store, redeem(code, verifier)),
  ).rejects.toThrow(/otra cuenta VISO/);
  expect(await f.alice.query(api.social_auth.connection, {})).toEqual({
    linked: false,
  });
  expect(await f.bob.query(api.social_auth.connection, {})).toEqual({
    linked: true,
    email: "alice@example.test",
  });
  await expect(oauth(f, { session: true, arm: true })).rejects.toThrow(
    /otra cuenta VISO/,
  );
});

it("rolls back account attachment if the stock final verification returns null", async () => {
  const f = await fixture();
  const { code, verifier } = await oauth(f, { session: true, arm: true });
  await f.t.run((ctx) =>
    ctx.db.insert("authRateLimits", {
      identifier: "blocked@example.test",
      attemptsLeft: 0,
      lastAttemptTime: Date.now(),
    }),
  );
  const args = redeem(code, verifier);
  await expect(
    f.alice.mutation(internal.auth.store, {
      args: { ...args.args, params: { code, email: "blocked@example.test" } },
    }),
  ).rejects.toThrow(/finalizar la vinculación/);
  expect(await f.alice.query(api.social_auth.connection, {})).toEqual({
    linked: false,
  });
  expect(
    await f.t.run((ctx) => ctx.db.get("authVerifiers", verifier)),
  ).not.toBeNull();
  expect(
    await f.t.run((ctx) => ctx.db.query("socialPendingLinks").collect()),
  ).toHaveLength(1);
});

it("does not auto-merge existing unverified Password email and does not create duplicate VISO users", async () => {
  const f = await fixture();
  await expect(oauth(f)).rejects.toThrow(/contraseña/);
  expect(await f.alice.query(api.social_auth.connection, {})).toEqual({
    linked: false,
  });
  expect(await f.t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
    2,
  );
  const { code, verifier } = await oauth(f, {
    email: "new@example.test",
    subject: "new-google",
  });
  const result = (await f.t.mutation(
    internal.auth.store,
    redeem(code, verifier),
  )) as { userId: string };
  expect(result.userId).not.toBe(f.aliceId);
  const fresh = await f.t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "new@example.test"))
      .unique(),
  );
  expect(fresh?.emailVerificationTime).toBeTypeOf("number");
  const next = await oauth(f, {
    email: "new@example.test",
    subject: "new-google",
  });
  expect(
    (
      (await f.t.mutation(
        internal.auth.store,
        redeem(next.code, next.verifier),
      )) as { userId: string }
    ).userId,
  ).toBe(result.userId);
  await expect(
    f.t.action(api.auth.signIn, {
      provider: "password",
      params: {
        flow: "signUp",
        email: "new@example.test",
        password: "example-test-password-123",
      },
    }),
  ).rejects.toThrow(/utiliza Google/);
  expect(await f.t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
    3,
  );
});

it("keeps normalized Password sign-up, unverified email, credentials and later login working", async () => {
  const t = convexTest(schema, modules);
  const signedUp = await t.action(api.auth.signIn, {
    provider: "password",
    params: {
      flow: "signUp",
      email: "  ORIGINAL@Example.test ",
      name: "  Original  ",
      password: "test-password-12345",
    },
  });
  expect(signedUp.tokens?.token).toBeTypeOf("string");
  const user = await t.run((ctx) => ctx.db.query("users").unique());
  expect(user).toMatchObject({
    email: "original@example.test",
    name: "Original",
  });
  expect(user?.emailVerificationTime).toBeUndefined();
  const signedIn = await t.action(api.auth.signIn, {
    provider: "password",
    params: {
      flow: "signIn",
      email: "ORIGINAL@example.test",
      password: "test-password-12345",
    },
  });
  expect(signedIn.tokens?.token).toBeTypeOf("string");
  await expect(
    t.action(api.auth.signIn, {
      provider: "password",
      params: {
        flow: "signIn",
        email: "original@example.test",
        password: "wrong-password",
      },
    }),
  ).rejects.toThrow();
  expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(1);
});

it("rejects Google profiles without a verified email or stable subject", () => {
  expect(() =>
    googleProfile({ sub: "g", email: "a@example.test", email_verified: false }),
  ).toThrow();
  expect(() =>
    googleProfile({ sub: 12, email: "a@example.test", email_verified: true }),
  ).toThrow();
  expect(
    googleProfile({
      sub: "g",
      email: "  A@Example.test ",
      email_verified: true,
    }),
  ).toMatchObject({ id: "g", email: "a@example.test" });
});

it("requires the original session at completion even for another valid session of the same user", async () => {
  const f = await fixture();
  const { code, verifier } = await oauth(f, { session: true, arm: true });
  const replacementId = await f.t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId: f.aliceId,
      expirationTime: Date.now() + 3600000,
    }),
  );
  const replacement = f.t.withIdentity({
    subject: `${f.aliceId}|${replacementId}`,
  });
  await expect(
    replacement.mutation(internal.auth.store, redeem(code, verifier)),
  ).rejects.toThrow(/confirmar tu sesión/);
  const wrongProvider = redeem(code, verifier);
  await expect(
    f.alice.mutation(internal.auth.store, {
      args: { ...wrongProvider.args, provider: "password" },
    }),
  ).rejects.toThrow(/confirmar tu sesión/);
  await f.t.run((ctx) => ctx.db.delete("authSessions", f.sessionId));
  await expect(
    f.alice.mutation(internal.auth.store, redeem(code, verifier)),
  ).rejects.toThrow(/sesión de vinculación/);
  expect(await f.alice.query(api.social_auth.connection, {})).toEqual({
    linked: false,
  });
});

it("expires armed intents and exposes no credential values in availability", async () => {
  const f = await fixture();
  await f.alice.mutation(api.social_auth.prepareGoogleLink, {});
  const intent = (await f.t.run((ctx) =>
    ctx.db.query("socialLinkIntents").first(),
  ))!;
  await f.t.run((ctx) =>
    ctx.db.patch("socialLinkIntents", intent._id, { expires: Date.now() - 1 }),
  );
  await expect(oauth(f, { session: true })).rejects.toThrow(/panel VISO/);
  await f.t.mutation(internal.social_auth.expireIntent, { id: intent._id });
  expect(
    await f.t.run((ctx) => ctx.db.get("socialLinkIntents", intent._id)),
  ).toBeNull();
  vi.stubEnv("AUTH_GOOGLE_SECRET", "");
  expect(await f.t.query(api.social_auth.availability, {})).toEqual({
    google: false,
  });
  await expect(
    f.alice.mutation(api.social_auth.prepareGoogleLink, {}),
  ).rejects.toThrow(/no está disponible/);
  vi.stubEnv("AUTH_GOOGLE_SECRET", "local-test-only-google-secret");
});

it("reserves legacy normalized Password identities even when the profile email was edited or mixed case", async () => {
  const f = await fixture();
  await f.t.run((ctx) =>
    ctx.db.patch("users", f.aliceId, { email: "Alice@Example.test" }),
  );
  await expect(oauth(f)).rejects.toThrow(/contraseña/);
  await f.t.run((ctx) =>
    ctx.db.patch("users", f.aliceId, {
      email: "different-primary@example.test",
    }),
  );
  await expect(oauth(f)).rejects.toThrow(/contraseña/);
  expect(await f.t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
    2,
  );
  expect(await f.alice.query(api.social_auth.connection, {})).toEqual({
    linked: false,
  });
});
