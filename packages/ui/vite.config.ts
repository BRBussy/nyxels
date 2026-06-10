import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Pure client-side SPA. No SSR, no framework — Vite serves index.html in dev and
// emits a static bundle on `build` that any static host (or `vite preview`) can serve.
//
// Vite 8 bundles with Rolldown (Oxc-based), so @vitejs/plugin-react is now the
// recommended React plugin — Oxc handles the Fast Refresh transform, and you'd
// only reach for @vitejs/plugin-react-swc if you needed SWC-specific plugins.
//
// The wasm plugin is for the Midnight SDK packages (ledger-v8 and friends) whose
// browser entry points do a bare ESM `import … from "./…_bg.wasm"`.
//
// nodePolyfills shims the Node builtins (Buffer, assert, process, …) the wallet
// SDK assumes exist in the browser — Next.js provides these automatically (which
// is why midday needs no equivalent), Vite does not.
export default defineConfig({
  plugins: [react(), wasm(), tailwindcss(), nodePolyfills()],
  resolve: {
    // Mirror tsconfig's "@/…" → src/ alias.
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  build: {
    // The wasm-bindgen entry points use top-level await; default browser targets
    // are recent enough, but Vite's safest shared baseline isn't — raise it.
    target: "esnext",
  },
});
