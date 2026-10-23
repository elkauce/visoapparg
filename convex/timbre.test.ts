import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { getTimbreAvailability, validateTimbreSchedule, validateStoredTimbreDesign } from "./lib/timbre_access";

const features = { audio: true, video: true, chat: true, messages: true, families: true, buildings: true, offices: true, access: false };
const limits = { maxSites: 2, maxQrs: 2, maxMembers: 4, maxUnits: 2 };
const design = { title: "Timbre VISO", streetNumber: "123", familyName: "", businessName: "", unit: "",
  legend: "Escaneá para comunicarte", backgroundColor: "#F5F3EF", textColor: "#17191D", qrColor: "#17191D", qrBackground: "#FFFFFF",
  font: "sans" as const, emblem: "bell" as const, widthMm: 90, heightMm: 130, bleedMm: 3 };
const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZwAAAABJRU5ErkJggg==";

async function fixture(kind: "home" | "building" | "office" = "home") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test", emailVerificationTime: Date.now(), phone: "PRIVATE_PHONE" });
    const strangerId = await ctx.db.insert("users", { email: "stranger@example.test", emailVerificationTime: Date.now() });
    const residentId = await ctx.db.insert("users", { email: "resident@example.test", emailVerificationTime: Date.now() });
    const planId = await ctx.db.insert("timbrePlans", { code: "digital", name: "Plan de prueba", description: "Configuración de prueba",
      enabled: true, currency: "ARS", period: "monthly", features, limits, sellerId: ownerId, createdAt: Date.now(), updatedAt: Date.now() });
    const licenseId = await ctx.db.insert("timbreLicenses", { ownerId, planId, planName: "Plan de prueba", status: "active", startsAt: Date.now() - 1000,
      expiresAt: Date.now() + 3600_000, source: "building_contract", sourceReference: "test-contract", features, limits, createdAt: Date.now(), updatedAt: Date.now() });
    return { ownerId, strangerId, residentId, planId, licenseId };
  });
  const owner = t.withIdentity({ subject: `${ids.ownerId}|owner` });
  const stranger = t.withIdentity({ subject: `${ids.strangerId}|stranger` });
  const resident = t.withIdentity({ subject: `${ids.residentId}|resident` });
  const siteId = await owner.mutation(api.timbre.createSite, { name: "Mi Timbre", kind, licenseId: ids.licenseId, timezone: "America/Argentina/Buenos_Aires" });
  return { t, owner, stranger, resident, siteId, ...ids };
}

describe("Timbre account, license and public QR boundaries", () => {
  it("does not grant a service to an existing account, another license owner or any inactive license", async () => {
    const f = await fixture();
    await expect(f.t.query(api.timbre.workspace, {})).rejects.toThrow(/iniciar sesión/);
    expect(await f.stranger.query(api.timbre.workspace, {})).toEqual({ sites: [], memberships: [] });
    await expect(f.stranger.mutation(api.timbre.createSite, { name: "Ajeno", kind: "home", licenseId: f.licenseId, timezone: "UTC" })).rejects.toThrow(/licencia/);
    for (const status of ["pending_payment", "past_due", "suspended", "expired", "revoked"] as const) {
      await f.t.run((ctx) => ctx.db.patch("timbreLicenses", f.licenseId, { status }));
      await expect(f.owner.mutation(api.timbre.createQr, { siteId: f.siteId, label: "Entrada" })).rejects.toThrow(/licencia/);
    }
    await f.t.run((ctx) => ctx.db.patch("timbreLicenses", f.licenseId, { status: "active", startsAt: Date.now() + 100_000 }));
    await expect(f.owner.mutation(api.timbre.createQr, { siteId: f.siteId, label: "Entrada" })).rejects.toThrow(/licencia/);
  });

  it("restricts site management and public output, and disabling keeps the same printed token", async () => {
    const f = await fixture();
    const qrId = await f.owner.mutation(api.timbre.createQr, { siteId: f.siteId, label: "Puerta principal" });
    const qr = (await f.owner.query(api.timbre.listQrs, { siteId: f.siteId }))[0];
    expect(qr.token).toMatch(/^[a-f0-9]{64}$/);
    const visible = await f.t.query(api.timbre.publicQr, { qrToken: qr.token });
    expect(visible).toMatchObject({ label: "Puerta principal", siteName: "Mi Timbre", audioEnabled: true, available: true });
    expect(JSON.stringify(visible)).not.toMatch(/PRIVATE_PHONE|owner@example|ownerId|licenseId|recipientIds|token/);
    await expect(f.stranger.mutation(api.timbre.saveSiteSettings, { siteId: f.siteId, name: "No" })).rejects.toThrow(/permiso/);
    await expect(f.stranger.query(api.timbre.listQrs, { siteId: f.siteId })).rejects.toThrow(/permiso/);
    await f.owner.mutation(api.timbre.saveSiteSettings, { siteId: f.siteId, enabled: false });
    expect(await f.t.query(api.timbre.publicQr, { qrToken: qr.token })).toBeNull();
    await f.owner.mutation(api.timbre.saveSiteSettings, { siteId: f.siteId, enabled: true });
    expect((await f.owner.query(api.timbre.listQrs, { siteId: f.siteId }))[0]._id).toBe(qrId);
    expect((await f.owner.query(api.timbre.listQrs, { siteId: f.siteId }))[0].token).toBe(qr.token);
    expect((await f.t.query(api.timbre.publicQr, { qrToken: qr.token }))?.available).toBe(true);
  });

  it("makes rotation and revocation effective immediately and gates printable exports", async () => {
    const f = await fixture();
    const qrId = await f.owner.mutation(api.timbre.createQr, { siteId: f.siteId, label: "Entrada" });
    const old = (await f.owner.query(api.timbre.listQrs, { siteId: f.siteId }))[0].token;
    const token = await f.owner.mutation(api.timbre.rotateQr, { qrId });
    expect(token).not.toBe(old);
    expect(await f.t.query(api.timbre.publicQr, { qrToken: old })).toBeNull();
    await f.owner.mutation(api.timbre.saveQrDesign, { qrId, design });
    expect(await f.owner.query(api.timbre.qrForExport, { qrId })).toMatchObject({ quietZoneModules: 4, errorCorrection: "H", qr: { design } });
    await f.t.run((ctx) => ctx.db.patch("timbreLicenses", f.licenseId, { expiresAt: Date.now() - 1 }));
    expect(await f.t.query(api.timbre.publicQr, { qrToken: token })).toBeNull();
    await expect(f.owner.query(api.timbre.qrForExport, { qrId })).rejects.toThrow(/licencia/);
    await f.owner.mutation(api.timbre.revokeQr, { qrId });
    expect(await f.t.query(api.timbre.publicQr, { qrToken: token })).toBeNull();
    await expect(f.owner.mutation(api.timbre.saveQr, { qrId, enabled: true })).rejects.toThrow(/revocado/);
  });
  it("isolates image payloads from the QR list and preserves the complete selected design", async () => {
    const f = await fixture();
    const qrId = await f.owner.mutation(api.timbre.createQr, { siteId: f.siteId, label: "Marca" });
    await f.owner.mutation(api.timbre.saveQrDesign, { qrId, design: { ...design, imageDataUrl: tinyPng } });
    const list = await f.owner.query(api.timbre.listQrs, { siteId: f.siteId });
    expect(list[0].design?.title).toBe(design.title);
    expect(list[0].design?.imageDataUrl).toBeUndefined();
    expect(JSON.stringify(list)).not.toContain("data:image");
    expect((await f.owner.query(api.timbre.qrForExport, { qrId })).qr.design?.imageDataUrl).toBe(tinyPng);
    await expect(f.stranger.query(api.timbre.qrForExport, { qrId })).rejects.toThrow(/permiso/);
    await f.owner.mutation(api.timbre.saveQrDesign, { qrId, design });
    expect((await f.owner.query(api.timbre.qrForExport, { qrId })).qr.design?.imageDataUrl).toBeUndefined();
  });

  it("enforces license features and quotas while revoked QRs release capacity", async () => {
    const f = await fixture();
    const first = await f.owner.mutation(api.timbre.createQr, { siteId: f.siteId, label: "1" });
    await f.owner.mutation(api.timbre.createQr, { siteId: f.siteId, label: "2" });
    await expect(f.owner.mutation(api.timbre.createQr, { siteId: f.siteId, label: "3" })).rejects.toThrow(/límite/);
    await f.owner.mutation(api.timbre.revokeQr, { qrId: first });
    await f.owner.mutation(api.timbre.createQr, { siteId: f.siteId, label: "3" });
    await f.t.run((ctx) => ctx.db.patch("timbreLicenses", f.licenseId, { features: { ...features, video: false, buildings: false, offices: false } }));
    await expect(f.owner.mutation(api.timbre.saveSiteSettings, { siteId: f.siteId, allowedVideo: true })).rejects.toThrow(/incluida/);
    await expect(f.owner.mutation(api.timbre.createSite, { name: "Edificio", kind: "building", licenseId: f.licenseId, timezone: "UTC" })).rejects.toThrow(/edificios/);
    await f.owner.mutation(api.timbre.createSite, { name: "Segunda", kind: "home", licenseId: f.licenseId, timezone: "UTC" });
    await expect(f.owner.mutation(api.timbre.createSite, { name: "Tercera", kind: "home", licenseId: f.licenseId, timezone: "UTC" })).rejects.toThrow(/límite/);
  });
  it("preserves the printed QR on paid renewal while rejecting an undersized or foreign license", async () => {
    const f = await fixture();
    await f.owner.mutation(api.timbre.createQr, { siteId: f.siteId, label: "1" });
    await f.owner.mutation(api.timbre.createQr, { siteId: f.siteId, label: "2" });
    const token = (await f.owner.query(api.timbre.listQrs, { siteId: f.siteId }))[0].token;
    const next = await f.t.run(async (ctx) => {
      const old = (await ctx.db.get("timbreLicenses", f.licenseId))!;
      const { _id, _creationTime, ...snapshot } = old; void _id; void _creationTime;
      await ctx.db.patch("timbreLicenses", f.licenseId, { status: "expired" });
      return await ctx.db.insert("timbreLicenses", { ...snapshot, sourceReference: "renewal-test", limits: { ...limits, maxQrs: 1 } });
    });
    await expect(f.owner.mutation(api.timbre.changeSiteLicense, { siteId: f.siteId, licenseId: next })).rejects.toThrow(/no alcanza/);
    await f.t.run((ctx) => ctx.db.patch("timbreLicenses", next, { limits }));
    await expect(f.stranger.mutation(api.timbre.changeSiteLicense, { siteId: f.siteId, licenseId: next })).rejects.toThrow(/permiso/);
    await f.owner.mutation(api.timbre.changeSiteLicense, { siteId: f.siteId, licenseId: next });
    expect((await f.t.query(api.timbre.publicQr, { qrToken: token }))?.available).toBe(true);
    expect((await f.owner.query(api.timbre.listQrs, { siteId: f.siteId }))[0].token).toBe(token);
  });
});

describe("Timbre units, recipients and invitations", () => {
  it("exposes only enabled unit labels publicly and rejects a unit belonging to another site", async () => {
    const f = await fixture("building");
    const unitId = await f.owner.mutation(api.timbre.createUnit, { siteId: f.siteId, name: "1 A" });
    const second = await f.owner.mutation(api.timbre.createUnit, { siteId: f.siteId, name: "1 B" });
    await expect(f.owner.mutation(api.timbre.createUnit, { siteId: f.siteId, name: "1 C" })).rejects.toThrow(/límite/);
    await f.owner.mutation(api.timbre.saveUnit, { unitId: second, enabled: false });
    await f.owner.mutation(api.timbre.createQr, { siteId: f.siteId, label: "Edificio" });
    const token = (await f.owner.query(api.timbre.listQrs, { siteId: f.siteId }))[0].token;
    expect((await f.t.query(api.timbre.publicQr, { qrToken: token }))?.units).toEqual([{ id: unitId, name: "1 A" }]);
    const site2 = await f.owner.mutation(api.timbre.createSite, { name: "Otra", kind: "building", licenseId: f.licenseId, timezone: "UTC" });
    await expect(f.owner.mutation(api.timbre.createQr, { siteId: site2, label: "Ajena", unitId })).rejects.toThrow(/unidad/);
  });

  it("stores invitation hashes only, binds verified email, expires/revokes and consumes once", async () => {
    const f = await fixture();
    const invite = await f.owner.mutation(api.timbre.createInvite, { siteId: f.siteId, role: "resident", email: "resident@example.test" });
    const stored = await f.t.run((ctx) => ctx.db.get("timbreInvitations", invite.invitationId));
    expect(stored?.tokenHash).not.toBe(invite.token);
    expect(JSON.stringify(await f.owner.query(api.timbre.listInvites, { siteId: f.siteId }))).not.toContain("tokenHash");
    await expect(f.stranger.mutation(api.timbre.acceptInvite, { token: invite.token })).rejects.toThrow(/correo verificado/);
    await f.t.run((ctx) => ctx.db.patch("users", f.residentId, { emailVerificationTime: undefined }));
    await expect(f.resident.mutation(api.timbre.acceptInvite, { token: invite.token })).rejects.toThrow(/correo verificado/);
    await f.t.run((ctx) => ctx.db.patch("users", f.residentId, { emailVerificationTime: Date.now() }));
    expect(await f.resident.mutation(api.timbre.acceptInvite, { token: invite.token })).toBe(f.siteId);
    await expect(f.resident.mutation(api.timbre.acceptInvite, { token: invite.token })).rejects.toThrow(/válida o venció/);
    const expires = await f.owner.mutation(api.timbre.createInvite, { siteId: f.siteId, role: "resident" });
    await f.t.run((ctx) => ctx.db.patch("timbreInvitations", expires.invitationId, { expiresAt: Date.now() - 1 }));
    await expect(f.stranger.mutation(api.timbre.acceptInvite, { token: expires.token })).rejects.toThrow(/válida o venció/);
    const revoked = await f.owner.mutation(api.timbre.createInvite, { siteId: f.siteId, role: "resident" });
    await f.owner.mutation(api.timbre.revokeInvite, { invitationId: revoked.invitationId });
    await expect(f.stranger.mutation(api.timbre.acceptInvite, { token: revoked.token })).rejects.toThrow(/válida o venció/);
  });

  it("requires current unit membership for recipients and prunes removed members everywhere", async () => {
    const f = await fixture("building");
    const unit1 = await f.owner.mutation(api.timbre.createUnit, { siteId: f.siteId, name: "1" });
    const unit2 = await f.owner.mutation(api.timbre.createUnit, { siteId: f.siteId, name: "2" });
    const invite = await f.owner.mutation(api.timbre.createInvite, { siteId: f.siteId, role: "resident", unitIds: [unit1] });
    await f.resident.mutation(api.timbre.acceptInvite, { token: invite.token });
    await expect(f.owner.mutation(api.timbre.saveUnit, { unitId: unit2, recipientIds: [f.residentId] })).rejects.toThrow(/destinatario/);
    await f.owner.mutation(api.timbre.saveUnit, { unitId: unit1, recipientIds: [f.residentId] });
    await f.owner.mutation(api.timbre.saveSiteSettings, { siteId: f.siteId, recipientIds: [f.residentId], fallbackRecipientIds: [f.residentId] });
    await expect(f.owner.mutation(api.timbre.saveSiteSettings, { siteId: f.siteId, recipientIds: [f.strangerId] })).rejects.toThrow(/destinatario/);
    const member = (await f.owner.query(api.timbre.listMembers, { siteId: f.siteId })).find((row) => row.userId === f.residentId)!;
    await expect(f.resident.mutation(api.timbre.saveSiteSettings, { siteId: f.siteId, name: "No" })).rejects.toThrow(/permiso/);
    await f.owner.mutation(api.timbre.saveMember, { memberId: member._id, unitIds: [unit2] });
    expect((await f.owner.query(api.timbre.listUnits, { siteId: f.siteId }))[0].recipientIds).toEqual([]);
    await f.owner.mutation(api.timbre.removeMember, { memberId: member._id });
    const site = await f.t.run((ctx) => ctx.db.get("timbreSites", f.siteId));
    expect(site?.recipientIds).toEqual([]); expect(site?.fallbackRecipientIds).toEqual([]);
    await expect(f.resident.query(api.timbre.listUnits, { siteId: f.siteId })).rejects.toThrow(/permiso/);
  });

  it("prevents managers from granting or editing owners/managers", async () => {
    const f = await fixture();
    const invite = await f.owner.mutation(api.timbre.createInvite, { siteId: f.siteId, role: "manager" });
    await f.resident.mutation(api.timbre.acceptInvite, { token: invite.token });
    await expect(f.resident.mutation(api.timbre.createInvite, { siteId: f.siteId, role: "manager" })).rejects.toThrow(/propietario/);
    const ownerMember = (await f.owner.query(api.timbre.listMembers, { siteId: f.siteId })).find((row) => row.role === "owner")!;
    await expect(f.resident.mutation(api.timbre.removeMember, { memberId: ownerMember._id })).rejects.toThrow(/permiso/);
    await expect(f.resident.mutation(api.timbre.saveMember, { memberId: ownerMember._id, canReceive: false })).rejects.toThrow(/propietario/);
    const pending = await f.resident.mutation(api.timbre.createInvite, { siteId: f.siteId, role: "resident" });
    const manager = (await f.owner.query(api.timbre.listMembers, { siteId: f.siteId })).find((row) => row.userId === f.residentId)!;
    await f.owner.mutation(api.timbre.removeMember, { memberId: manager._id });
    await expect(f.stranger.mutation(api.timbre.acceptInvite, { token: pending.token })).rejects.toThrow(/ya no puede autorizar/);
  });
});

describe("Timbre schedule and printable design validation", () => {
  it("evaluates local timezone, mute and schedule boundaries without changing the QR", () => {
    const site = { enabled: true, timezone: "America/Argentina/Buenos_Aires", schedule: [{ day: 1, start: "09:00", end: "17:00" }] };
    expect(getTimbreAvailability(site, Date.parse("2026-10-19T12:00:00Z"))).toEqual({ available: true, reason: "available" });
    expect(getTimbreAvailability(site, Date.parse("2026-10-19T20:00:00Z"))).toEqual({ available: false, reason: "outside_schedule" });
    expect(getTimbreAvailability({ ...site, mutedUntil: Date.parse("2026-10-20T00:00:00Z") }, Date.parse("2026-10-19T12:00:00Z")).reason).toBe("muted");
    expect(getTimbreAvailability({ ...site, enabled: false }).reason).toBe("disabled");
    expect(() => validateTimbreSchedule([{ day: 7, start: "09:00", end: "10:00" }])).toThrow(/horarios/);
    expect(() => validateTimbreSchedule([{ day: 1, start: "09:00", end: "12:00" }, { day: 1, start: "11:00", end: "13:00" }])).toThrow(/superponerse/);
    const night = { ...site, schedule: validateTimbreSchedule([{ day: 1, start: "22:00", end: "02:00" }]) };
    expect(getTimbreAvailability(night, Date.parse("2026-10-20T04:00:00Z")).available).toBe(true);
    expect(getTimbreAvailability(night, Date.parse("2026-10-20T05:00:00Z")).available).toBe(false);
    expect(() => validateTimbreSchedule([{ day: 6, start: "22:00", end: "02:00" }, { day: 0, start: "01:00", end: "03:00" }])).toThrow(/superponerse/);
    expect(validateTimbreSchedule([{ day: 6, start: "22:00", end: "00:00" }, { day: 0, start: "00:00", end: "03:00" }])).toHaveLength(2);
  });
  it("blocks unsafe/oversized images and unreadable QR designs on the server", () => {
    expect(validateStoredTimbreDesign(design)).toEqual(design);
    expect(() => validateStoredTimbreDesign({ ...design, qrColor: "#ffffff" })).toThrow(/contraste/);
    expect(() => validateStoredTimbreDesign({ ...design, textColor: "#F5F3EF" })).toThrow(/contraste/);
    expect(() => validateStoredTimbreDesign({ ...design, widthMm: 10 })).toThrow(/dimensiones/);
    expect(() => validateStoredTimbreDesign({ ...design, imageDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" })).toThrow(/PNG o JPEG/);
    expect(() => validateStoredTimbreDesign({ ...design, imageDataUrl: "data:image/png;base64,YWJjZA==" })).toThrow(/formato/);
    expect(() => validateStoredTimbreDesign({ ...design, imageDataUrl: `data:image/png;base64,${"A".repeat(960_000)}` })).toThrow(/PNG o JPEG/);
    const header = new Uint8Array(24); header.set([137, 80, 78, 71, 13, 10, 26, 10], 0); header.set([73, 72, 68, 82], 12);
    new DataView(header.buffer).setUint32(16, 100_000); new DataView(header.buffer).setUint32(20, 100_000);
    expect(() => validateStoredTimbreDesign({ ...design, imageDataUrl: `data:image/png;base64,${btoa(String.fromCharCode(...header))}` })).toThrow(/4096/);
  });
});
