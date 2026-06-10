// Copy the compiled ZK artifacts (keys/ + zkir/) from @nyxels/contract-sdk's
// managed/ output into public/shared-canvas/, so Vite serves them with the SPA
// (dev server and build alike) at <base>/shared-canvas/{keys,zkir}/… — the
// layout FetchZkConfigProvider expects.
//
// Runs via the predev/prebuild hooks, so it happens automatically before
// `npm run dev` and `npm run build` (locally and in CI). The destination is
// gitignored: managed/ stays the single committed source of truth.
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const managed = path.resolve(here, "../../contract-sdk/managed");
const dest = path.resolve(here, "../public/shared-canvas");

if (!existsSync(managed)) {
  console.error(`copy-zk-assets: ${managed} not found — compile the contract first (npm run compile).`);
  process.exit(1);
}

// Start clean so artifacts removed upstream don't linger here.
rmSync(dest, { recursive: true, force: true });
for (const dir of ["keys", "zkir"]) {
  cpSync(path.join(managed, dir), path.join(dest, dir), { recursive: true });
}
console.log(`copy-zk-assets: copied managed/{keys,zkir} -> ${path.relative(process.cwd(), dest)}`);
