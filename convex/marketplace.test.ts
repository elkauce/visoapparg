import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import type { Id } from "./_generated/dataModel";
import { MAX_PAGES } from "./lib/deck_keys";

afterEach(() => vi.unstubAllEnvs());

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

async function fixture() {
  const t = convexTest(schema, modules);
  const [adminId, creatorId, buyerId] = await t.run(
    async (ctx) =>
      [
        await ctx.db.insert("users", { email: "operator@example.test" }),
        await ctx.db.insert("users", { email: "creator@example.test" }),
        // The configured email by itself is deliberately not an admin grant.
        await ctx.db.insert("users", { email: "manuelhaguilar8@gmail.com" }),
      ] as const,
  );
  vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", adminId);
  const admin = t.withIdentity({ subject: `${adminId}|operator-session` });
  const creator = t.withIdentity({ subject: `${creatorId}|creator-session` });
  const buyer = t.withIdentity({ subject: `${buyerId}|buyer-session` });
  const profileId = await creator.mutation(api.marketplace.saveCreator, {
    displayName: "Diseños de prueba",
    bio: "Recursos originales de este creador.",
  });
  return { t, admin, creator, buyer, adminId, creatorId, buyerId, profileId };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
async function approveCreator(f: Fixture) {
  await f.creator.mutation(api.marketplace.submitCreator, {});
  await f.admin.mutation(api.marketplace.reviewCreator, {
    creatorId: f.profileId,
    decision: "approved",
  });
}
async function upload(f: Fixture, actor = f.creator) {
  const response = await actor.fetch("/marketplace/media", {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: png,
  });
  expect(response.status).toBe(200);
  return (await response.json()) as {
    storageId: Id<"_storage">;
    mediaType: "image";
  };
}
async function draft(
  f: Fixture,
  overrides: Partial<
    Parameters<typeof f.creator.mutation<typeof api.marketplace.saveProduct>>[1]
  > = {},
) {
  const file = await upload(f);
  const args = {
    title: "Iconos del creador",
    description: "Iconos originales para las teclas.",
    category: "icons" as const,
    priceMode: "free" as const,
    coverStorageId: file.storageId,
    assets: [
      { name: "Icono", storageId: file.storageId, mediaType: "image" as const },
    ],
    ...overrides,
  };
  const productId = await f.creator.mutation(api.marketplace.saveProduct, args);
  return { productId, file, args };
}
async function publish(f: Fixture) {
  await approveCreator(f);
  const d = await draft(f);
  await f.creator.mutation(api.marketplace.submitProduct, {
    productId: d.productId,
  });
  await f.admin.mutation(api.marketplace.reviewProduct, {
    productId: d.productId,
    decision: "approved",
  });
  return d;
}

describe("Marketplace authorization and moderation", () => {
  it("requires login for the catalog, details, library and all administrative data", async () => {
    const f = await fixture();
    for (const ref of [
      api.marketplace.session,
      api.marketplace.list,
      api.marketplace.library,
      api.marketplace.mine,
      api.marketplace.queues,
      api.marketplace.adminProducts,
      api.marketplace.adminCreators,
    ]) {
      await expect(f.t.query(ref, {})).rejects.toThrow(/iniciar sesión/);
    }
    await expect(
      f.t.query(api.marketplace.get, { productId: "viso-original-icons" }),
    ).rejects.toThrow(/iniciar sesión/);
    expect(
      (
        await f.t.fetch("/marketplace/media", {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: png,
        })
      ).status,
    ).toBe(401);
  });

  it("grants admin only to the configured immutable ID, never a matching email or creator input", async () => {
    const f = await fixture();
    expect((await f.buyer.query(api.marketplace.session, {})).isAdmin).toBe(
      false,
    );
    expect((await f.admin.query(api.marketplace.session, {})).isAdmin).toBe(
      true,
    );
    await expect(
      f.buyer.query(api.marketplace.adminProducts, {}),
    ).rejects.toThrow(/permiso/);
    await expect(
      f.creator.mutation(api.marketplace.reviewCreator, {
        creatorId: f.profileId,
        decision: "approved",
      }),
    ).rejects.toThrow(/permiso/);
    await expect(
      f.creator.mutation(api.marketplace.saveProduct, {
        title: "Borrador",
        description: "Descripción",
        category: "icons",
        priceMode: "free",
        assets: [],
      }),
    ).rejects.toThrow(/aprobado/);
  });

  it("requires explicit creator approval and a reason for rejection; edited pending applications leave the queue", async () => {
    const f = await fixture();
    await f.creator.mutation(api.marketplace.submitCreator, {});
    expect(
      (await f.admin.query(api.marketplace.queues, {})).creators,
    ).toHaveLength(1);
    await expect(
      f.admin.mutation(api.marketplace.reviewCreator, {
        creatorId: f.profileId,
        decision: "rejected",
      }),
    ).rejects.toThrow(/motivo/);
    await f.creator.mutation(api.marketplace.saveCreator, {
      displayName: "Nombre corregido",
      bio: "Mi presentación corregida.",
    });
    expect(
      (await f.admin.query(api.marketplace.queues, {})).creators,
    ).toHaveLength(0);
    expect(
      (await f.creator.query(api.marketplace.session, {})).creator?.status,
    ).toBe("draft");
  });

  it("keeps drafts, pending products and payloads private until approval", async () => {
    const f = await fixture();
    await approveCreator(f);
    const d = await draft(f);
    expect(
      await f.buyer.query(api.marketplace.get, { productId: d.productId }),
    ).toBeNull();
    const owner = await f.creator.query(api.marketplace.get, {
      productId: d.productId,
    });
    expect(owner?.coverStorageId).toBe(d.file.storageId);
    expect(owner?.assets[0].storageId).toBe(d.file.storageId);
    await expect(
      f.buyer.mutation(api.marketplace.submitProduct, {
        productId: d.productId,
      }),
    ).rejects.toThrow(/encontrado/);
    await f.creator.mutation(api.marketplace.submitProduct, {
      productId: d.productId,
    });
    expect(
      (await f.buyer.query(api.marketplace.list, {})).some(
        (p) => p.id === d.productId,
      ),
    ).toBe(false);
    await expect(
      f.admin.mutation(api.marketplace.reviewProduct, {
        productId: d.productId,
        decision: "rejected",
      }),
    ).rejects.toThrow(/motivo/);
    await f.admin.mutation(api.marketplace.reviewProduct, {
      productId: d.productId,
      decision: "approved",
    });
    const publicDetail = await f.buyer.query(api.marketplace.get, {
      productId: d.productId,
    });
    expect(publicDetail?.status).toBe("published");
    expect(publicDetail?.assets).toEqual([]);
    expect(publicDetail?.coverStorageId).toBeUndefined();
    expect(publicDetail?.canEdit).toBe(false);
    expect(
      (await f.admin.query(api.marketplace.adminProducts, {}))[0].canEdit,
    ).toBe(false);
    expect(
      (
        await f.buyer.query(api.marketplace.list, {
          search: "ICONOS DEL CREADOR",
          category: "icons",
        })
      ).map((p) => p.id),
    ).toContain(d.productId);
  });

  it("rejects another creator's storage, wrong category formats and another user's edits", async () => {
    const f = await fixture();
    await approveCreator(f);
    const foreign = await upload(f, f.admin);
    await expect(
      f.creator.mutation(api.marketplace.saveProduct, {
        title: "Ajeno",
        description: "Descripción",
        category: "icons",
        priceMode: "free",
        assets: [
          { name: "Ajeno", storageId: foreign.storageId, mediaType: "image" },
        ],
      }),
    ).rejects.toThrow(/pertenece/);
    const own = await upload(f);
    await expect(
      f.creator.mutation(api.marketplace.saveProduct, {
        title: "Mal formato",
        description: "Descripción",
        category: "plugins",
        priceMode: "free",
        assets: [
          { name: "Imagen", storageId: own.storageId, mediaType: "image" },
        ],
      }),
    ).rejects.toThrow(/formato/);
    const d = await draft(f);
    await expect(
      f.buyer.mutation(api.marketplace.saveProduct, {
        ...d.args,
        productId: d.productId,
      }),
    ).rejects.toThrow();
    await expect(
      f.admin.mutation(api.marketplace.saveProduct, {
        ...d.args,
        productId: d.productId,
      }),
    ).rejects.toThrow(/cola/);
  });

  it("withdraws a creator's pending and published products when their approval is revoked", async () => {
    const f = await fixture();
    const d = await publish(f);
    await f.admin.mutation(api.marketplace.reviewCreator, {
      creatorId: f.profileId,
      decision: "rejected",
      reason: "Necesita corregir sus publicaciones.",
    });
    expect(
      await f.buyer.query(api.marketplace.get, { productId: d.productId }),
    ).toBeNull();
    expect((await f.creator.query(api.marketplace.mine, {}))[0].status).toBe(
      "archived",
    );
    await expect(
      f.creator.mutation(api.marketplace.submitProduct, {
        productId: d.productId,
      }),
    ).rejects.toThrow(/aprobado/);
  });
});

describe("Marketplace library and safe installation", () => {
  it("acquires free packs idempotently and keeps each user's library isolated", async () => {
    const f = await fixture();
    const ids = await Promise.all([
      f.buyer.mutation(api.marketplace.acquire, {
        productId: "viso-original-icons",
      }),
      f.buyer.mutation(api.marketplace.acquire, {
        productId: "viso-original-icons",
      }),
    ]);
    expect(ids[0]).toBe(ids[1]);
    expect(await f.buyer.query(api.marketplace.library, {})).toHaveLength(1);
    expect(await f.creator.query(api.marketplace.library, {})).toEqual([]);
    await f.creator.mutation(api.marketplace.removeFromLibrary, {
      productId: "viso-original-icons",
    });
    expect(await f.buyer.query(api.marketplace.library, {})).toHaveLength(1);
    await f.buyer.mutation(api.marketplace.removeFromLibrary, {
      productId: "viso-original-icons",
    });
    expect(await f.buyer.query(api.marketplace.library, {})).toEqual([]);
  });

  it("snapshots acquired assets so a later paid revision cannot add new downloads to old licenses", async () => {
    const f = await fixture();
    const d = await publish(f);
    await f.buyer.mutation(api.marketplace.acquire, { productId: d.productId });
    const later = await upload(f);
    await f.creator.mutation(api.marketplace.saveProduct, {
      ...d.args,
      productId: d.productId,
      title: "Nueva edición externa",
      priceMode: "external",
      externalUrl: "https://shop.example.test/new-edition",
      assets: [
        {
          name: "Archivo nuevo",
          storageId: later.storageId,
          mediaType: "image",
        },
      ],
    });
    await f.creator.mutation(api.marketplace.submitProduct, {
      productId: d.productId,
    });
    await f.admin.mutation(api.marketplace.reviewProduct, {
      productId: d.productId,
      decision: "approved",
    });
    const library = await f.buyer.query(api.marketplace.library, {});
    expect(library[0].title).toBe(d.args.title);
    expect(library[0].assets.map((a) => a.storageId)).toEqual([
      d.file.storageId,
    ]);
    await expect(
      f.buyer.mutation(api.marketplace.acquire, { productId: d.productId }),
    ).rejects.toThrow(/externo/);
    await expect(
      f.buyer.action(api.marketplace.copyAssetToDeck, {
        productId: d.productId,
        assetId: later.storageId,
      }),
    ).rejects.toThrow(/disponible/);
    const copied = await f.buyer.action(api.marketplace.copyAssetToDeck, {
      productId: d.productId,
      assetId: d.file.storageId,
    });
    expect(copied.storageId).not.toBe(d.file.storageId);
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("deckMedia")
          .withIndex("by_storage", (q) => q.eq("storageId", copied.storageId))
          .unique(),
      ),
    ).toMatchObject({ userId: f.buyerId, mediaType: "image" });
    expect(
      await f.t.run(
        async (ctx) => (await ctx.storage.get(d.file.storageId)) !== null,
      ),
    ).toBe(true);
  });

  it("does not copy resources without acquisition or outside the acquired asset list", async () => {
    const f = await fixture();
    const d = await publish(f);
    await expect(
      f.buyer.action(api.marketplace.copyAssetToDeck, {
        productId: d.productId,
        assetId: d.file.storageId,
      }),
    ).rejects.toThrow(/disponible/);
    await f.buyer.mutation(api.marketplace.acquire, { productId: d.productId });
    await expect(
      f.creator.action(api.marketplace.copyAssetToDeck, {
        productId: d.productId,
        assetId: d.file.storageId,
      }),
    ).rejects.toThrow(/disponible/);
    await expect(
      f.buyer.action(api.marketplace.copyAssetToDeck, {
        productId: "viso-original-icons",
        assetId: "libre-png",
      }),
    ).rejects.toThrow(/disponible/);
  });

  it("appends the essential profile without replacing pages, user colors or state activation", async () => {
    const f = await fixture();
    const pageId = await f.buyer.mutation(api.deck_layout.createPage, {
      name: "Mi página",
    });
    const statusId = await f.buyer.mutation(api.statuses.create, {
      name: "Libre",
      color: "#abcdef",
      icon: "star",
    });
    await f.buyer.mutation(api.marketplace.acquire, {
      productId: "viso-essential-profile",
    });
    const addedId = await f.buyer.mutation(api.marketplace.installProfile, {
      productId: "viso-essential-profile",
    });
    expect(addedId).not.toBe(pageId);
    const layout = (await f.buyer.query(api.deck_layout.get, {}))!;
    expect(layout.pages.map((p) => p._id)).toContain(pageId);
    expect(layout.keys.filter((k) => k.pageId === addedId)).toHaveLength(6);
    expect(
      layout.keys.find((k) => k.pageId === addedId && k.position === 0)
        ?.content,
    ).toEqual({ kind: "status", statusId });
    expect(
      await f.t.run((ctx) => ctx.db.get("statuses", statusId)),
    ).toMatchObject({ color: "#abcdef", icon: "star" });
    expect(
      (await f.buyer.query(api.users.getCurrentUser, {}))?.activeStatusId,
    ).toBeUndefined();
    await expect(
      f.creator.mutation(api.marketplace.installProfile, {
        productId: "viso-essential-profile",
      }),
    ).rejects.toThrow(/perfil/);
  });

  it("refuses profile installation at page or state capacity without partial writes", async () => {
    const f = await fixture();
    await f.buyer.mutation(api.marketplace.acquire, {
      productId: "viso-essential-profile",
    });
    for (let i = 0; i < MAX_PAGES; i++)
      await f.buyer.mutation(api.deck_layout.createPage, {
        name: `Página ${i}`,
      });
    await expect(
      f.buyer.mutation(api.marketplace.installProfile, {
        productId: "viso-essential-profile",
      }),
    ).rejects.toThrow(/páginas/);
    expect((await f.buyer.query(api.statuses.list, {}))?.statuses).toHaveLength(
      0,
    );
    await f.creator.mutation(api.marketplace.acquire, {
      productId: "viso-essential-profile",
    });
    for (let i = 0; i < 24; i++)
      await f.creator.mutation(api.statuses.create, {
        name: `Personal ${i}`,
        color: "#ffffff",
        icon: "star",
      });
    await expect(
      f.creator.mutation(api.marketplace.installProfile, {
        productId: "viso-essential-profile",
      }),
    ).rejects.toThrow(/estados/);
    expect(
      (await f.creator.query(api.deck_layout.get, {}))?.pages,
    ).toHaveLength(0);
  });
});

describe("Affiliate products and uploads", () => {
  it("keeps used listings admin-only and preserves approved affiliate links exactly", async () => {
    const f = await fixture();
    await approveCreator(f);
    const link =
      "https://meli.la/mi-codigo?matt_tool=abc%2F123&forceInApp=true";
    const values = {
      title: "Controlador usado",
      description: "Equipo usado publicado por un vendedor externo.",
      category: "used" as const,
      priceMode: "external" as const,
      affiliate: true,
      externalUrl: link,
      assets: [],
    };
    await expect(
      f.creator.mutation(api.marketplace.saveProduct, values),
    ).rejects.toThrow(/VISO/);
    await expect(
      f.admin.mutation(api.marketplace.saveProduct, {
        ...values,
        affiliate: false,
      }),
    ).rejects.toThrow(/afiliado/);
    await expect(
      f.admin.mutation(api.marketplace.saveProduct, {
        ...values,
        category: "hardware",
        externalUrl: "https://shop.example.test/item",
      }),
    ).rejects.toThrow(/Mercado Libre/);
    await expect(
      f.admin.mutation(api.marketplace.saveProduct, {
        ...values,
        category: "hardware",
        priceMode: "info",
        externalUrl: undefined,
      }),
    ).rejects.toThrow(/compra externa/);
    for (const externalUrl of [
      "https://mercadolibre.com.ar.evil.example/item",
      "https://mercadolibre.com.ar@evil.example/item",
      "javascript:alert(1)",
      "http://meli.la/item",
    ]) {
      await expect(
        f.admin.mutation(api.marketplace.saveProduct, {
          ...values,
          externalUrl,
        }),
      ).rejects.toThrow();
    }
    const productId = await f.admin.mutation(
      api.marketplace.saveProduct,
      values,
    );
    await f.admin.mutation(api.marketplace.submitProduct, { productId });
    await f.admin.mutation(api.marketplace.reviewProduct, {
      productId,
      decision: "approved",
    });
    expect(
      await f.buyer.query(api.marketplace.get, { productId }),
    ).toMatchObject({
      externalUrl: link,
      affiliate: true,
      category: "used",
      priceMode: "external",
    });
    await expect(
      f.buyer.mutation(api.marketplace.acquire, { productId }),
    ).rejects.toThrow(/externo/);
    await expect(
      f.buyer.mutation(api.marketplace.acquire, { productId: "viso-mini" }),
    ).rejects.toThrow(/externo/);
  });

  it("authenticates uploads and checks MIME, bytes, empty files and actual size", async () => {
    const f = await fixture();
    expect(
      (
        await f.buyer.fetch("/marketplace/media", {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: png,
        })
      ).status,
    ).toBe(403);
    for (const [type, body] of [
      ["image/svg+xml", "<svg/>"],
      ["image/png", "<svg/>"],
      ["image/png", ""],
      ["text/html", "<h1>fake</h1>"],
    ] as const) {
      expect(
        (
          await f.creator.fetch("/marketplace/media", {
            method: "POST",
            headers: { "Content-Type": type },
            body,
          })
        ).status,
      ).toBe(400);
    }
    expect(
      (
        await f.creator.fetch("/marketplace/media", {
          method: "POST",
          headers: {
            "Content-Type": "image/png",
            "Content-Length": String(61 * 1024 * 1024),
          },
          body: png,
        })
      ).status,
    ).toBe(413);
    expect(
      (
        await f.creator.fetch("/marketplace/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: new Uint8Array(513 * 1024),
        })
      ).status,
    ).toBe(413);
    const file = await upload(f);
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("marketplaceUploads")
          .withIndex("by_storage", (q) => q.eq("storageId", file.storageId))
          .unique(),
      ),
    ).toMatchObject({
      userId: f.creatorId,
      mediaType: "image",
      size: png.length,
    });
  });

  it("resolves only existing authenticated identities for administrative setup without granting a role", async () => {
    const f = await fixture();
    expect(
      await f.t.query(internal.marketplace.resolveAdminCandidate, {
        email: "manuelhaguilar8@gmail.com",
      }),
    ).toEqual({ unique: false, candidates: [] });
    await f.t.run((ctx) =>
      ctx.db.insert("authAccounts", {
        userId: f.buyerId,
        provider: "password",
        providerAccountId: "manuelhaguilar8@gmail.com",
      }),
    );
    expect(
      await f.t.query(internal.marketplace.resolveAdminCandidate, {
        email: " MANUELHAGUILAR8@GMAIL.COM ",
      }),
    ).toMatchObject({
      unique: true,
      candidates: [{ userId: f.buyerId, password: true }],
    });
    expect((await f.buyer.query(api.marketplace.session, {})).isAdmin).toBe(
      false,
    );
    await f.t.run((ctx) =>
      ctx.db.insert("authAccounts", {
        userId: f.creatorId,
        provider: "password",
        providerAccountId: "manuelhaguilar8@gmail.com",
      }),
    );
    expect(
      (
        await f.t.query(internal.marketplace.resolveAdminCandidate, {
          email: "manuelhaguilar8@gmail.com",
        })
      ).unique,
    ).toBe(false);
  });

  it("enforces the account upload budget before reading another file", async () => {
    const f = await fixture();
    const file = await upload(f);
    await f.t.run(async (ctx) => {
      const record = await ctx.db
        .query("marketplaceUploads")
        .withIndex("by_storage", (q) => q.eq("storageId", file.storageId))
        .unique();
      await ctx.db.patch("marketplaceUploads", record!._id, {
        size: 1024 * 1024 * 1024,
      });
    });
    const response = await f.creator.fetch("/marketplace/media", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: png,
    });
    expect(response.status).toBe(413);
    expect(
      await f.t.run((ctx) => ctx.db.query("marketplaceUploads").collect()),
    ).toHaveLength(1);
  });
});
