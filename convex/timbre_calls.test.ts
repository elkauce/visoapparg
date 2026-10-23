import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { modules } from "./test.setup";
import type { Id } from "./_generated/dataModel";

function capability(call: { callId: Id<"timbreCalls">; visitorToken: string }) {
  return { callId: call.callId, visitorToken: call.visitorToken };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("TIMBRE_TURN_URLS", "turns:relay.example.test:5349?transport=tcp");
  vi.stubEnv(
    "TIMBRE_TURN_SECRET",
    "only-local-tests-no-provider-secret-123456789",
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function fixture() {
  const t = convexTest(schema, modules);
  const data = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", {
      name: "Private resident",
      email: "private@example.test",
      phone: "+540001234",
    });
    const relative = await ctx.db.insert("users", { name: "Family" });
    const outsider = await ctx.db.insert("users", { name: "Uninvited" });
    const features = {
      audio: true,
      video: true,
      chat: true,
      messages: true,
      families: true,
      buildings: true,
      offices: true,
      access: false,
    };
    const limits = { maxSites: 3, maxQrs: 10, maxMembers: 10, maxUnits: 10 };
    const planId = await ctx.db.insert("timbrePlans", {
      code: "digital",
      name: "Paid test",
      description: "fixture",
      enabled: true,
      currency: "ARS",
      priceAmount: 10000,
      period: "one_time",
      features,
      limits,
      sellerId: owner,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const licenseId = await ctx.db.insert("timbreLicenses", {
      ownerId: owner,
      planId,
      planName: "Paid test",
      status: "active",
      startsAt: Date.now() - 1000,
      expiresAt: Date.now() + 86_400_000,
      source: "one_time_purchase",
      sourceReference: "verified-test-fixture",
      features,
      limits,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const siteId = await ctx.db.insert("timbreSites", {
      ownerId: owner,
      licenseId,
      kind: "home",
      name: "Entrada",
      timezone: "America/Argentina/Buenos_Aires",
      enabled: true,
      allowedAudio: true,
      allowedVideo: true,
      chatEnabled: true,
      messagesEnabled: true,
      notificationsEnabled: true,
      schedule: [],
      recipientIds: [owner, relative],
      fallbackRecipientIds: [],
      fallbackAfterSeconds: 30,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const memberId = await ctx.db.insert("timbreMembers", {
      siteId,
      userId: owner,
      role: "owner",
      unitIds: [],
      canReceive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const relativeMemberId = await ctx.db.insert("timbreMembers", {
      siteId,
      userId: relative,
      role: "resident",
      unitIds: [],
      canReceive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const qrToken = "b".repeat(64);
    const qrId = await ctx.db.insert("timbreQrs", {
      siteId,
      token: qrToken,
      label: "Door",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const baseline = await ctx.db.insert("statuses", {
      userId: owner,
      name: "Libre",
      color: "#00ff00",
      icon: "check",
      order: 0,
    });
    await ctx.db.patch("users", owner, {
      activeStatusId: baseline,
      activeStatusRevision: 1,
    });
    return {
      owner,
      relative,
      outsider,
      planId,
      licenseId,
      siteId,
      qrId,
      qrToken,
      memberId,
      relativeMemberId,
      baseline,
    };
  });
  const signed = t.withIdentity({ subject: `${data.owner}|session` });
  const family = t.withIdentity({ subject: `${data.relative}|family` });
  const stranger = t.withIdentity({ subject: `${data.outsider}|outsider` });
  const start = (
    mode: "audio" | "video" | "chat" = "audio",
    visitorNonce = "visitor_1234567890",
  ) =>
    t.mutation(api.timbre_calls.startCall, {
      qrToken: data.qrToken,
      mode,
      visitorNonce,
    });
  return { t, signed, family, stranger, start, ...data };
}

describe("licensed anonymous calls", () => {
  it("fails closed without TURN while separately licensed chat remains available", async () => {
    const { t, qrToken, start } = await fixture();
    vi.stubEnv("TIMBRE_TURN_SECRET", "");
    expect(
      await t.query(api.timbre_calls.rtcAvailability, { qrToken }),
    ).toEqual({ available: false });
    await expect(start()).rejects.toThrow(/conexión/);
    expect((await start("chat")).status).toBe("ringing");
    await expect(
      t.query(api.timbre_calls.rtcAvailability, { qrToken: "not-a-qr" }),
    ).rejects.toThrow();
  });
  it("requires a current paid license on creation, session, signaling, messages and history", async () => {
    const { t, signed, siteId, licenseId, start, qrToken } = await fixture();
    const call = await start();
    await signed.mutation(api.timbre_calls.accept, { callId: call.callId });
    await t.run((ctx) =>
      ctx.db.patch("timbreLicenses", licenseId, { status: "past_due" }),
    );
    await expect(
      t.query(api.timbre_calls.session, capability(call)),
    ).rejects.toThrow(/licencia/);
    await expect(
      t.query(api.timbre_calls.signals, capability(call)),
    ).rejects.toThrow(/licencia/);
    await expect(
      signed.query(api.timbre_calls.history, { siteId }),
    ).rejects.toThrow(/licencia/);
    await expect(
      t.mutation(api.timbre_calls.leaveMessage, {
        qrToken,
        visitorNonce: "visitor_9876543210",
        text: "hi",
      }),
    ).rejects.toThrow(/licencia/);
    await expect(start("chat", "visitor_9876543210")).rejects.toThrow(
      /licencia/,
    );
    // Revocation still permits bounded cleanup and restores the shared source.
    await expect(
      t.mutation(api.timbre_calls.end, capability(call)),
    ).resolves.toEqual({ ended: true });
  });
  it("issues an opaque capability without exposing identity or plaintext credentials", async () => {
    const { t, signed, stranger, start } = await fixture();
    const call = await start();
    const record = await t.run((ctx) => ctx.db.get("timbreCalls", call.callId));
    expect(call.visitorToken).toMatch(/^[a-f0-9]{64}$/);
    expect(record?.visitorTokenHash).not.toBe(call.visitorToken);
    const session = await t.query(api.timbre_calls.session, capability(call));
    expect(JSON.stringify(session)).not.toMatch(
      /private@example|540001234|Private resident|visitorTokenHash/,
    );
    await expect(
      t.query(api.timbre_calls.session, {
        callId: call.callId,
        visitorToken: "c".repeat(64),
      }),
    ).rejects.toThrow();
    await expect(
      stranger.mutation(api.timbre_calls.accept, { callId: call.callId }),
    ).rejects.toThrow();
    await expect(
      t.query(api.timbre_calls.session, { callId: call.callId }),
    ).rejects.toThrow();
    expect(await signed.query(api.timbre_calls.incoming, {})).toHaveLength(1);
  });
  it("checks QR revocation, mute, schedule and rate/cooldown before creating calls", async () => {
    const { t, qrId, siteId, start } = await fixture();
    await t.run((ctx) =>
      ctx.db.patch("timbreSites", siteId, { mutedUntil: Date.now() + 60_000 }),
    );
    await expect(start()).rejects.toThrow(/momento/);
    await t.run((ctx) =>
      ctx.db.patch("timbreSites", siteId, {
        mutedUntil: undefined,
        schedule: [
          {
            day: (new Date().getUTCDay() + 2) % 7,
            start: "01:00",
            end: "02:00",
          },
        ],
      }),
    );
    await expect(start()).rejects.toThrow(/momento/);
    await t.run((ctx) => ctx.db.patch("timbreSites", siteId, { schedule: [] }));
    const call = await start();
    await expect(start("audio", "different_9876543210")).rejects.toThrow(
      /Esperá/,
    );
    await t.run((ctx) =>
      ctx.db.patch("timbreQrs", qrId, { revokedAt: Date.now() }),
    );
    await expect(
      t.query(api.timbre_calls.session, capability(call)),
    ).rejects.toThrow();
  });
});

describe("recipient and media authorization", () => {
  it("allows one invited recipient to accept, with scoped RTC roles and TURN credentials", async () => {
    const { t, signed, family, stranger, start } = await fixture();
    const call = await start();
    expect(
      await family.query(api.timbre_calls.signals, { callId: call.callId }),
    ).toEqual([]);
    await signed.mutation(api.timbre_calls.accept, { callId: call.callId });
    await expect(
      family.mutation(api.timbre_calls.accept, { callId: call.callId }),
    ).rejects.toThrow();
    await expect(
      stranger.query(api.timbre_calls.signals, { callId: call.callId }),
    ).rejects.toThrow();
    expect(
      await family.query(api.timbre_calls.signals, { callId: call.callId }),
    ).toEqual([]);
    const offer = JSON.stringify({
      type: "offer",
      sdp: "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n",
    });
    await expect(
      signed.mutation(api.timbre_calls.sendSignal, {
        callId: call.callId,
        kind: "offer",
        payload: offer,
      }),
    ).rejects.toThrow();
    await t.mutation(api.timbre_calls.sendSignal, {
      ...capability(call),
      kind: "offer",
      payload: offer,
    });
    const remote = await signed.query(api.timbre_calls.signals, {
      callId: call.callId,
    });
    expect(remote).toHaveLength(1);
    expect(await t.query(api.timbre_calls.signals, capability(call))).toEqual(
      [],
    );
    await expect(
      family.action(api.timbre_calls.getRtcConfiguration, {
        callId: call.callId,
      }),
    ).rejects.toThrow();
    const rtc = await t.action(
      api.timbre_calls.getRtcConfiguration,
      capability(call),
    );
    expect(rtc.iceTransportPolicy).toBe("relay");
    const acceptedCall = await t.run((ctx) =>
      ctx.db.get("timbreCalls", call.callId),
    );
    expect(rtc.expiresAt).toBe(
      Math.floor((acceptedCall!.expiresAt + 60_000) / 1000) * 1000,
    );
    expect(rtc.expiresAt).toBeGreaterThan(Date.now() + 20 * 60_000);
    expect(rtc.expiresAt).toBeLessThanOrEqual(Date.now() + 21 * 60_000);
    expect(Number(rtc.iceServers[0].username.split(":")[0]) * 1000).toBe(
      rtc.expiresAt,
    );
    expect(JSON.stringify(rtc)).not.toContain("only-local-tests");
    await t.mutation(api.timbre_calls.end, capability(call));
    expect(
      await signed.query(api.timbre_calls.signals, { callId: call.callId }),
    ).toEqual([]);
    expect(
      await t.run((ctx) => ctx.db.query("timbreSignals").collect()),
    ).toEqual([]);
  });
  it("rejects malformed RTC payloads and stale/removed participants", async () => {
    const { t, signed, memberId, start } = await fixture();
    const call = await start();
    await signed.mutation(api.timbre_calls.accept, { callId: call.callId });
    await expect(
      t.mutation(api.timbre_calls.sendSignal, {
        ...capability(call),
        kind: "ice",
        payload: JSON.stringify({ candidate: "injection" }),
      }),
    ).rejects.toThrow(/inválida/);
    await t.run((ctx) => ctx.db.delete("timbreMembers", memberId));
    await expect(
      signed.query(api.timbre_calls.signals, { callId: call.callId }),
    ).rejects.toThrow();
    expect(
      await signed.mutation(api.timbre_calls.heartbeat, {
        callId: call.callId,
      }),
    ).toEqual({ status: "ended" });
  });
  it("scopes building recipients/history to their current unit, even with stale configured recipients", async () => {
    const { t, signed, family, siteId, relative, relativeMemberId, start } =
      await fixture();
    await t.run(async (ctx) => {
      await ctx.db.patch("timbreSites", siteId, { kind: "building" });
      const unitA = await ctx.db.insert("timbreUnits", {
        siteId,
        name: "A",
        enabled: true,
        recipientIds: [relative],
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const unitB = await ctx.db.insert("timbreUnits", {
        siteId,
        name: "B",
        enabled: true,
        recipientIds: [],
        order: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.patch("timbreMembers", relativeMemberId, {
        unitIds: [unitB],
      });
      await ctx.db.patch("timbreSites", siteId, { recipientIds: [relative] });
      const qr = (await ctx.db.query("timbreQrs").first())!;
      await ctx.db.patch("timbreQrs", qr._id, { unitId: unitA });
    });
    await expect(start()).rejects.toThrow(/destinatarios/);
    expect(await family.query(api.timbre_calls.history, { siteId })).toEqual(
      [],
    );
    expect(await signed.query(api.timbre_calls.history, { siteId })).toEqual(
      [],
    );
  });
});

describe("call lifecycle and messages", () => {
  it("changes presence only on accept, expires lost peers and preserves manual choices", async () => {
    const { t, signed, owner, baseline, start } = await fixture();
    const call = await start();
    expect(
      (await t.run((ctx) => ctx.db.get("users", owner)))?.activeStatusId,
    ).toBe(baseline);
    await signed.mutation(api.timbre_calls.accept, { callId: call.callId });
    expect(
      (await t.run((ctx) => ctx.db.get("users", owner)))?.activeStatusId,
    ).not.toBe(baseline);
    await t.run((ctx) =>
      ctx.db.patch("timbreCalls", call.callId, {
        visitorSeenAt: Date.now() - 100_000,
      }),
    );
    await t.mutation(internal.timbre_calls.expireCall, { callId: call.callId });
    expect(
      (await t.run((ctx) => ctx.db.get("users", owner)))?.activeStatusId,
    ).toBe(baseline);
    const second = await t.run(async (ctx) => {
      const original = (await ctx.db.get("timbreCalls", call.callId))!;
      const {
        _id,
        _creationTime,
        endedAt,
        reason,
        acceptedBy,
        acceptedAt,
        ownerSeenAt,
        ...fields
      } = original;
      void _id;
      void _creationTime;
      void endedAt;
      void reason;
      void acceptedBy;
      void acceptedAt;
      void ownerSeenAt;
      const id = await ctx.db.insert("timbreCalls", {
        ...fields,
        status: "ringing",
        expiresAt: Date.now() + 90_000,
        visitorSeenAt: Date.now(),
      });
      await ctx.db.insert("timbreCallRecipients", {
        callId: id,
        userId: owner,
        wave: "primary",
        createdAt: Date.now(),
      });
      return id;
    });
    await signed.mutation(api.timbre_calls.accept, { callId: second });
    const manual = await signed.mutation(api.statuses.create, {
      name: "Pepe",
      color: "#ffee00",
      icon: "star",
    });
    await signed.mutation(api.statuses.setActive, { statusId: manual });
    await signed.mutation(api.timbre_calls.end, { callId: second });
    expect(
      (await t.run((ctx) => ctx.db.get("users", owner)))?.activeStatusId,
    ).toBe(manual);
  });
  it("marks unanswered calls missed without changing presence and sends only explicit fallback", async () => {
    const { t, signed, family, owner, relative, siteId, baseline, start } =
      await fixture();
    await t.run((ctx) =>
      ctx.db.patch("timbreSites", siteId, {
        recipientIds: [owner],
        fallbackRecipientIds: [relative],
      }),
    );
    const call = await start();
    expect(await family.query(api.timbre_calls.incoming, {})).toEqual([]);
    await t.mutation(internal.timbre_calls.notifyFallback, {
      callId: call.callId,
    });
    expect(await family.query(api.timbre_calls.incoming, {})).toHaveLength(1);
    await t.run((ctx) =>
      ctx.db.patch("timbreCalls", call.callId, { expiresAt: Date.now() - 1 }),
    );
    await t.mutation(internal.timbre_calls.expireCall, { callId: call.callId });
    expect(
      (await signed.query(api.timbre_calls.history, { siteId }))[0].status,
    ).toBe("missed");
    expect(
      (await t.run((ctx) => ctx.db.get("users", owner)))?.activeStatusId,
    ).toBe(baseline);
  });
  it("gates chat/offline messages by settings and entitlement without exposing other residents", async () => {
    const { t, signed, stranger, start, siteId, qrToken, licenseId } =
      await fixture();
    const call = await start("chat");
    await expect(
      t.mutation(api.timbre_calls.sendMessage, {
        ...capability(call),
        text: "Before accept",
      }),
    ).rejects.toThrow();
    await signed.mutation(api.timbre_calls.accept, { callId: call.callId });
    await t.mutation(api.timbre_calls.sendMessage, {
      ...capability(call),
      text: "  Hola  ",
    });
    expect(
      (await signed.query(api.timbre_calls.chat, { callId: call.callId }))[0]
        .text,
    ).toBe("Hola");
    await expect(
      stranger.query(api.timbre_calls.chat, { callId: call.callId }),
    ).rejects.toThrow();
    await t.mutation(api.timbre_calls.leaveMessage, {
      qrToken,
      visitorNonce: "offline_1234567890",
      text: "Visité la entrada",
    });
    expect(
      (await signed.query(api.timbre_calls.messages, { siteId }))[0].text,
    ).toBe("Visité la entrada");
    await expect(
      stranger.query(api.timbre_calls.messages, { siteId }),
    ).rejects.toThrow();
    await t.run(async (ctx) => {
      const license = (await ctx.db.get("timbreLicenses", licenseId))!;
      await ctx.db.patch("timbreLicenses", licenseId, {
        features: { ...license.features, chat: false, messages: false },
      });
    });
    await expect(
      t.mutation(api.timbre_calls.leaveMessage, {
        qrToken,
        visitorNonce: "another_1234567890",
        text: "Blocked",
      }),
    ).rejects.toThrow();
    await expect(
      t.query(api.timbre_calls.chat, capability(call)),
    ).rejects.toThrow();
  });
  it("allows residents to block a repeated visitor without granting public door access", async () => {
    const { t, signed, start } = await fixture();
    const call = await start();
    await signed.mutation(api.timbre_calls.blockVisitor, {
      callId: call.callId,
    });
    await expect(start()).rejects.toThrow();
    expect(
      (await t.query(api.timbre_calls.session, capability(call))).status,
    ).toBe("rejected");
  });
});
