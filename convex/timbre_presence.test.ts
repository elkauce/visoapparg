import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";
import { api, internal } from "./_generated/api";
import {
  beginTimbrePresence,
  beginTimbreRingPresence,
  endTimbrePresence,
  endTimbreRingPresence,
  expirePresenceSource,
  removePresenceSource,
  setPresenceSource,
} from "./lib/timbre_presence";

async function fixture() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Owner",
      homeWebhookUrl: "https://example.test/lights",
    }),
  );
  const signed = t.withIdentity({ subject: `${userId}|session` });
  const free = await signed.mutation(api.statuses.create, {
    name: "Libre",
    color: "#00ff00",
    icon: "check",
  });
  const meeting = await signed.mutation(api.statuses.create, {
    name: "Reunión",
    color: "#ffff00",
    icon: "users",
  });
  await signed.mutation(api.statuses.setActive, { statusId: free });
  const deviceId = crypto.randomUUID();
  const capability = await signed.mutation(api.background_presence.enroll, {
    deviceId,
  });
  const phone = (calling: boolean) =>
    t.mutation(api.background_presence.signal, {
      secret: capability.secret,
      calling,
    });
  const begin = (callId = "one") =>
    t.run((ctx) => beginTimbrePresence(ctx, userId, callId));
  const end = (callId = "one") =>
    t.run((ctx) => endTimbrePresence(ctx, userId, callId));
  const current = () => t.run((ctx) => ctx.db.get("users", userId));
  return {
    t,
    signed,
    userId,
    free,
    meeting,
    deviceId,
    phone,
    begin,
    end,
    current,
  };
}

describe("shared Timbre, telephone and calendar presence", () => {
  it("does not duplicate a webhook when both native and source expiry run for an unchanged call status", async () => {
    const f = await fixture();
    await f.phone(true);
    const callStatus = (await f.current())!.activeStatusId!;
    await f.phone(false);
    await f.signed.mutation(api.statuses.setActive, { statusId: callStatus });
    const revision = (await f.current())!.activeStatusRevision;
    await f.phone(true);
    const deviceId = await f.t.run(async (ctx) => {
      const device = (await ctx.db.query("presenceDevices").first())!;
      await ctx.db.patch("presenceDevices", device._id, {
        lastSeen: Date.now() - 100_000,
      });
      const source = (await ctx.db.query("presenceSources").first())!;
      await ctx.db.patch("presenceSources", source._id, {
        expiresAt: Date.now() - 1,
      });
      await expirePresenceSource(ctx, f.userId, source.sourceKey);
      return device._id;
    });
    await f.t.mutation(internal.background_presence.expireCall, { deviceId });
    expect((await f.current())!.activeStatusId).toBe(callStatus);
    expect((await f.current())!.activeStatusRevision).toBe(revision);
  });
  it("places optional ringing below telephone and restores without flicker", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      beginTimbreRingPresence(ctx, f.userId, "ring", f.meeting),
    );
    expect((await f.current())!.activeStatusId).toBe(f.meeting);
    await f.phone(true);
    const revision = (await f.current())!.activeStatusRevision;
    await f.t.run((ctx) => endTimbreRingPresence(ctx, f.userId, "ring"));
    expect((await f.current())!.activeStatusRevision).toBe(revision);
    await f.phone(false);
    expect((await f.current())!.activeStatusId).toBe(f.free);
  });
  it("does not overwrite a manual choice when ringing finishes or is accepted", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      beginTimbreRingPresence(ctx, f.userId, "ring", f.meeting),
    );
    await f.signed.mutation(api.statuses.setActive, { statusId: f.free });
    const revision = (await f.current())!.activeStatusRevision;
    await f.begin("ring");
    await f.t.run((ctx) => endTimbreRingPresence(ctx, f.userId, "ring"));
    await f.end("ring");
    expect((await f.current())!.activeStatusId).toBe(f.free);
    expect((await f.current())!.activeStatusRevision).toBe(revision);
  });
  it("clears the owner's ring when a different resident accepts without transferring baselines", async () => {
    const f = await fixture();
    const resident = await f.t.run((ctx) =>
      ctx.db.insert("users", { name: "Resident" }),
    );
    await f.t.run((ctx) =>
      beginTimbreRingPresence(ctx, f.userId, "ring", f.meeting),
    );
    await f.t.run(async (ctx) => {
      await beginTimbrePresence(ctx, resident, "ring");
      await endTimbreRingPresence(ctx, f.userId, "ring");
    });
    expect((await f.current())!.activeStatusId).toBe(f.free);
    expect(
      (await f.t.run((ctx) => ctx.db.get("users", resident)))!.activeStatusId,
    ).toBeDefined();
    await f.t.run((ctx) => endTimbrePresence(ctx, resident, "ring"));
    expect(
      (await f.t.run((ctx) => ctx.db.get("users", resident)))!.activeStatusId,
    ).toBeUndefined();
  });
  for (const phoneEndsFirst of [true, false]) {
    it(`restores the baseline once when ${phoneEndsFirst ? "telephone" : "Timbre"} ends first`, async () => {
      const f = await fixture();
      await f.phone(true);
      const activeCall = (await f.current())!.activeStatusId;
      const revision = (await f.current())!.activeStatusRevision;
      await f.begin();
      // Same effective call state does not repeat notifications/light writes.
      expect((await f.current())!.activeStatusRevision).toBe(revision);
      if (phoneEndsFirst) {
        await f.phone(false);
        await f.end();
      } else {
        await f.end();
        await f.phone(false);
      }
      expect((await f.current())!.activeStatusId).toBe(f.free);
      expect((await f.current())!.activeStatusId).not.toBe(activeCall);
      expect((await f.current())!.activeStatusRevision).toBe(
        (revision ?? 0) + 1,
      );
      expect(
        await f.t.run((ctx) => ctx.db.query("presenceArbiters").collect()),
      ).toHaveLength(0);
    });
  }
  it("handles a telephone call starting after Timbre", async () => {
    const f = await fixture();
    await f.begin();
    await f.phone(true);
    await f.end();
    expect((await f.current())!.activeStatusId).not.toBe(f.free);
    await f.phone(false);
    expect((await f.current())!.activeStatusId).toBe(f.free);
  });
  it("keeps a live meeting behind a call, and removes a meeting that ended behind it", async () => {
    const f = await fixture();
    const signal = (mode: "meeting" | null) =>
      f.signed.mutation(api.deck_actions.activateAutomaticStatus, {
        accountId: f.userId,
        deviceId: f.deviceId,
        requestId: crypto.randomUUID(),
        expectedRevision: 0,
        statusId: mode ? f.meeting : null,
        presenceMode: mode,
      });
    await signal("meeting");
    await f.begin();
    await f.end();
    expect((await f.current())!.activeStatusId).toBe(f.meeting);
    await f.begin();
    await signal(null);
    await f.end();
    expect((await f.current())!.activeStatusId).toBe(f.free);
  });
  for (const sameStatus of [false, true]) {
    it(`preserves manual ${sameStatus ? "same-state" : "different-state"} selection across every source end`, async () => {
      const f = await fixture();
      await f.phone(true);
      await f.begin();
      const manual = sameStatus
        ? (await f.current())!.activeStatusId!
        : f.meeting;
      await f.signed.mutation(api.statuses.setActive, { statusId: manual });
      const revision = (await f.current())!.activeStatusRevision;
      await f.phone(true);
      await f.end();
      await f.phone(false);
      expect((await f.current())!.activeStatusId).toBe(manual);
      expect((await f.current())!.activeStatusRevision).toBe(revision);
    });
  }
  it("is idempotent for duplicate accepts/end and two accepted calls", async () => {
    const f = await fixture();
    await f.begin();
    const revision = (await f.current())!.activeStatusRevision;
    await f.begin();
    await f.begin("two");
    await f.end();
    await f.end();
    expect((await f.current())!.activeStatusRevision).toBe(revision);
    await f.end("two");
    const ended = (await f.current())!.activeStatusRevision;
    await f.end("two");
    expect((await f.current())!.activeStatusId).toBe(f.free);
    expect((await f.current())!.activeStatusRevision).toBe(ended);
  });
  it("expires a lost source without ending another active call", async () => {
    const f = await fixture();
    await f.phone(true);
    await f.begin();
    await f.t.run(async (ctx) => {
      const source = (await ctx.db.query("presenceSources").collect()).find(
        (s) => s.kind === "telephone",
      )!;
      await ctx.db.patch("presenceSources", source._id, {
        expiresAt: Date.now() - 1,
      });
      await expirePresenceSource(ctx, f.userId, source.sourceKey);
    });
    expect((await f.current())!.activeStatusId).not.toBe(f.free);
    await f.phone(false);
    expect((await f.current())!.activeStatusId).not.toBe(f.free);
    await f.end();
    expect((await f.current())!.activeStatusId).toBe(f.free);
  });
  it("uses off if the baseline was deleted and never restores a foreign status", async () => {
    const f = await fixture();
    await f.begin();
    await f.t.run((ctx) => ctx.db.delete("statuses", f.free));
    await f.end();
    expect((await f.current())!.activeStatusId).toBeUndefined();
    const foreign = await f.t.run(async (ctx) => {
      const other = await ctx.db.insert("users", { name: "Other" });
      return ctx.db.insert("statuses", {
        userId: other,
        name: "Foreign",
        color: "#ffffff",
        icon: "star",
        order: 0,
      });
    });
    await f.t.run((ctx) =>
      setPresenceSource(ctx, f.userId, {
        sourceKey: "invalid",
        kind: "meeting",
        statusId: foreign,
        expiresAt: Date.now() + 1000,
      }),
    );
    expect((await f.current())!.activeStatusId).toBeUndefined();
  });
  it("expires foreground heartbeats and does not revive suppressed sources", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      setPresenceSource(ctx, f.userId, {
        sourceKey: "calendar",
        kind: "meeting",
        statusId: f.meeting,
        expiresAt: Date.now() + 1000,
      }),
    );
    await f.signed.mutation(api.statuses.setActive, { statusId: null });
    await f.t.run(async (ctx) => {
      const source = (await ctx.db.query("presenceSources").first())!;
      await ctx.db.patch("presenceSources", source._id, {
        expiresAt: Date.now() - 1,
      });
      await expirePresenceSource(ctx, f.userId, source.sourceKey);
    });
    expect((await f.current())!.activeStatusId).toBeUndefined();
    await f.t.run((ctx) => removePresenceSource(ctx, f.userId, "calendar"));
    expect((await f.current())!.activeStatusId).toBeUndefined();
  });
});
