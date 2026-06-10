// Compile test: packages/contract compiles cleanly into
// packages/contract-sdk/managed, exactly as its own `compile` script does.
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { contractPackageDir, zkConfigPath } from "../lib/config";

describe("compile", () => {
  it("packages/contract compiles into packages/contract-sdk/managed", () => {
    try {
      // Same invocation as @nyxels/contract's `compile` script, so this test
      // can never drift from how the artifacts are actually built.
      execSync("npm run compile", {
        cwd: contractPackageDir,
        encoding: "utf8",
        stdio: "pipe",
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; message: string };
      throw new Error(
        `\`npm run compile\` failed in ${contractPackageDir}:\n` +
          `${err.stderr ?? ""}\n${err.stdout ?? ""}`.trim(),
      );
    }

    // The artifacts every later test depends on.
    for (const artifact of ["contract/index.js", "keys", "zkir"]) {
      const artifactPath = path.join(zkConfigPath, artifact);
      expect(
        fs.existsSync(artifactPath),
        `compile succeeded but expected artifact is missing: ${artifactPath}`,
      ).toBe(true);
    }
  });
});
