import { generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";

// Only initializes the local development backend; never uploads keys elsewhere.
const config = JSON.parse(
  await readFile(
    new URL("../.convex/local/default/config.json", import.meta.url),
    "utf8",
  ),
);
const backend = `http://127.0.0.1:${config.ports.cloud}`;
const headers = {
  "Content-Type": "application/json",
  Authorization: `Convex ${config.adminKey}`,
};
async function request(path, body) {
  const response = await fetch(`${backend}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(`Local backend request failed: HTTP ${response.status}`);
  const content = await response.text();
  return content ? JSON.parse(content) : null;
}
async function hasVariable(name) {
  const result = await request("/api/query", {
    path: "_system/cli/queryEnvironmentVariables:get",
    args: { name },
    format: "json",
  });
  if (result.status !== "success")
    throw new Error(`Cannot inspect local binding ${name}`);
  return result.value !== null;
}
const privateKeyPresent = await hasVariable("JWT_PRIVATE_KEY");
const jwksPresent = await hasVariable("JWKS");
if (privateKeyPresent !== jwksPresent) {
  throw new Error(
    "Local signing configuration is incomplete. Restore its matching JWT_PRIVATE_KEY and JWKS before continuing.",
  );
}
const changes = [];
if (!privateKeyPresent) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  changes.push(
    {
      name: "JWT_PRIVATE_KEY",
      value: privateKey
        .export({ type: "pkcs8", format: "pem" })
        .trimEnd()
        .replaceAll("\n", " "),
    },
    {
      name: "JWKS",
      value: JSON.stringify({
        keys: [{ use: "sig", ...publicKey.export({ format: "jwk" }) }],
      }),
    },
  );
}
if (!(await hasVariable("SITE_URL"))) {
  changes.push({ name: "SITE_URL", value: "http://127.0.0.1:5173" });
}
if (changes.length) {
  await request("/api/update_environment_variables", { changes });
}
console.log(
  privateKeyPresent
    ? "Existing local signing keys preserved."
    : "Local signing keys generated and stored in the backend.",
);
console.log(
  "Local email/password authentication configured; no key values logged.",
);
