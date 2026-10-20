// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { nativeGoogleVerifierKey } from "./native-google-auth";

describe("native Google verifier SDK contract", () => {
  it("guards the installed 0.0.96 verifier-storage implementation", () => {
    const require = createRequire(import.meta.url);
    const packageRoot = resolve(
      dirname(require.resolve("@convex-dev/auth/react")),
      "../..",
    );
    const packageJson = JSON.parse(
      readFileSync(resolve(packageRoot, "package.json"), "utf8"),
    );
    const implementation = readFileSync(
      resolve(packageRoot, "src/react/client.tsx"),
      "utf8",
    );
    expect(packageJson.version).toBe("0.0.96");
    const key = implementation.match(/const VERIFIER_STORAGE_KEY = "([^"]+)";/)?.[1];
    expect(key).toBe("__convexAuthOAuthVerifier");
    expect(implementation).toContain(
      'const escapedNamespace = namespace.replace(/[^a-zA-Z0-9]/g, "");',
    );
    expect(implementation).toContain('`${key}_${escapedNamespace}`');
    expect(nativeGoogleVerifierKey("https://example.convex.cloud")).toBe(
      `${key}_httpsexampleconvexcloud`,
    );
  });
});
