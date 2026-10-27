import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";
import { api } from "./_generated/api";
import {
  dayBounds,
  localClock,
  permitsSlot,
  validateHours,
} from "./lib/teaviso_schedule";

const token = (char: string) => char.repeat(64);
async function fixture(paid = true) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    owner: await ctx.db.insert("users", { email: "owner@fixture.example" }),
    other: await ctx.db.insert("users", { email: "other@fixture.example" }),
  }));
  const me = t.withIdentity({ subject: `${ids.owner}|test` }),
    other = t.withIdentity({ subject: `${ids.other}|test` });
  const spaceId = await me.mutation(api.teaviso_spaces.create, {
    name: "Negocio de prueba",
    kind: "business",
    timezone: "America/Argentina/Buenos_Aires",
    phone: "5491112345678",
    consent: true,
  });
  const licenseId = await t.run(async (ctx) => {
    const features = {
      audio: true,
      video: true,
      chat: true,
      messages: true,
      families: true,
      buildings: true,
      offices: true,
      access: false,
      bookings: paid,
      templates: paid,
    };
    const limits = { maxSites: 3, maxQrs: 10, maxMembers: 10, maxUnits: 20 };
    const planId = await ctx.db.insert("timbrePlans", {
      code: "digital",
      name: "Fixture: sin tarifa comercial",
      description: "Prueba aislada",
      enabled: true,
      priceAmount: 100,
      currency: "ARS",
      period: "one_time",
      features,
      limits,
      sellerId: ids.owner,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return ctx.db.insert("timbreLicenses", {
      ownerId: ids.owner,
      planId,
      planName: "Fixture",
      status: "active",
      startsAt: Date.now() - 1000,
      source: "internal_trial",
      sourceReference: "isolated-test",
      features,
      limits,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  const s = await me.query(api.teaviso_spaces.get, { spaceId });
  const form = {
    spaceId,
    revision: s.revision,
    name: s.name,
    enabled: true,
    timezone: s.timezone,
    phone: s.phone ?? "",
    message: s.message,
    consent: true,
    schedule: s.schedule,
    bookingsEnabled: paid,
    portalEnabled: paid,
    autoConfirm: true,
    leadMinutes: 0,
    horizonDays: 30,
    cancelHours: 0,
    licenseId,
    timbreQrId: null,
    templates: paid
      ? [
          {
            id: "entrega",
            label: "Entrega",
            message: "Estoy en la entrada con una entrega.",
          },
        ]
      : [],
  };
  await me.mutation(api.teaviso_spaces.configure, form);
  const serviceId = await me.mutation(api.teaviso_spaces.saveService, {
    spaceId,
    name: "Corte de prueba",
    duration: 60,
    enabled: true,
  });
  const professionalId = await me.mutation(
    api.teaviso_spaces.saveProfessional,
    {
      spaceId,
      name: "Profesional de prueba",
      enabled: true,
      serviceIds: [serviceId],
    },
  );
  const current = await me.query(api.teaviso_spaces.get, { spaceId });
  const booking = {
    token: current.token,
    serviceId,
    professionalId,
    startsAt: Date.parse("2026-11-02T13:00:00Z"),
    name: "Visitante de prueba",
    contact: "visitante@fixture.example",
    manageToken: token("a"),
    requestKey: token("b"),
    nonce: token("c"),
    consent: true,
  };
  return {
    t,
    me,
    other,
    ids,
    spaceId,
    licenseId,
    serviceId,
    professionalId,
    current,
    booking,
    form: { ...form, revision: current.revision },
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe("Te Aviso: cuentas, prestaciones y reservas", () => {
  it("keeps owner data isolated, public contact scoped, and premium inaccessible to a basic license", async () => {
    const f = await fixture(false);
    await expect(
      f.other.query(api.teaviso_spaces.get, { spaceId: f.spaceId }),
    ).rejects.toThrow("acceso");
    expect(await f.other.query(api.teaviso_spaces.list, {})).toEqual([]);
    await expect(
      f.me.mutation(api.teaviso_spaces.configure, {
        ...f.form,
        bookingsEnabled: true,
      }),
    ).rejects.toThrow("licencia");
    const publicView = await f.t.query(api.teaviso_spaces.publicEntry, {
      token: f.current.token,
    });
    expect(publicView).toMatchObject({
      bookings: false,
      portal: false,
      services: [],
      templates: [],
    });
    expect(publicView).not.toHaveProperty("ownerId");
    expect(publicView).not.toHaveProperty("licenseId");
    await expect(
      f.t.mutation(api.teaviso_spaces.book, f.booking),
    ).rejects.toThrow("licencia");
  });
  it("keeps imported QR tokens stable and honors a pause in the original QR", async () => {
    const f = await fixture();
    const adopted = await f.me.mutation(api.teaviso_spaces.create, {
      name: "Adoptado",
      kind: "home",
      timezone: "UTC",
      consent: false,
      existingQrId: f.current.whatsappQrId,
    });
    expect(adopted).toBe(f.spaceId);
    await f.t.run((ctx) =>
      ctx.db.patch("teavisoWhatsappQrs", f.current.whatsappQrId!, {
        enabled: false,
      }),
    );
    expect(
      await f.t.query(api.teaviso_spaces.publicEntry, {
        token: f.current.token,
      }),
    ).toBeNull();
    await expect(
      f.t.mutation(api.teaviso_spaces.book, f.booking),
    ).rejects.toThrow("no está disponible");
  });
  it("rejects stale edits and a license or professional from another account", async () => {
    const f = await fixture();
    await f.me.mutation(api.teaviso_spaces.configure, {
      ...f.form,
      name: "Cambio",
    });
    await expect(
      f.me.mutation(api.teaviso_spaces.configure, f.form),
    ).rejects.toThrow("otra ventana");
    await expect(
      f.other.mutation(api.teaviso_spaces.saveProfessional, {
        spaceId: f.spaceId,
        name: "Intruso",
        enabled: true,
        serviceIds: [f.serviceId],
      }),
    ).rejects.toThrow("acceso");
    const otherId = await f.other.mutation(api.teaviso_spaces.create, {
      name: "Otro",
      kind: "business",
      timezone: "UTC",
      consent: false,
    });
    const row = await f.other.query(api.teaviso_spaces.get, {
      spaceId: otherId,
    });
    await expect(
      f.other.mutation(api.teaviso_spaces.configure, {
        ...f.form,
        spaceId: otherId,
        revision: row.revision,
      }),
    ).rejects.toThrow("tu cuenta");
  });
  it("rechecks occupancy including partial overlaps, keeps service snapshots, and has idempotent confirmation", async () => {
    const f = await fixture();
    const first = await f.t.mutation(api.teaviso_spaces.book, f.booking);
    expect(await f.t.mutation(api.teaviso_spaces.book, f.booking)).toEqual(
      first,
    );
    await expect(
      f.t.mutation(api.teaviso_spaces.book, {
        ...f.booking,
        requestKey: token("d"),
        manageToken: token("e"),
        startsAt: f.booking.startsAt + 30 * 60000,
      }),
    ).rejects.toThrow("reservó");
    await expect(
      f.t.mutation(api.teaviso_spaces.book, { ...f.booking, name: "Cambió" }),
    ).rejects.toThrow("ya fue usada");
    await f.me.mutation(api.teaviso_spaces.saveService, {
      spaceId: f.spaceId,
      id: f.serviceId,
      name: "Nombre actualizado",
      duration: 15,
      enabled: true,
    });
    const saved = await f.t.query(api.teaviso_spaces.booking, {
      id: first.id,
      manageToken: f.booking.manageToken,
    });
    expect(saved.serviceName).toBe("Corte de prueba");
    expect(saved.endsAt - saved.startsAt).toBe(3600000);
    expect(
      await f.me.query(api.teaviso_spaces.agenda, {
        spaceId: f.spaceId,
        from: Date.now(),
        to: Date.now() + 86400000,
      }),
    ).toHaveLength(1);
  });
  it("makes cancellation capability private and returns capacity after cancellation", async () => {
    const f = await fixture();
    const b = await f.t.mutation(api.teaviso_spaces.book, f.booking);
    await expect(
      f.t.query(api.teaviso_spaces.booking, {
        id: b.id,
        manageToken: token("d"),
      }),
    ).rejects.toThrow("no está disponible");
    await expect(
      f.other.mutation(api.teaviso_spaces.updateBooking, {
        id: b.id,
        status: "cancelled",
      }),
    ).rejects.toThrow("acceso");
    await f.t.mutation(api.teaviso_spaces.cancelBooking, {
      id: b.id,
      manageToken: f.booking.manageToken,
    });
    expect(
      (
        await f.t.query(api.teaviso_spaces.slots, {
          token: f.current.token,
          date: "2026-11-02",
          serviceId: f.serviceId,
        })
      ).some((s) => s.startsAt === f.booking.startsAt),
    ).toBe(true);
  });
  it("enforces hours, time blocks and staff membership before confirming", async () => {
    const f = await fixture();
    await f.me.mutation(api.teaviso_spaces.blockTime, {
      spaceId: f.spaceId,
      startsAt: f.booking.startsAt,
      endsAt: f.booking.startsAt + 7200000,
      note: "Bloqueado",
    });
    await expect(
      f.t.mutation(api.teaviso_spaces.book, f.booking),
    ).rejects.toThrow("reservó");
    await expect(
      f.t.mutation(api.teaviso_spaces.book, {
        ...f.booking,
        startsAt: Date.parse("2026-11-02T23:00:00Z"),
      }),
    ).rejects.toThrow("horario");
    await f.me.mutation(api.teaviso_spaces.saveProfessional, {
      spaceId: f.spaceId,
      id: f.professionalId,
      name: "Profesional",
      serviceIds: [f.serviceId],
      enabled: false,
    });
    expect(
      await f.t.query(api.teaviso_spaces.slots, {
        token: f.current.token,
        date: "2026-11-02",
        serviceId: f.serviceId,
      }),
    ).toEqual([]);
  });
  it("expires pending requests, releases their slot and prevents later confirmation", async () => {
    const f = await fixture();
    await f.me.mutation(api.teaviso_spaces.configure, {
      ...f.form,
      autoConfirm: false,
    });
    const b = await f.t.mutation(api.teaviso_spaces.book, f.booking);
    expect(b.status).toBe("pending");
    vi.setSystemTime(Date.now() + 31 * 60000);
    expect(
      (
        await f.t.query(api.teaviso_spaces.booking, {
          id: b.id,
          manageToken: f.booking.manageToken,
        })
      ).status,
    ).toBe("expired");
    await expect(
      f.me.mutation(api.teaviso_spaces.updateBooking, {
        id: b.id,
        status: "confirmed",
      }),
    ).rejects.toThrow("ya no");
    expect(
      (
        await f.t.query(api.teaviso_spaces.slots, {
          token: f.current.token,
          date: "2026-11-02",
          serviceId: f.serviceId,
        })
      ).some((s) => s.startsAt === f.booking.startsAt),
    ).toBe(true);
  });
  it("removes expired paid capabilities while retaining the basic QR and booking history", async () => {
    const f = await fixture();
    await f.t.mutation(api.teaviso_spaces.book, f.booking);
    await f.t.run((ctx) =>
      ctx.db.patch("timbreLicenses", f.licenseId, { status: "expired" }),
    );
    const entry = await f.t.query(api.teaviso_spaces.publicEntry, {
      token: f.current.token,
    });
    expect(entry).toMatchObject({
      bookings: false,
      portal: false,
      templates: [],
    });
    expect(entry?.whatsappUrl).toContain("wa.me");
    expect(
      await f.me.query(api.teaviso_spaces.agenda, {
        spaceId: f.spaceId,
        from: Date.now(),
        to: Date.now() + 86400000,
      }),
    ).toHaveLength(1);
  });
  it("records an explicit, deduplicated arrival without creating a fake call or exposing another account", async () => {
    const f = await fixture();
    const visit = {
      token: f.current.token,
      templateId: "entrega",
      nonce: token("a"),
    };
    await f.t.mutation(api.teaviso_spaces.recordVisit, visit);
    await f.t.mutation(api.teaviso_spaces.recordVisit, visit);
    const rows = await f.me.query(api.teaviso_spaces.visits, {
      spaceId: f.spaceId,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("nonceHash");
    await expect(
      f.other.query(api.teaviso_spaces.visits, { spaceId: f.spaceId }),
    ).rejects.toThrow("acceso");
    await expect(
      f.t.mutation(api.teaviso_spaces.recordVisit, {
        ...visit,
        templateId: "inventado",
      }),
    ).rejects.toThrow("Elegí");
    expect(
      await f.t.run((ctx) => ctx.db.query("timbreCalls").collect()),
    ).toEqual([]);
  });
  it("never lets a file identifier claim another user's logo", async () => {
    const f = await fixture();
    const storageId = await f.t.run((ctx) =>
      ctx.storage.store(new Blob(["fixture"], { type: "image/png" })),
    );
    await expect(
      f.me.mutation(api.teaviso_spaces.registerImage, { storageId }),
    ).rejects.toThrow("no pertenece");
  });
});
describe("Te Aviso: integración con timbre y contratos", () => {
  it("counts a linked calendar and doorbell as one location and blocks unpaired quota bypass", async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      const l = await ctx.db.get("timbreLicenses", f.licenseId);
      await ctx.db.patch("timbreLicenses", f.licenseId, {
        limits: { ...l!.limits, maxSites: 1 },
      });
    });
    await expect(
      f.me.mutation(api.timbre.createSite, {
        name: "Extra",
        kind: "home",
        timezone: "UTC",
        licenseId: f.licenseId,
      }),
    ).rejects.toThrow("límite");
    const siteId = await f.me.mutation(api.timbre.createSite, {
      name: "Entrada",
      kind: "home",
      timezone: f.current.timezone,
      licenseId: f.licenseId,
      teavisoSpaceId: f.spaceId,
    });
    const qrId = await f.me.mutation(api.timbre.createQr, {
      siteId,
      label: "Principal",
    });
    expect(
      (await f.me.query(api.teaviso_spaces.get, { spaceId: f.spaceId }))
        .timbreQrId,
    ).toBe(qrId);
    expect(
      (
        await f.t.query(api.teaviso_spaces.publicEntry, {
          token: f.current.token,
        })
      )?.callToken,
    ).toBeTruthy();
    await expect(
      f.me.mutation(api.timbre.createSite, {
        name: "Otro",
        kind: "home",
        timezone: "UTC",
        licenseId: f.licenseId,
      }),
    ).rejects.toThrow("límite");
  });
  it("carries only a configured and paid portal reason into an actual call", async () => {
    const f = await fixture();
    const siteId = await f.me.mutation(api.timbre.createSite, {
      name: "Entrada",
      kind: "home",
      timezone: f.current.timezone,
      licenseId: f.licenseId,
      teavisoSpaceId: f.spaceId,
    });
    const qrId = await f.me.mutation(api.timbre.createQr, {
      siteId,
      label: "Principal",
    });
    const qr = await f.t.run((ctx) => ctx.db.get("timbreQrs", qrId));
    const args = {
      qrToken: qr!.token,
      mode: "chat" as const,
      visitorNonce: token("a"),
      portalToken: f.current.token,
      templateId: "entrega",
    };
    await expect(
      f.t.mutation(api.timbre_calls.startCall, {
        ...args,
        portalToken: token("f"),
      }),
    ).rejects.toThrow("motivo");
    const result = await f.t.mutation(api.timbre_calls.startCall, args);
    const incoming = await f.me.query(api.timbre_calls.incoming, {});
    expect(incoming[0]).toMatchObject({
      callId: result.callId,
      visitorLabel: "Entrega",
      visitorMessage: "Estoy en la entrada con una entrega.",
    });
    const row = await f.t.run((ctx) =>
      ctx.db.get("timbreCalls", result.callId),
    );
    expect(row?.visitorMessage).toBe("Estoy en la entrada con una entrega.");
  });
  it("preserves purchased premium flags when an older VISO client edits an existing plan", async () => {
    const f = await fixture();
    vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", f.ids.owner);
    const plan = await f.t.run(async (ctx) => {
      const l = await ctx.db.get("timbreLicenses", f.licenseId);
      return ctx.db.get("timbrePlans", l!.planId);
    });
    const { bookings, templates, ...oldFeatures } = plan!.features;
    void bookings;
    void templates;
    await f.me.mutation(api.timbre_commerce.savePlan, {
      id: plan!._id,
      code: plan!.code,
      name: plan!.name,
      description: plan!.description,
      enabled: true,
      priceAmount: 100,
      currency: "ARS",
      period: "one_time",
      features: oldFeatures,
      limits: plan!.limits,
    });
    const changed = await f.t.run((ctx) =>
      ctx.db.get("timbrePlans", plan!._id),
    );
    expect(changed!.features).toMatchObject({
      bookings: true,
      templates: true,
    });
  });
  it("reprograms atomically and leaves the original reservation intact on an occupied target", async () => {
    const f = await fixture();
    const b = await f.t.mutation(api.teaviso_spaces.book, f.booking);
    const occupied = f.booking.startsAt + 2 * 3600000;
    await f.t.mutation(api.teaviso_spaces.book, {
      ...f.booking,
      startsAt: occupied,
      manageToken: token("e"),
      requestKey: token("f"),
    });
    await expect(
      f.me.mutation(api.teaviso_spaces.reschedule, {
        id: b.id,
        professionalId: f.professionalId,
        startsAt: occupied,
      }),
    ).rejects.toThrow("no está disponible");
    expect(
      (
        await f.t.query(api.teaviso_spaces.booking, {
          id: b.id,
          manageToken: f.booking.manageToken,
        })
      ).startsAt,
    ).toBe(f.booking.startsAt);
    await f.me.mutation(api.teaviso_spaces.reschedule, {
      id: b.id,
      professionalId: f.professionalId,
      startsAt: occupied + 3600000,
    });
    expect(
      (
        await f.t.query(api.teaviso_spaces.booking, {
          id: b.id,
          manageToken: f.booking.manageToken,
        })
      ).startsAt,
    ).toBe(occupied + 3600000);
  });
});
describe("Te Aviso: fechas locales", () => {
  it("validates dates and overlapping hours", () => {
    expect(() => dayBounds("2026-02-31")).toThrow();
    expect(() =>
      validateHours([
        { day: 1, start: 540, end: 660 },
        { day: 1, start: 600, end: 700 },
      ]),
    ).toThrow();
  });
  it("uses the business timezone, including DST, instead of the visitor's browser timezone", () => {
    const config = {
      timezone: "America/New_York",
      schedule: [{ day: 0, start: 60, end: 240 }],
      leadMinutes: 0,
      horizonDays: 30,
    };
    const now = Date.parse("2026-03-07T00:00:00Z");
    expect(
      localClock(config.timezone)(Date.parse("2026-03-08T07:00:00Z")),
    ).toMatchObject({ date: "2026-03-08", minute: 180 });
    expect(
      permitsSlot(config, Date.parse("2026-03-08T07:00:00Z"), 30, now),
    ).toBe(true);
    expect(
      permitsSlot(config, Date.parse("2026-03-08T08:00:00Z"), 30, now),
    ).toBe(false);
  });
});
