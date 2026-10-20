import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import {
  convexAuth,
  getAuthSessionId,
  getAuthUserId,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { RegisteredMutation } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  googleAvailable,
  googleProfile,
  hashSocialCode,
  newSocialCode,
  normalizeEmail,
} from "./lib/google_auth";
import { googleAuthRedirect } from "./lib/google_auth_redirect";

const LINK_TTL = 2 * 60_000;
type LinkTarget = { userId: Id<"users">; googleSubject: string };

function checkedGoogleProfile(
  profile: Record<string, unknown>,
  googleSubject: string,
) {
  if (
    profile.emailVerified !== true ||
    profile.googleSubject !== googleSubject ||
    !googleSubject ||
    googleSubject.length > 255
  )
    throw new ConvexError("Google no verificó esta cuenta.");
  return {
    email: normalizeEmail(profile.email),
    emailVerified: true as const,
    googleSubject,
    ...(typeof profile.name === "string"
      ? { name: profile.name.trim().slice(0, 80) }
      : {}),
    ...(typeof profile.image === "string" &&
    profile.image.startsWith("https://")
      ? { image: profile.image }
      : {}),
  };
}

// A per-invocation closure holds the trusted target. Never use a global variable,
// profile field, email match, or the unauthenticated HTTP callback's ctx.auth.
function configureAuth(linkTarget?: LinkTarget) {
  return convexAuth({
    providers: [
      Password({
        profile(params) {
          const email = normalizeEmail(params.email);
          const name =
            typeof params.name === "string" ? params.name.trim() : "";
          if (name.length > 80)
            throw new Error("El nombre debe tener como máximo 80 caracteres");
          return { email, ...(name ? { name } : {}) };
        },
      }),
      ...(googleAvailable()
        ? [
            Google({
              clientId: process.env.AUTH_GOOGLE_ID!,
              clientSecret: process.env.AUTH_GOOGLE_SECRET!,
              allowDangerousEmailAccountLinking: false,
              authorization: {
                params: {
                  scope: "openid email profile",
                  prompt: "select_account",
                },
              },
              profile: googleProfile,
            }),
          ]
        : []),
    ],
    callbacks: {
      async redirect({ redirectTo }) {
        return googleAuthRedirect(redirectTo);
      },
      async createOrUpdateUser(genericCtx, args) {
        const ctx = genericCtx as MutationCtx;
        if (args.provider.id === "google" && args.type === "oauth") {
          const subject = args.profile.googleSubject;
          if (typeof subject !== "string")
            throw new ConvexError("Cuenta Google inválida.");
          const profile = checkedGoogleProfile(args.profile, subject);
          if (linkTarget) {
            if (
              subject !== linkTarget.googleSubject ||
              (args.existingUserId && args.existingUserId !== linkTarget.userId)
            ) {
              throw new ConvexError(
                "Esta cuenta Google ya está vinculada a otra cuenta VISO.",
              );
            }
            if (!(await ctx.db.get("users", linkTarget.userId))) {
              throw new ConvexError("La cuenta VISO ya no está disponible.");
            }
            // Keep the user's primary email, edited name, deck and devices intact.
            return linkTarget.userId;
          }
          if (args.existingUserId) {
            if (!(await ctx.db.get("users", args.existingUserId))) {
              throw new ConvexError("La cuenta VISO ya no está disponible.");
            }
            return args.existingUserId;
          }
          const collision = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", profile.email))
            .first();
          // Older profiles can have a mixed-case or edited primary email while
          // their normalized Password identity still owns this login address.
          const passwordCollision = await ctx.db
            .query("authAccounts")
            .withIndex("providerAndAccountId", (q) =>
              q
                .eq("provider", "password")
                .eq("providerAccountId", profile.email),
            )
            .unique();
          if (collision || passwordCollision) {
            throw new ConvexError(
              "Ya existe una cuenta VISO con ese correo. Iniciá sesión con tu contraseña y vinculá Google desde el panel.",
            );
          }
          return await ctx.db.insert("users", {
            email: profile.email,
            emailVerificationTime: Date.now(),
            ...(profile.name ? { name: profile.name } : {}),
            ...(profile.image ? { image: profile.image } : {}),
          });
        }
        // Preserve Password's existing sign-in and unverified-email semantics.
        if (args.existingUserId) return args.existingUserId;
        const email = normalizeEmail(args.profile.email);
        const matches = await ctx.db
          .query("users")
          .withIndex("email", (q) => q.eq("email", email))
          .collect();
        for (const user of matches) {
          const google = await ctx.db
            .query("authAccounts")
            .withIndex("userIdAndProvider", (q) =>
              q.eq("userId", user._id).eq("provider", "google"),
            )
            .first();
          if (google)
            throw new ConvexError(
              "Ese correo ya utiliza Google. Continuá con Google.",
            );
        }
        return await ctx.db.insert("users", {
          email,
          ...(typeof args.profile.name === "string" && args.profile.name
            ? { name: args.profile.name }
            : {}),
        });
      },
    },
  });
}

const base = configureAuth();
export const { auth, signIn, signOut, isAuthenticated } = base;
type StoreArgs =
  typeof base.store extends RegisteredMutation<"internal", infer Args, unknown>
    ? Args
    : never;
// Convex includes _handler at runtime (registration_impl.js) but strips the
// @internal declaration from its distributed .d.ts. Keep the adapter cast local.
function originalStore(instance: ReturnType<typeof configureAuth>) {
  return (
    instance.store as typeof instance.store & {
      _handler: (ctx: MutationCtx, args: StoreArgs) => Promise<unknown>;
    }
  )._handler;
}

async function requireLinkSession(
  ctx: MutationCtx,
  sessionId: Id<"authSessions">,
  userId?: Id<"users">,
) {
  const session = await ctx.db.get("authSessions", sessionId);
  if (
    !session ||
    session.expirationTime <= Date.now() ||
    (userId && session.userId !== userId) ||
    !(await ctx.db.get("users", session.userId))
  ) {
    throw new ConvexError(
      "La sesión de vinculación venció. Volvé a iniciar sesión.",
    );
  }
  return session;
}

// Adapter pinned to @convex-dev/auth 0.0.96. That version remembers the original
// session in authVerifiers, but drops it before createOrUpdateUser. Linking at
// the HTTP callback would precede PKCE/session proof. Defer it until redemption.
// _handler is Convex's registered-mutation internal API; security tests exercise
// this exact dispatcher. Dependencies must not be upgraded without those tests.
export const store = internalMutation({
  args: { args: v.any() },
  handler: async (ctx, wrapperArgs): Promise<unknown> => {
    const args = wrapperArgs.args as StoreArgs["args"];
    if (args.type === "userOAuth" && args.provider === "google") {
      const verifier = await ctx.db
        .query("authVerifiers")
        .withIndex("signature", (q) => q.eq("signature", args.signature))
        .unique();
      if (!verifier)
        throw new ConvexError(
          "La solicitud de Google venció. Volvé a intentarlo.",
        );
      if (verifier.sessionId) {
        const session = await requireLinkSession(ctx, verifier.sessionId);
        const intent = await ctx.db
          .query("socialLinkIntents")
          .withIndex("by_session", (q) =>
            q.eq("sessionId", verifier.sessionId!),
          )
          .unique();
        if (
          !intent ||
          intent.userId !== session.userId ||
          intent.expires <= Date.now() ||
          verifier._creationTime < intent.createdAt
        ) {
          throw new ConvexError(
            "Para vincular Google, iniciá la vinculación desde tu panel VISO.",
          );
        }
        const profile = checkedGoogleProfile(
          args.profile as Record<string, unknown>,
          args.providerAccountId,
        );
        const existing = await ctx.db
          .query("authAccounts")
          .withIndex("providerAndAccountId", (q) =>
            q
              .eq("provider", "google")
              .eq("providerAccountId", args.providerAccountId),
          )
          .unique();
        if (existing && existing.userId !== session.userId) {
          throw new ConvexError(
            "Esta cuenta Google ya está vinculada a otra cuenta VISO.",
          );
        }
        const code = newSocialCode();
        const id = await ctx.db.insert("socialPendingLinks", {
          userId: session.userId,
          sessionId: session._id,
          verifierId: verifier._id,
          codeHash: await hashSocialCode(code),
          expires: Date.now() + LINK_TTL,
          signature: args.signature,
          googleSubject: args.providerAccountId,
          profile,
        });
        await ctx.db.delete("socialLinkIntents", intent._id);
        await ctx.scheduler.runAfter(
          LINK_TTL,
          internal.social_auth.expirePending,
          { id },
        );
        return code;
      }
    }
    if (
      args.type === "verifyCodeAndSignIn" &&
      typeof args.params?.code === "string"
    ) {
      const codeHash = await hashSocialCode(args.params.code);
      const pending = await ctx.db
        .query("socialPendingLinks")
        .withIndex("by_code", (q) => q.eq("codeHash", codeHash))
        .unique();
      if (pending) {
        const session = await requireLinkSession(
          ctx,
          pending.sessionId,
          pending.userId,
        );
        const currentSessionId = await getAuthSessionId(ctx);
        const currentUserId = await getAuthUserId(ctx);
        const verifier = await ctx.db.get("authVerifiers", pending.verifierId);
        if (
          pending.expires <= Date.now() ||
          currentSessionId !== session._id ||
          currentUserId !== pending.userId ||
          args.verifier !== pending.verifierId ||
          (args.provider !== undefined && args.provider !== "google") ||
          !verifier ||
          verifier.sessionId !== session._id ||
          verifier.signature !== pending.signature
        ) {
          throw new ConvexError(
            "No se pudo confirmar tu sesión. Volvé al panel e iniciá la vinculación otra vez.",
          );
        }
        const linkedAuth = configureAuth({
          userId: pending.userId,
          googleSubject: pending.googleSubject,
        });
        const realCode = await originalStore(linkedAuth)(ctx, {
          args: {
            type: "userOAuth",
            provider: "google",
            providerAccountId: pending.googleSubject,
            profile: pending.profile,
            signature: pending.signature,
          },
        });
        if (typeof realCode !== "string")
          throw new Error("Unexpected OAuth link response");
        const result = await originalStore(linkedAuth)(ctx, {
          args: {
            ...args,
            params: { ...args.params, code: realCode },
          },
        });
        if (!result)
          throw new ConvexError(
            "No se pudo finalizar la vinculación. Volvé a intentarlo.",
          );
        await ctx.db.delete("socialPendingLinks", pending._id);
        return result;
      }
      // This format belongs exclusively to our deferred-link flow. Falling
      // through to stock verification after cleanup/replay returns null, which
      // the React SDK interprets as clearing the user's existing login token.
      // Throw instead: a failed link must leave the VISO session untouched.
      if (/^[a-f0-9]{64}$/i.test(args.params.code)) {
        throw new ConvexError(
          "La vinculación venció o ya fue utilizada. Volvé al panel e iniciá la vinculación otra vez.",
        );
      }
    }
    return await originalStore(base)(ctx, wrapperArgs as StoreArgs);
  },
});
