// Copy the compiled ZK artifacts (keys/ + zkir/) from @nyxels/contract-sdk's
// managed/ output into public/shared-canvas/, so Vite serves them with the SPA
// (dev server and build alike) at <base>/shared-canvas/{keys,zkir}/… — the
// layout FetchZkConfigProvider expects.
//
// Runs via the predev/prebuild hooks, so it happens automatically before
// `npm run dev` and `npm run build` (locally and in CI). managed/ is generated
// (gitignored) compiler output, so this script first validates it exists and
// holds every circuit's artifacts, and fails with a pointer to `npm run
// compile` otherwise. The destination is gitignored too: the Compact source is
// the only committed truth.
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const managed = path.resolve(here, "../../contract-sdk/managed");
const dest = path.resolve(here, "../public/shared-canvas");

const fail = (reason) => {
  console.error(
    `copy-zk-assets: ${reason}\n` +
      `  The contract's compiled output (packages/contract-sdk/managed/) is generated, not committed.\n` +
      `  Run \`npm run compile\` at the repo root to (re)generate it, then retry.`,
  );
  process.exit(1);
};

const contractInfoPath = path.join(managed, "compiler", "contract-info.json");
if (!existsSync(contractInfoPath)) {
  fail(`${path.relative(process.cwd(), contractInfoPath)} not found.`);
}

// Validate per circuit, against the compiler's own manifest, that everything
// FetchZkConfigProvider will fetch is actually present. Only proof circuits
// have keys/zkir — pure ones compile to plain TypeScript.
const { circuits } = JSON.parse(readFileSync(contractInfoPath, "utf8"));
const proofCircuits = circuits.filter((c) => c.proof);
for (const { name } of proofCircuits) {
  for (const file of [`keys/${name}.prover`, `keys/${name}.verifier`, `zkir/${name}.bzkir`]) {
    if (!existsSync(path.join(managed, file))) {
      fail(`managed/${file} is missing (circuit '${name}' incomplete).`);
    }
  }
}

// Start clean so artifacts removed upstream don't linger here.
rmSync(dest, { recursive: true, force: true });
for (const dir of ["keys", "zkir"]) {
  cpSync(path.join(managed, dir), path.join(dest, dir), { recursive: true });
}
const names = proofCircuits.map((c) => c.name).join(", ");
console.log(`copy-zk-assets: copied managed/{keys,zkir} (${names}) -> ${path.relative(process.cwd(), dest)}`);
