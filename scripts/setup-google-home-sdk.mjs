import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

// Reuse the exact SDK previously supplied in the owner's private STATUS repo.
// Its binaries remain ignored; public source and CI do not distribute the AARs.
const index = process.argv.indexOf("--output-dir");
const directory = resolve(index >= 0 ? process.argv[index + 1] : "artifacts/google-home-sdk");
const files = [
  { name: "play-services-home-17.1.0.aar", blob: "17fa888a020cb74dedb56a0ad1033cddc4e2e0f3", sha256: "dd088a22a0fc16886ee8a81bb86db9efc254378cf68b5cf4d59c5a7c1405b02b", bytes: 5180129 },
  { name: "play-services-home-types-17.1.0.aar", blob: "4d58cc5ee7e01313a6e2a59ab6e1b18dc5024ef0", sha256: "4eda000761e067ec5b009a1b2cf6fce67f32dbf15628d1dcf8846db58f303003", bytes: 24978601 },
];
const digest = (data) => createHash("sha256").update(data).digest("hex");
await mkdir(directory, { recursive: true });
for (const file of files) {
  const destination = resolve(directory, file.name);
  let existing;
  try { existing = await readFile(destination); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (existing) {
    if (digest(existing) !== file.sha256 || existing.length !== file.bytes) throw new Error(`${file.name}: existing file differs from the verified STATUS SDK; refusing to overwrite it.`);
  } else {
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
    if (!token) throw new Error("The official SDK is missing. Restore the existing STATUS SDK files or supply authorized GitHub access through environment settings; never share tokens in chat.");
    const response = await fetch(`https://api.github.com/repos/elkauce/status-mini-/git/blobs/${file.blob}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`Authorized STATUS SDK download failed (${response.status}); no credentials were logged.`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length !== file.bytes || digest(data) !== file.sha256) throw new Error(`${file.name}: SDK checksum mismatch.`);
    await writeFile(destination, data, { flag: "wx", mode: 0o600 });
  }
  console.log(`${file.name}: verified SHA-256, ${(await stat(destination)).size} bytes`);
}
console.log(`SDK directory: ${directory}`);
