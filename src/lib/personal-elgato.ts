import { strFromU8, strToU8, unzipSync, zipSync } from "fflate/browser";

export interface ElgatoConfiguration {
  format: "viso-streamdeck-v1";
  actions: { name: string; url: string; color?: string; icon?: string }[];
}

// Personalize locally. Account access never goes to a packaging server.
export function personalizeElgato(
  installer: Uint8Array,
  configuration: ElgatoConfiguration,
  images?: { normal: Uint8Array; retina: Uint8Array }[],
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
  if (manifest.UUID !== "com.viso.deck" || manifest.Version !== "1.2.1.0")
    throw new Error("Wrong plugin version");
  const template = manifest.Actions.find(
    (a: { UUID: string }) => a.UUID === "com.viso.deck.state",
  );
  if (!template) throw new Error("Missing action");
  if (images && images.length !== configuration.actions.length)
    throw new Error("Missing key images");
  const personalized = configuration.actions.map((entry, index) => {
    const id = new URL(entry.url).searchParams.get("status");
    const imagePath = `imgs/personal-${id}`;
    if (images) {
      files[root + imagePath + ".png"] = images[index].normal;
      files[root + imagePath + "@2x.png"] = images[index].retina;
    }
    return {
      ...template,
      UUID: `com.viso.deck.personal-${id}`,
      Name: entry.name,
      Tooltip: `Activar ${entry.name} en tu cuenta VISO`,
      ...(images ? { Icon: imagePath } : {}),
      States: template.States.map((state: object) => ({
        ...state,
        Title: entry.name,
        ...(images ? { Image: imagePath } : {}),
      })),
    };
  });
  manifest.Actions = [...personalized, ...manifest.Actions];
  files[manifestPath] = strToU8(JSON.stringify(manifest, null, 2));
  files[root + "account.json"] = strToU8(JSON.stringify(configuration));
  return zipSync(files);
}
