# shared-canvas

A **pure single-page React app** — no SSR, no framework, no server. The current
recommended stack for a client-only SPA in 2026:

| Concern      | Choice                          | Why                                                        |
| ------------ | ------------------------------- | ---------------------------------------------------------- |
| Build / dev  | **Vite 8**                      | The consensus tool for SPAs; native-ESM dev, instant HMR.  |
| UI           | **React 19**                    | —                                                          |
| Language     | **TypeScript 6**                | `tsc -b` type-checks; Vite handles the actual transpile.   |
| React plugin | **`@vitejs/plugin-react`**      | Recommended under Vite 8's Rolldown/Oxc build (see below). |

> React's own docs ([Build a React app from scratch](https://react.dev/learn/build-a-react-app-from-scratch))
> point at Vite / Parcel / Rsbuild for this exact case. Reach for Next.js only
> when you need SSR/SSG, server components, or file-based routing — overkill for
> a small client-side site like this one.

> **Why `@vitejs/plugin-react` and not `-react-swc`?** Vite 8 bundles with
> Rolldown (Oxc, Rust-based), which already does the fast React transform, so the
> default plugin is recommended. `@vitejs/plugin-react-swc` is now only needed if
> you depend on SWC-specific plugins.

## Develop

This folder is its own self-contained package (separate from the playground's
Node CLIs). Install and run from here:

```bash
cd app/playground/clis/4_shared_canvas
npm install
npm run dev        # http://localhost:5173
```

## Build & preview

```bash
npm run build      # tsc -b (typecheck) + vite build  →  dist/
npm run preview    # serve the production dist/ locally
```

`dist/` is fully static — drop it on any static host (Netlify, Pages, S3, …).

## What it does

A freehand drawing canvas made of **squares** that you grow one at a time, with
two modes (toggle in the toolbar):

**Draw mode**

- The canvas starts as a **single square** at `[0,0]` (bottom-left corner).
- A dashed **`+` cell** marks the only square you may add next. The canvas grows
  in repeating **L-shaped shells** from the bottom-left, up and out:

  ```
  [0,0] · [1,0] [1,1] [0,1] · [2,0] [2,1] [2,2] [1,2] [0,2] · …
  ```

  (see [`src/sequence.ts`](src/sequence.ts) — `coordAt(i)` is the whole algorithm).
- **Tap** a square to toggle it **active**; you can have **many active at once**.
  Active squares are plain white; inactive squares get a **light grey overlay**.
- **Drag to draw.** A single gesture flows **across all active squares** as one
  continuous stroke. Inactive squares ignore the pointer. Pick a **colour** and
  **brush size** (S/M/L). **Undo** reverses the last gesture (across every square
  it touched); **Clear active** empties the active squares; **Reset** starts over.

**View mode**

- Just the rendered artwork — no overlays, no `+`, no editing. Adjacent squares
  read as one seamless canvas.

Drawing uses [**perfect-freehand**](https://github.com/steveruizok/perfect-freehand):
pointer samples → `getStroke()` → a filled SVG outline path.

### Data model

State lives **only in memory** for now — nothing is persisted, so a reload starts
from a blank single square. (No `localStorage`, no backend, no ledger yet.)

Each square holds its **raw strokes** (points + colour + size), keeping colour,
thickness and pressure with full fidelity:

```ts
interface Square { x: number; y: number; strokes: Stroke[] }
interface Stroke {
  points: [x, y, pressure][];
  color: string;
  size: number;
  gesture?: number; // segments of one pen gesture share this id
  seq?: number;     // their order within the gesture
}
```

A pen gesture that crosses square boundaries is **split per square** for storage:
each square keeps only the points that fell inside it, in its own local
coordinates. Those segments share a `gesture` id and carry a `seq` order.

**Storage is per-square; rendering is reassembled.** A single [`StrokeLayer`](src/components/StrokeLayer.tsx)
SVG spans the whole grid and, for each gesture, regroups its segments (by `seq`),
concatenates their points into grid space, and runs perfect-freehand's
`getStroke` **once** — so a cross-square stroke draws as one continuous outline
with **no seam at borders**. The live gesture renders the same way, so drawing
looks seamless in real time too. (See [`src/stroke.ts`](src/stroke.ts).)

The per-square shape is intended to map later onto the `4_shared_canvas` Compact
contract's `Map<Coordinate, …>` ledger; the `gesture`/`seq` fields travel with
each square's stroke data so rendering can stitch gestures back together even when
squares are stored independently. That wiring isn't built yet — today it's all
in-memory React state.

## Layout

```
index.html              # SPA entry — loads /src/main.tsx
vite.config.ts          # Vite + @vitejs/plugin-react
tsconfig*.json          # project-reference setup (app + node)
src/
  main.tsx              # createRoot + <StrictMode>
  App.tsx               # modes, toolbar, grid-level pointer handling, state
  App.css, index.css
  constants.ts          # SQUARE_SIZE
  types.ts              # Square / Stroke data model
  sequence.ts           # L-shell growth: coordAt() / gridExtent()
  stroke.ts             # perfect-freehand; per-gesture reassembly → SVG paths
  components/
    StrokeLayer.tsx     # one overlay SVG drawing all ink in grid space
```

Pointer handling lives on the **grid container** (not per-square), so one drag
can span multiple squares; `App` hit-tests each pointer sample to the square
under it and attributes the point there. The grid is a stack of absolutely-placed
layers: white tiles → the single `StrokeLayer` ink overlay → a grey wash over
inactive squares → the add-next button.
