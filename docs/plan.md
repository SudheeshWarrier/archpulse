# ArchPulse — AI Agent Implementation Plan

> **Hosting constraint:** All features run fully client-side on GitHub Pages. Zero backend, zero server-side logic.
> **Model:** 13 specialist agents across 4 phases. Each agent owns one file/concern boundary to preserve context across a large codebase.

---

## Overview

| Phase | Name | Agents | Timeline | Goal |
|---|---|---|---|---|
| 1 | Project Scaffold | 3 | Week 1 | Repo, CI/CD, state contract |
| 2 | Core Editor | 4 | Week 1–2 | SVG ingestion, canvas, step panel, save/load |
| 3 | Animation Engine | 3 | Week 2–3 | CSS animations, playback, UX polish |
| 4 | Export & Share | 3 | Week 3–4 | GIF export, share links, auto-animation |

**Critical sequencing rule:** Phase 1's State Model Agent must complete before any Phase 2 agent starts — the TypeScript types are the shared contract that all downstream agents import.

---

## Phase 1 — Project Scaffold

**Goal:** Initialise the Vite + React repo, wire up GitHub Actions CI/CD, and establish the core data model and state shape that all future agents depend on.

### Agent 1.1 — Scaffold Agent

**Stack:** Vite · React 18 · TypeScript

| # | Task | Type |
|---|---|---|
| 01 | Run `npm create vite@latest archpulse -- --template react-ts` and commit baseline | infra |
| 02 | Configure `vite.config.ts` with `base: '/archpulse/'` for GitHub Pages sub-path routing | arch |
| 03 | Install and configure Tailwind CSS + PostCSS; purge unused classes in prod build | infra |
| 04 | Add ESLint + Prettier configs; enforce no-unused-vars and strict TypeScript mode | infra |
| 05 | Create top-level component tree: `App → Layout → SVGCanvas \| StepPanel \| Toolbar` | arch |

---

### Agent 1.2 — CI/CD Agent

**Stack:** GitHub Actions · gh-pages branch · peaceiris/actions-gh-pages

| # | Task | Type |
|---|---|---|
| 01 | Write `.github/workflows/deploy.yml`: checkout → setup-node@v4 → npm ci → vite build → peaceiris/actions-gh-pages@v4 | infra |
| 02 | Add `ci.yml` workflow for PRs: lint + type-check only, no deploy | infra |
| 03 | Validate `GITHUB_TOKEN` permissions scoped to `pages: write` only | test |
| 04 | Add `vite-plugin-pwa` for offline support and `manifest.json` for installability | infra |

**Reference deploy workflow:**

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

### Agent 1.3 — State Model Agent

**Stack:** useReducer · TypeScript strict mode · Vitest

| # | Task | Type |
|---|---|---|
| 01 | Define `types/index.ts`: `ArchElement`, `AnimationStep`, `ProjectState`, `PlaybackState` | arch |
| 02 | Implement `useProjectReducer` hook with actions: `ADD_STEP`, `REMOVE_STEP`, `REORDER_STEPS`, `SET_SVG`, `ASSIGN_ELEMENT` | generate |
| 03 | Write Vitest unit tests for all reducer actions covering edge cases (empty steps, duplicate element assignments) | test |
| 04 | Expose a `usePlayback` hook managing `currentStep`, `isPlaying`, `speed` — separate from project state | generate |

**Core state shape:**

```ts
// types/index.ts
export type ElementType = 'node' | 'edge';

export interface ArchElement {
  id: string;
  type: ElementType;
  domSelector: string; // data-arch-id attribute value
}

export interface AnimationStep {
  id: string;
  label: string;
  highlight: string[]; // element IDs → nodes
  flow: string[];      // element IDs → edges
  durationMs: number;
}

export interface ProjectState {
  version: '1.0';
  svg: string;
  elements: Record<string, ArchElement>;
  steps: AnimationStep[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentStep: number;
  speed: 'slow' | 'normal' | 'fast';
  loop: boolean;
}
```

**Phase 1 agent dependencies:**

```
Scaffold Agent → CI/CD Agent (deploy needs built dist/)
Scaffold Agent → State Model Agent (types needed before hooks)
State Model Agent → ALL Phase 2 agents (data contract)
```

---

## Phase 2 — Core Editor

**Goal:** Build the SVG ingestion pipeline, interactive canvas, step panel UI, and save/load system — all wired to the Phase 1 state model.

### Agent 2.1 — SVG Ingestion Agent

**Stack:** FileReader API · DOMParser · Element registry

| # | Task | Type |
|---|---|---|
| 01 | Build `UploadZone` component: drag-and-drop + `<input accept=".svg">`, 5MB size guard | generate |
| 02 | Implement `parseSVG(svgString)` using `DOMParser`: walk DOM and classify elements by tag | generate |
| 03 | Stamp `data-arch-id` attributes on detected elements; build `Map<id, ArchElement>` registry | generate |
| 04 | Treat top-level `<g>` groups as single selectable nodes; skip deeply nested children | arch |
| 05 | Write Vitest unit tests for `parseSVG` against 5 sample SVGs (simple, complex, draw.io export, nested groups, edge-only) | test |

**Element classification rules:**

| SVG Tag | Classification |
|---|---|
| `rect`, `circle`, `ellipse`, `<g>` (top-level) | **node** |
| `path`, `line`, `polyline` | **edge** |

---

### Agent 2.2 — Canvas Agent

**Stack:** SVG DOM · delegated click events · CSS filters

| # | Task | Type |
|---|---|---|
| 01 | Render parsed SVG string as `dangerouslySetInnerHTML` inside a sandboxed `div`; lock `viewBox` to preserve aspect ratio | generate |
| 02 | Attach delegated click listener on SVG container: walk up from click target to find `data-arch-id`, dispatch `ASSIGN_ELEMENT` | generate |
| 03 | Apply CSS class `arch-selected` to elements assigned to the active step; use CSS `filter` for glow without modifying SVG source | edit |
| 04 | Add zoom + pan via wheel event + pointer drag; clamp transform to prevent losing the diagram off-screen | generate |
| 05 | Show element-type badge on hover using a floating tooltip positioned via `getBoundingClientRect` | generate |

> **Critical constraint:** Never modify the original SVG string. All animation and selection effects must be applied via CSS classes layered on top.

---

### Agent 2.3 — Step Panel Agent

**Stack:** @dnd-kit/core · @dnd-kit/sortable · inline editing

| # | Task | Type |
|---|---|---|
| 01 | Build `StepList` component rendering each step as a draggable card using `@dnd-kit/core` + `@dnd-kit/sortable` | generate |
| 02 | Each step card shows: step number, label (inline-editable), count of assigned elements, delete button | generate |
| 03 | Active step is highlighted; clicking a step sets it as the selection context for canvas clicks | generate |
| 04 | Add "Add step" button that inserts a blank step after the current selection | generate |
| 05 | On drag-end, dispatch `REORDER_STEPS` with the new index array — no in-place index mutation | edit |

---

### Agent 2.4 — Save/Load Agent

**Stack:** Blob API · FileReader · zod · localStorage

| # | Task | Type |
|---|---|---|
| 01 | Implement `exportProject(state)`: serialise to `.archpulse.json` v1.0 schema, trigger Blob download via anchor click | generate |
| 02 | Implement `importProject(file)`: read with FileReader, validate schema version, dispatch `SET_PROJECT` | generate |
| 03 | Add `zod` schema validation on import; show user-friendly error if schema is invalid or version mismatched | edit |
| 04 | Auto-save to `localStorage` on every state change (debounced 500ms); restore on page load if no import file provided | generate |

**File format reference:**

```json
{
  "version": "1.0",
  "svg": "<svg>...</svg>",
  "steps": [
    {
      "id": "step-1",
      "label": "API Gateway receives request",
      "highlight": ["node-1"],
      "flow": [],
      "durationMs": 1000
    }
  ]
}
```

**Blob download pattern (no server required):**

```ts
export function exportProject(state: ProjectState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-diagram.archpulse.json';
  a.click();
  URL.revokeObjectURL(url);
}
```

**Phase 2 agent dependencies:**

```
SVG Ingestion → Canvas (element registry is Canvas's input)
Canvas + Step Panel → run in parallel after Ingestion completes
Save/Load → runs last (depends on all other Phase 2 schemas being stable)
```

---

## Phase 3 — Animation Engine

**Goal:** Build the CSS animation system, playback controller, and UX polish layer including themes and onboarding.

### Agent 3.1 — Animation Agent

**Stack:** CSS keyframes · SVG filters · stroke-dashoffset · prefers-reduced-motion

| # | Task | Type |
|---|---|---|
| 01 | Define CSS keyframes in `animations.css`: `arch-highlight` (glow pulse), `arch-fade-in`, `arch-scale-in`, `arch-flow` (dash offset) | generate |
| 02 | Implement `applyStepAnimation(step, elements)`: add CSS class per element based on type and step config | generate |
| 03 | For edge flow: compute `stroke-dasharray` from `path.getTotalLength()`; animate `stroke-dashoffset` via CSS custom property | generate |
| 04 | Implement `clearAllAnimations(elements)` to remove all arch CSS classes before applying next step | edit |
| 05 | Wrap all animations in `@media (prefers-reduced-motion: no-preference)` — fall back to instant opacity change | edit |
| 06 | Cross-browser test on Chrome, Firefox, Safari (SVG filter support varies); add fallback for `feDropShadow` | test |

**Core animation patterns:**

```css
/* animations.css */

@keyframes arch-highlight {
  0%, 100% { filter: drop-shadow(0 0 4px var(--arch-highlight-color)); }
  50%       { filter: drop-shadow(0 0 12px var(--arch-highlight-color)); }
}

@keyframes arch-flow {
  to { stroke-dashoffset: 0; }
}

@keyframes arch-fade-in {
  from { opacity: 0.2; }
  to   { opacity: 1; }
}

@media (prefers-reduced-motion: no-preference) {
  .arch-highlighted { animation: arch-highlight 1.5s ease-in-out infinite; }
  .arch-flowing     { animation: arch-flow 1s linear forwards; }
}

@media (prefers-reduced-motion: reduce) {
  .arch-highlighted { opacity: 1; }
  .arch-flowing     { opacity: 1; }
}
```

> **Timing note:** `getTotalLength()` only works on rendered paths — the SVG must be in the DOM before animation is initialised. Call it inside a `useEffect` after the SVG renders.

---

### Agent 3.2 — Playback Agent

**Stack:** setInterval · usePlayback hook · keyboard shortcuts

| # | Task | Type |
|---|---|---|
| 01 | Implement play loop: `setInterval` advances `currentStep`; speed maps to 500ms / 1000ms / 2000ms per step | generate |
| 02 | Build `Toolbar` component: Play/Pause, Prev, Next, speed selector, loop toggle | generate |
| 03 | Add keyboard shortcuts: `Space` = play/pause, `←` = prev step, `→` = next step, `L` = toggle loop | generate |
| 04 | Show step label in a floating overlay on the canvas during playback; fade in/out between steps | generate |
| 05 | Write Vitest tests for the playback state machine: play → pause → next → loop boundary conditions | test |

**Speed mapping:**

| Setting | ms per step |
|---|---|
| Slow | 2000ms |
| Normal | 1000ms |
| Fast | 500ms |

---

### Agent 3.3 — UX Polish Agent

**Stack:** CSS custom properties · localStorage · Lighthouse · axe-core

| # | Task | Type |
|---|---|---|
| 01 | Implement CSS custom property theme system: Default, Dark, High-Contrast, Colorblind-Friendly; toggle via `body` class | generate |
| 02 | Store theme preference in `localStorage`; respect `prefers-color-scheme` on first visit | edit |
| 03 | Build onboarding overlay (5 steps): shown on first visit, state in `localStorage`, skippable via Escape | generate |
| 04 | Make layout responsive: stack canvas and step panel vertically on viewports < 768px | edit |
| 05 | Audit Lighthouse accessibility score; fix all axe-core violations; ensure full keyboard nav | test |

**Phase 3 agent dependencies:**

```
Animation Agent → Canvas Agent (needs data-arch-id from Phase 2)
Playback Agent → Animation Agent (calls applyStepAnimation and clearAllAnimations)
UX Polish Agent → runs in parallel with Animation + Playback
```

---

## Phase 4 — Export & Share (Post-MVP)

**Goal:** Add GIF export, hash-based shareable URLs, and a client-side auto-animation suggester. All three agents can run in parallel.

### Agent 4.1 — GIF Export Agent

**Stack:** gif.js · html2canvas · Blob download

| # | Task | Type |
|---|---|---|
| 01 | Bundle `gif.js` worker via Vite's `?url` import; configure `workers: 2`, `quality: 10`, `width/height` from canvas bounds | infra |
| 02 | For each step: apply animation → wait for transition end → `html2canvas(svgContainer)` → add frame to GIF encoder | generate |
| 03 | Show progress bar during encoding (gif.js emits progress events); disable UI controls during export | generate |
| 04 | Cap export at 20 steps; warn user if exceeded; offer to truncate or export a custom range | edit |
| 05 | Fallback: if html2canvas fails on complex SVG filters, offer per-step PNG frame download instead | edit |
| 06 | Test on 3 real draw.io SVG exports; measure export time and validate output GIF in multiple viewers | test |

> **Known risk:** `html2canvas` has limited support for SVG `filter` effects and external fonts. Budget time for the PNG-frames fallback path — treat it as a first-class feature, not an afterthought.

---

### Agent 4.2 — Share Link Agent

**Stack:** fflate · URL hash · navigator.clipboard · zod

| # | Task | Type |
|---|---|---|
| 01 | Implement `encodeProject(state)`: JSON.stringify → `fflate.deflateSync` → base64 → write to `window.location.hash` | generate |
| 02 | Implement `decodeProject(hash)` on page load: base64 decode → `fflate.inflateSync` → JSON.parse → validate with zod → dispatch `SET_PROJECT` | generate |
| 03 | Pre-encode check: warn user if serialised payload exceeds 6KB before compression; suggest simplifying SVG | edit |
| 04 | Add "Copy link" button in Toolbar; show a toast confirming URL was copied via `navigator.clipboard` | generate |
| 05 | Test round-trip encode/decode for 10 projects of varying sizes; verify hash survives URL shorteners | test |

**Encode/decode pattern:**

```ts
import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';

export function encodeProject(state: ProjectState): string {
  const json = JSON.stringify(state);
  const compressed = deflateSync(strToU8(json));
  return btoa(String.fromCharCode(...compressed));
}

export function decodeProject(b64: string): ProjectState {
  const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const json = strFromU8(inflateSync(binary));
  return projectSchema.parse(JSON.parse(json)); // zod validation
}
```

**URL format:**

```
https://yourusername.github.io/archpulse/#<base64-encoded-compressed-json>
```

> **URL length limit:** Most browsers support ~8,000 character URLs. Warn users at 6KB serialised (pre-compression) to leave headroom. For large diagrams, the `.archpulse.json` project file remains the primary sharing method.

---

### Agent 4.3 — Auto-Animation Agent

**Stack:** BFS graph traversal · adjacency list · step suggestion UI

| # | Task | Type |
|---|---|---|
| 01 | Build `buildAdjacencyList(elements)`: detect edge endpoints by proximity heuristic (nearest node centroid within 20px) | arch |
| 02 | Implement `suggestSteps(adjacencyList)`: BFS from highest-degree node; each traversal hop = one animation step (highlight node, then flow edge) | generate |
| 03 | Expose "Auto-animate" button in Toolbar; show suggested steps in a preview modal before applying | generate |
| 04 | Allow user to accept, reject, or selectively keep individual suggested steps before committing | edit |
| 05 | Write unit tests for `suggestSteps` against known topologies: linear chain, hub-and-spoke, ring, fully disconnected | test |

**Phase 4 agent dependencies:**

```
GIF Export → Phase 3 Animation Agent (needs CSS animation classes to be stable)
Share Link → Save/Load Agent (shares the zod project schema)
Auto-Animation → SVG Ingestion Agent (needs element registry)
All three Phase 4 agents → can run in parallel with each other
```

---

## Full Dependency Graph

```
Phase 1
├── Scaffold Agent
│   ├── → CI/CD Agent
│   └── → State Model Agent
│           └── → ALL Phase 2 agents
│
Phase 2 (starts after State Model Agent)
├── SVG Ingestion Agent
│   └── → Canvas Agent
├── Step Panel Agent       (parallel with Canvas)
└── Save/Load Agent        (runs last in Phase 2)
│
Phase 3 (starts after Phase 2)
├── Animation Agent
│   └── → Playback Agent
└── UX Polish Agent        (parallel with Animation + Playback)
│
Phase 4 (starts after Phase 3)
├── GIF Export Agent       (parallel)
├── Share Link Agent       (parallel)
└── Auto-Animation Agent   (parallel)
```

---

## Task Type Reference

| Label | Meaning |
|---|---|
| `generate` | Create new file or function from scratch |
| `edit` | Refine, extend, or constrain existing code |
| `test` | Write or run tests; validate correctness |
| `arch` | Architecture decision; no code produced directly |
| `infra` | Tooling, config, CI, environment setup |

---

## Agent Prompt Templates

Use these as starting prompts when kicking off each agent session.

### Phase 1

```
Write the full vite.config.ts for ArchPulse with GitHub Pages base path '/archpulse/'
and vite-plugin-pwa configured for offline support.
```

```
Write the GitHub Actions deploy.yml for ArchPulse that builds with Vite and deploys
dist/ to the gh-pages branch using peaceiris/actions-gh-pages@v4.
```

```
Define all TypeScript types for ArchPulse in types/index.ts: ArchElement, AnimationStep,
ProjectState, PlaybackState. Then implement useProjectReducer with all actions and Vitest tests.
```

### Phase 2

```
Write parseSVG(svgString) for ArchPulse using DOMParser. Classify rect/circle/ellipse/g
as nodes and path/line/polyline as edges. Stamp data-arch-id on each element and return
a Map<string, ArchElement>. Include Vitest tests for 5 SVG fixtures.
```

```
Build the SVGCanvas React component for ArchPulse. Render the SVG via dangerouslySetInnerHTML.
Attach a delegated click listener that walks up to data-arch-id and dispatches ASSIGN_ELEMENT.
Apply arch-selected class via CSS only — never modify the SVG string source.
```

```
Build the StepList component for ArchPulse using @dnd-kit/sortable. Each step card shows
its number, an inline-editable label, assigned element count, and a delete button.
On drag-end dispatch REORDER_STEPS with the new index array.
```

```
Implement exportProject and importProject for ArchPulse. Export as .archpulse.json using
Blob + URL.createObjectURL. Import with FileReader and validate with zod. Add localStorage
autosave debounced at 500ms.
```

### Phase 3

```
Write animations.css for ArchPulse with: arch-highlight (glow pulse keyframe),
arch-flow (stroke-dashoffset keyframe), arch-fade-in. Wrap all animations in
prefers-reduced-motion: no-preference. Implement applyStepAnimation and clearAllAnimations.
```

```
Build the ArchPulse Toolbar component with Play/Pause, Prev, Next, speed selector
(slow/normal/fast mapped to 2000/1000/500ms), and loop toggle. Add keyboard shortcuts:
Space = play/pause, ← → = step navigation, L = loop toggle.
```

```
Implement the ArchPulse theme system using CSS custom properties. Themes: Default, Dark,
High-Contrast, Colorblind-Friendly. Toggle via body class. Persist in localStorage and
respect prefers-color-scheme on first visit.
```

### Phase 4

```
Implement GIF export for ArchPulse using gif.js (bundled via Vite ?url import) and
html2canvas. Show a progress bar during encoding. Cap at 20 steps. Add a PNG frame
download fallback for when html2canvas fails on complex SVG filters.
```

```
Implement encodeProject and decodeProject for ArchPulse using fflate deflateSync/inflateSync
and URL hash storage. Add a 6KB pre-compression size guard with a user warning. Add a
"Copy link" button that writes to navigator.clipboard and shows a toast.
```

```
Implement buildAdjacencyList and suggestSteps for ArchPulse. Use a proximity heuristic
(nearest node centroid within 20px) to detect edge endpoints. BFS from the highest-degree
node; each hop becomes one AnimationStep. Show results in a preview modal before applying.
Write Vitest unit tests for linear, hub-and-spoke, ring, and disconnected graph topologies.
```

---

*ArchPulse Agent Implementation Plan — Revision 1.0*
*Companion to: ArchPulse PRD Revision 2.0 (GitHub Pages Edition)*