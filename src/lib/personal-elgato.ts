import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export interface ElgatoConfiguration {
  format: "viso-streamdeck-v1";
  actions: { name: string; url: string; color?: string }[];
}

// Personalize locally. Account access never goes to a packaging server.
export function personalizeElgato(
  installer: Uint8Array,
  configuration: ElgatoConfiguration,
) {
  if (
    configuration.format !== "viso-streamdeck-v1" ||
    !configuration.actions.length ||
    configuration.actions.length > 25
  )
    throw new Error("Invalid configuration");
  const urls = configuration.actions.map((a) => new URL(a.url));
  if (
    urls.some(
      (u) =>
        u.protocol !== "https:" ||
        !u.hostname.endsWith(".convex.site") ||
        u.pathname !== "/deck/set" ||
        !/^[a-z0-9-]{1,200}$/.test(u.searchParams.get("status") || "") ||
        Boolean(u.port || u.username || u.password || u.hash) ||
        !/^[a-f0-9]{48}$/.test(u.searchParams.get("token") || "") ||
        u.origin !== urls[0].origin ||
        u.searchParams.get("token") !== urls[0].searchParams.get("token"),
    )
  )
    throw new Error("Invalid account");
  const files = unzipSync(installer);
  const manifestPath = Object.keys(files).find((p) =>
    p.endsWith("/manifest.json"),
  );
  if (!manifestPath) throw new Error("Invalid installer");
  const root = manifestPath.slice(0, -"manifest.json".length);
  const manifest = JSON.parse(strFromU8(files[manifestPath]));
  if (manifest.UUID !== "com.viso.deck" || manifest.Version !== "1.2.0.0")
    throw new Error("Wrong plugin version");
  const template = manifest.Actions.find(
    (a: { UUID: string }) => a.UUID === "com.viso.deck.state",
  );
  if (!template) throw new Error("Missing action");
  const personalized = configuration.actions.map((a) => ({
    ...template,
    UUID: `com.viso.deck.personal-${new URL(a.url).searchParams.get("status")}`,
    Name: a.name,
    Tooltip: `Activar ${a.name} en tu cuenta VISO`,
    States: template.States.map((s: object) => ({ ...s, Title: a.name })),
  }));
  manifest.Actions = [...personalized, ...manifest.Actions];
  files[manifestPath] = strToU8(JSON.stringify(manifest, null, 2));
  files[root + "account.json"] = strToU8(JSON.stringify(configuration));
  return zipSync(files);
}
