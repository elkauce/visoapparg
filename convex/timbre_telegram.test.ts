import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

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
const limits = { maxSites: 2, maxQrs: 4, maxMembers: 4, maxUnits: 4 };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-10-19T15:00:00Z"));
});
afterEach(() => vi.useRealTimers());

async function fixture(kind: "home" | "building" | "office" = "home") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      email: "owner@example.test",
      phone: "PRIVATE_PHONE",
    });
    const managerId = await ctx.db.insert("users", {
      email: "manager@example.test",
    });
    const residentId = await ctx.db.insert("users", {
      email: "resident@example.test",
    });
    const strangerId = await ctx.db.insert("users", {
      email: "stranger@example.test",
    });
    const planId = await ctx.db.insert("timbrePlans", {
      code: "digital",
      name: "Test",
      description: "Synthetic test plan",
      enabled: true,
      currency: "ARS",
      period: "monthly",
      features,
      limits,
      sellerId: ownerId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const licenseId = await ctx.db.insert("timbreLicenses", {
      ownerId,
      planId,
      planName: "Test",
      status: "active",
      startsAt: Date.now() - 1000,
      expiresAt: Date.now() + 86_400_000,
      source: "building_contract",
      sourceReference: "synthetic",
      features,
      limits,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { ownerId, managerId, residentId, strangerId, licenseId };
  });
  const owner = t.withIdentity({ subject: `${ids.ownerId}|session` });
  const manager = t.withIdentity({ subject: `${ids.managerId}|session` });
  const resident = t.withIdentity({ subject: `${ids.residentId}|session` });
  const stranger = t.withIdentity({ subject: `${ids.strangerId}|session` });
  const siteId = await owner.mutation(api.timbre.createSite, {
    name: "Test Timbre",
    kind,
    licenseId: ids.licenseId,
    timezone: "America/Argentina/Buenos_Aires",
  });
  await t.run(async (ctx) => {
    for (const [userId, role] of [
      [ids.managerId, "manager"],
      [ids.residentId, "resident"],
    ] as const) {
      await ctx.db.insert("timbreMembers", {
        siteId,
        userId,
        role,
        unitIds: [],
        canReceive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  });
  const qrId = await owner.mutation(api.timbre.createQr, {
    siteId,
    label: "Door",
  });
  const qrToken = (await owner.query(api.timbre.listQrs, { siteId }))[0].token;
  const contact = (unitId?: Id<"timbreUnits">) =>
    t.query(api.timbre_telegram.publicContact, {
      qrToken,
      ...(unitId ? { unitId } : {}),
    });
  return {
    t,
    owner,
    manager,
    resident,
    stranger,
    siteId,
    qrId,
    qrToken,
    contact,
    ...ids,
  };
}

describe("optional direct Telegram contact", () => {
  it("is disabled by default and an explicit manager save returns only the public alias/link", async () => {
    const f = await fixture();
    expect(await f.contact()).toBeNull();
    expect(
      await f.manager.mutation(api.timbre_telegram.saveContact, {
        siteId: f.siteId,
        username: "https://t.me/Viso_Main",
      }),
    ).toEqual({ username: "viso_main", url: "https://t.me/viso_main" });
    expect(await f.contact()).toEqual({
      username: "viso_main",
      url: "https://t.me/viso_main",
    });
    const publicView = await f.t.query(api.timbre.publicQr, {
      qrToken: f.qrToken,
    });
    expect(publicView).not.toHaveProperty("telegramUsername");
    expect(JSON.stringify(await f.contact())).not.toMatch(
      /PRIVATE_PHONE|ownerId|licenseId|email/,
    );
    const data = await f.t.run(async (ctx) => ({
      calls: await ctx.db.query("timbreCalls").collect(),
      deliveries: await ctx.db.query("timbrePushDeliveries").collect(),
      licenses: await ctx.db.query("timbreLicenses").collect(),
      orders: await ctx.db.query("marketplaceOrders").collect(),
      audit: await ctx.db
        .query("timbreAuditEvents")
        .withIndex("by_site_created", (q) => q.eq("siteId", f.siteId))
        .collect(),
    }));
    expect(data.calls).toEqual([]);
    expect(data.deliveries).toEqual([]);
    expect(data.orders).toEqual([]);
    expect(data.licenses).toHaveLength(1);
    expect(
      data.audit.filter((event) => event.action === "telegram.contact_updated"),
    ).toHaveLength(1);
  });

  it("requires owner/manager authorization, validates before patching, and does not verify or call a provider", async () => {
    const f = await fixture();
    const input = { siteId: f.siteId, username: "viso_main" };
    await expect(
      f.t.mutation(api.timbre_telegram.saveContact, input),
    ).rejects.toThrow(/iniciar sesión/);
    await expect(
      f.stranger.mutation(api.timbre_telegram.saveContact, input),
    ).rejects.toThrow(/permiso/);
    await expect(
      f.resident.mutation(api.timbre_telegram.saveContact, input),
    ).rejects.toThrow(/permiso/);
    await f.owner.mutation(api.timbre_telegram.saveContact, input);
    await expect(
      f.owner.mutation(api.timbre_telegram.saveContact, {
        siteId: f.siteId,
        username: "+5491112345678",
      }),
    ).rejects.toThrow(/usuario de Telegram/);
    expect(await f.contact()).toMatchObject({ username: "viso_main" });
  });

  it("requires an active call entitlement to enable, while clearing remains possible after expiration", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.patch("timbreLicenses", f.licenseId, {
        features: { ...features, audio: false, video: false },
      }),
    );
    await expect(
      f.owner.mutation(api.timbre_telegram.saveContact, {
        siteId: f.siteId,
        username: "viso_main",
      }),
    ).rejects.toThrow(/licencia.*llamadas/);
    await f.t.run((ctx) =>
      ctx.db.patch("timbreLicenses", f.licenseId, { features }),
    );
    await f.owner.mutation(api.timbre_telegram.saveContact, {
      siteId: f.siteId,
      username: "viso_main",
    });
    await f.t.run((ctx) =>
      ctx.db.patch("timbreLicenses", f.licenseId, { expiresAt: Date.now() }),
    );
    expect(await f.contact()).toBeNull();
    await expect(
      f.owner.mutation(api.timbre_telegram.saveContact, {
        siteId: f.siteId,
        username: "other_user",
      }),
    ).rejects.toThrow(/licencia/);
    expect(
      await f.owner.mutation(api.timbre_telegram.saveContact, {
        siteId: f.siteId,
        username: null,
      }),
    ).toEqual({ username: null, url: null });
    expect(
      (await f.t.run((ctx) => ctx.db.get("timbreSites", f.siteId)))
        ?.telegramUsername,
    ).toBeUndefined();
  });

  it("respects silence, local schedule, disabled sites, revoked QRs and removal immediately", async () => {
    const f = await fixture();
    await f.owner.mutation(api.timbre_telegram.saveContact, {
      siteId: f.siteId,
      username: "viso_main",
    });
    await f.owner.mutation(api.timbre.saveSiteSettings, {
      siteId: f.siteId,
      mutedUntil: Date.now() + 10000,
    });
    expect(await f.contact()).toBeNull();
    await f.owner.mutation(api.timbre.saveSiteSettings, {
      siteId: f.siteId,
      mutedUntil: null,
      schedule: [{ day: 1, start: "09:00", end: "11:00" }],
    });
    expect(await f.contact()).toBeNull();
    await f.owner.mutation(api.timbre.saveSiteSettings, {
      siteId: f.siteId,
      schedule: [],
      enabled: false,
    });
    expect(await f.contact()).toBeNull();
    await f.owner.mutation(api.timbre.saveSiteSettings, {
      siteId: f.siteId,
      enabled: true,
    });
    expect(await f.contact()).not.toBeNull();
    await f.owner.mutation(api.timbre_telegram.saveContact, {
      siteId: f.siteId,
      username: null,
    });
    expect(await f.contact()).toBeNull();
    await f.owner.mutation(api.timbre_telegram.saveContact, {
      siteId: f.siteId,
      username: "viso_main",
    });
    await f.owner.mutation(api.timbre.revokeQr, { qrId: f.qrId });
    expect(await f.contact()).toBeNull();
    expect(
      await f.t.query(api.timbre_telegram.publicContact, {
        qrToken: "not-a-qr",
      }),
    ).toBeNull();
  });

  it("does not alter native settings and can serve Telegram while the owner disables native channels", async () => {
    const f = await fixture();
    await f.owner.mutation(api.timbre_telegram.saveContact, {
      siteId: f.siteId,
      username: "viso_main",
    });
    await f.owner.mutation(api.timbre.saveSiteSettings, {
      siteId: f.siteId,
      name: "Renamed",
      allowedAudio: false,
      allowedVideo: false,
    });
    expect(await f.contact()).toMatchObject({ username: "viso_main" });
    expect(
      (await f.t.query(api.timbre.publicQr, { qrToken: f.qrToken }))
        ?.audioEnabled,
    ).toBe(false);
    const stored = await f.t.run((ctx) => ctx.db.get("timbreSites", f.siteId));
    expect(stored).toMatchObject({
      name: "Renamed",
      telegramUsername: "viso_main",
      allowedAudio: false,
      allowedVideo: false,
    });
    await f.t.run((ctx) =>
      ctx.db.patch("timbreLicenses", f.licenseId, {
        features: { ...features, audio: false, video: false },
      }),
    );
    expect(await f.contact()).toBeNull();
    await f.owner.mutation(api.timbre_telegram.saveContact, {
      siteId: f.siteId,
      username: null,
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get("timbreSites", f.siteId)))
        ?.allowedAudio,
    ).toBe(false);
  });

  it.each(["building", "office"] as const)(
    "isolates %s unit aliases, QR bindings and disabled units without falling back to the site",
    async (kind) => {
      const f = await fixture(kind);
      const unit1 = await f.owner.mutation(api.timbre.createUnit, {
        siteId: f.siteId,
        name: "A",
      });
      const unit2 = await f.owner.mutation(api.timbre.createUnit, {
        siteId: f.siteId,
        name: "B",
      });
      await expect(
        f.owner.mutation(api.timbre_telegram.saveContact, {
          siteId: f.siteId,
          username: "general_user",
        }),
      ).rejects.toThrow(/unidad correspondiente/);
      // A contact left over from a formerly unitless office never routes a unit.
      await f.t.run((ctx) =>
        ctx.db.patch("timbreSites", f.siteId, {
          telegramUsername: "legacy_site",
        }),
      );
      expect(await f.contact()).toBeNull();
      expect(await f.contact(unit1)).toBeNull();
      await f.owner.mutation(api.timbre_telegram.saveContact, {
        siteId: f.siteId,
        unitId: unit1,
        username: "unit_a_user",
      });
      await f.owner.mutation(api.timbre_telegram.saveContact, {
        siteId: f.siteId,
        unitId: unit2,
        username: "unit_b_user",
      });
      expect(await f.contact(unit1)).toMatchObject({ username: "unit_a_user" });
      expect(await f.contact(unit2)).toMatchObject({ username: "unit_b_user" });
      const unitQrId = await f.owner.mutation(api.timbre.createQr, {
        siteId: f.siteId,
        label: "A",
        unitId: unit1,
      });
      const unitToken = (
        await f.owner.query(api.timbre.listQrs, { siteId: f.siteId })
      ).find((qr) => qr._id === unitQrId)!.token;
      expect(
        await f.t.query(api.timbre_telegram.publicContact, {
          qrToken: unitToken,
        }),
      ).toMatchObject({ username: "unit_a_user" });
      expect(
        await f.t.query(api.timbre_telegram.publicContact, {
          qrToken: unitToken,
          unitId: unit2,
        }),
      ).toBeNull();
      const otherSiteId = await f.owner.mutation(api.timbre.createSite, {
        name: "Other",
        kind,
        licenseId: f.licenseId,
        timezone: "UTC",
      });
      const foreignUnit = await f.owner.mutation(api.timbre.createUnit, {
        siteId: otherSiteId,
        name: "Foreign",
      });
      await expect(
        f.owner.mutation(api.timbre_telegram.saveContact, {
          siteId: f.siteId,
          unitId: foreignUnit,
          username: "other_user",
        }),
      ).rejects.toThrow(/unidad/);
      expect(await f.contact(foreignUnit)).toBeNull();
      await f.owner.mutation(api.timbre.saveUnit, {
        unitId: unit1,
        enabled: false,
      });
      expect(await f.contact(unit1)).toBeNull();
      await expect(
        f.owner.mutation(api.timbre_telegram.saveContact, {
          siteId: f.siteId,
          unitId: unit1,
          username: "other_user",
        }),
      ).rejects.toThrow(/Habilitá/);
      await f.owner.mutation(api.timbre_telegram.saveContact, {
        siteId: f.siteId,
        unitId: unit1,
        username: null,
      });
      await f.owner.mutation(api.timbre_telegram.saveContact, {
        siteId: f.siteId,
        username: null,
      });
      expect(await f.contact(unit2)).toMatchObject({ username: "unit_b_user" });
    },
  );

  it("supports a general office contact only while no enabled units require routing", async () => {
    const f = await fixture("office");
    await f.owner.mutation(api.timbre_telegram.saveContact, {
      siteId: f.siteId,
      username: "front_desk",
    });
    expect(await f.contact()).toMatchObject({ username: "front_desk" });
    const unit = await f.owner.mutation(api.timbre.createUnit, {
      siteId: f.siteId,
      name: "Office",
    });
    expect(await f.contact()).toBeNull();
    await f.owner.mutation(api.timbre.saveUnit, {
      unitId: unit,
      enabled: false,
    });
    expect(await f.contact()).toMatchObject({ username: "front_desk" });
  });
});
