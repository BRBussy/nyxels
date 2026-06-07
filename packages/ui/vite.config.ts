import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Pure client-side SPA. No SSR, no framework — Vite serves index.html in dev and
// emits a static bundle on `build` that any static host (or `vite preview`) can serve.
//
// Vite 8 bundles with Rolldown (Oxc-based), so @vitejs/plugin-react is now the
// recommended React plugin — Oxc handles the Fast Refresh transform, and you'd
// only reach for @vitejs/plugin-react-swc if you needed SWC-specific plugins.
export default defineConfig({
  plugins: [react()],
});
