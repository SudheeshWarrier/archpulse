# ArchPulse — Product Requirements Document (PRD)
**Revision:** 2.0 — GitHub Pages Static Hosting Edition

---

## 1. Overview

**Product Name:** ArchPulse

**Tagline:** Turn static architecture diagrams into animated, step-by-step visual flows.

**Hosting Constraint:** Fully static deployment on GitHub Pages — zero backend, zero server-side logic, zero build-time secrets.

**Summary:**
ArchPulse is a client-side web tool that allows users to upload SVG diagrams (e.g., exported from draw.io) and convert them into animated, interactive walkthroughs. It enables developers, architects, and educators to visually explain system behavior using timeline-based animations.

> **Hosting Lock-in Note:** This PRD is scoped exclusively to GitHub Pages static hosting. All features must be implementable using only HTML, CSS, vanilla JS, or a bundled React/Vite SPA (pre-built and committed to the `gh-pages` branch or `docs/` folder). No Vercel, no serverless functions, no external APIs, no databases.

---

## 2. Goals

### Primary Goals

- Enable users to animate static architecture diagrams
- Provide a simple step-based animation editor
- Allow saving and re-editing animation projects
- Deliver a visually impressive demo experience in < 10 seconds

### Secondary Goals

- Export animations as GIF (client-side only, via `gif.js`)
- Provide auto-generated animation suggestions (client-side graph traversal only)
- Build a strong open-source portfolio project

---

## 3. Non-Goals (MVP)

- No `.drawio` file parsing (SVG only)
- No real-time collaboration
- No complex animation timeline (keep simple steps)
- No backend, server, or cloud storage of any kind
- No user accounts or authentication
- No CDN-hosted assets at runtime (all dependencies bundled at build time)

---

## 4. Target Users

### Primary Users

- Software engineers
- Solution architects
- DevRel / technical content creators
- Students preparing for system design interviews

### Use Cases

- Explaining architecture in presentations
- Creating demo visuals for products
- Teaching system design concepts
- Documenting system flows

---

## 5. Core Features (MVP)

### 5.1 SVG Upload

- Upload SVG exported from draw.io or similar tools via `<input type="file" accept=".svg">`
- Read file contents with the browser's `FileReader` API (no server upload needed)
- Render SVG inline in the browser DOM
- Parse SVG elements using the browser's built-in `DOMParser`

**GitHub Pages Compatibility:** ✅ Fully client-side. No upload endpoint needed.

---

### 5.2 Element Detection

- Identify clickable elements: nodes (`rect`, `circle`, `<g>` groups) and edges (`path`, `line`, `polyline`)
- Assign unique IDs to elements using a stable hashing strategy (e.g., index + tag + position)
- Treat `<g>` groups as a single selectable node (resolves Open Question #2)

**GitHub Pages Compatibility:** ✅ Pure DOM traversal, no server required.

---

### 5.3 Animation Editor (Step-Based)

#### Step Model

```json
{
  "steps": [
    { "id": "step-1", "highlight": ["node-1"], "label": "API Gateway receives request" },
    { "id": "step-2", "flow": ["node-1→node-2"], "label": "Routes to Auth Service" }
  ]
}
```

#### Features

- Add / remove / reorder steps (drag-and-drop via HTML5 Drag API or a lightweight library like `Sortable.js`, bundled at build time)
- Click SVG elements to assign them to the currently selected step
- Label each step with a short description (shown in a step panel)
- Each step supports: highlight nodes, animate edges, or both

**GitHub Pages Compatibility:** ✅ All UI state held in React/JS memory.

---

### 5.4 Animation Types

#### Node Animations (CSS + JS)

- **Highlight:** CSS `box-shadow` / SVG `filter: drop-shadow()` glow effect
- **Scale pulse:** CSS `transform: scale()` keyframe
- **Fade in/out:** CSS `opacity` transition

#### Edge Animations (CSS + JS)

- **Flow animation:** SVG `stroke-dashoffset` animation (CSS keyframes)
- **Directional pulse:** Animating a small marker along the path using `stroke-dasharray` offset

All animations use CSS custom properties and `requestAnimationFrame` — no canvas, no WebGL, no external animation runtime.

**GitHub Pages Compatibility:** ✅ Pure CSS/JS animations.

---

### 5.5 Playback Controls

- Play / Pause
- Next step / Previous step
- Loop toggle
- Speed control: slow (2s/step), normal (1s/step), fast (0.5s/step)

Implemented as a simple JS state machine — no media API required.

**GitHub Pages Compatibility:** ✅ Pure JS.

---

### 5.6 Project Save & Load

#### File Format: `.archpulse.json`

```json
{
  "version": "1.0",
  "svg": "<svg>...</svg>",
  "steps": [
    { "id": "step-1", "highlight": ["node-1"], "flow": [], "label": "Step description" }
  ]
}
```

#### Save (Download)

Use `Blob` + `URL.createObjectURL()` + a programmatically clicked `<a download>` element to trigger a browser download. No server involved.

```js
const blob = new Blob([JSON.stringify(project)], { type: "application/json" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url; a.download = "my-diagram.archpulse.json"; a.click();
URL.revokeObjectURL(url);
```

#### Load (Upload)

Use `<input type="file" accept=".json">` + `FileReader` to parse and restore state.

**GitHub Pages Compatibility:** ✅ Blob download and FileReader are standard browser APIs.

---

## 6. Future Features (Post-MVP)

### 6.1 Auto Animation (Client-Side Graph Traversal)

- Parse the SVG's node/edge structure into an adjacency list in memory
- Run a BFS/DFS traversal client-side to suggest a step sequence
- User can accept or edit the suggestion

**Constraint:** No AI/ML API calls. Pure graph algorithm in JS.
**GitHub Pages Compatibility:** ✅

---

### 6.2 GIF Export (Client-Side Only)

- Use [`gif.js`](https://github.com/jnordberg/gif.js) (MIT licensed, bundled at build time)
- Capture each animation frame using `html2canvas` (also bundled)
- Encode frames client-side into a downloadable `.gif` file using the same `Blob` + download anchor approach as project save

**Constraint:** GIF encoding is CPU-intensive. Set a maximum step count (e.g., 20 steps) to prevent browser freezes. Show a progress indicator during encoding.

**GitHub Pages Compatibility:** ✅ Both `gif.js` and `html2canvas` run entirely in the browser.

> ⚠️ **Risk:** SVG-to-canvas rendering via `html2canvas` has known limitations with complex SVG filters and external fonts. Test with representative diagrams. Fallback: offer PNG frame-by-frame download as an alternative.

---

### 6.3 Shareable Links (URL Hash State — No Backend)

**Revised approach** (original PRD assumed a backend URL store — not viable on GitHub Pages):

- Serialize the full project JSON → compress with `fflate` (a pure-JS zlib library, bundled) → base64-encode → store in the URL hash (`window.location.hash`)
- On page load, if a hash is present, decode → decompress → restore project state

```
https://yourusername.github.io/archpulse/#<base64-encoded-compressed-json>
```

**Constraint:** GitHub Pages URLs support hash fragments natively. URL length limit is ~8,000 characters in most browsers, which limits diagram + step complexity. Display a warning if the serialized state exceeds ~6KB before encoding.

**GitHub Pages Compatibility:** ✅ No server required. Hash routing works on static hosts.

> ⚠️ **Risk:** Large SVGs will produce URLs too long to share reliably. Mitigation: warn users, encourage them to simplify SVGs before sharing, and offer project file download as the primary sharing method.

---

### 6.4 Advanced Timeline

- Per-step duration slider (0.25s – 5s)
- Parallel animations within a single step (multiple nodes/edges highlighted simultaneously)
- Delay offset per element within a step

Implemented as extensions to the step data model. All timing driven by JS `setTimeout`/`requestAnimationFrame` — no external scheduler needed.

**GitHub Pages Compatibility:** ✅

---

### 6.5 Theme Support

- Highlight color picker (stored in project JSON)
- Preset themes: Default, Dark, High-Contrast, Colorblind-Friendly
- CSS custom properties drive all theme colors — theme switching is a single class toggle on `<body>`

**GitHub Pages Compatibility:** ✅

---

## 7. UX Flow

### Initial Flow

1. User lands on GitHub Pages site
2. Uploads SVG via file picker (or drags and drops onto canvas area)
3. Diagram renders instantly inline
4. User clicks elements to assign them to steps in the step panel
5. Press "Play" → animation runs step by step

### Editing Flow

1. Select a step in the step panel
2. Click nodes/edges in the diagram to assign/remove them from that step
3. Preview individual step or play full animation
4. Save project as `.archpulse.json` to disk

### Resume Flow

1. User uploads `.archpulse.json` on return visit
2. SVG and all steps are restored from file
3. Continue editing or replay animation

---

## 8. Technical Architecture

### Frontend Stack

| Concern | Technology |
|---|---|
| Framework | React 18 + Vite (output: static `dist/`) |
| SVG Parsing | Browser `DOMParser` |
| Animation | CSS keyframes + `requestAnimationFrame` |
| Drag-and-drop step reordering | `@dnd-kit/core` (bundled) |
| GIF export (Post-MVP) | `gif.js` + `html2canvas` (bundled) |
| URL compression (Post-MVP) | `fflate` (bundled) |
| State management | React `useState` / `useReducer` (no Redux needed for MVP) |
| Build | `vite build` → static `dist/` folder |
| Deploy | GitHub Actions → push `dist/` to `gh-pages` branch |

### State Shape

```js
{
  svg: string,              // Raw SVG markup
  elements: Map<id, { type: "node"|"edge", domRef }>,
  steps: [
    { id, label, highlight: [elementId], flow: [edgeId], durationMs: 1000 }
  ],
  playback: { active: bool, currentStep: number, speed: "slow"|"normal"|"fast" },
  theme: "default" | "dark" | "high-contrast"
}
```

### SVG Parsing Strategy

- Use `DOMParser` to parse uploaded SVG string into a document
- Walk the DOM, collecting `<g>`, `<rect>`, `<circle>`, `<ellipse>` → classified as **nodes**
- Collect `<path>`, `<line>`, `<polyline>` → classified as **edges**
- Assign `data-archpulse-id` attributes to each detected element for selection tracking
- Do **not** modify the original SVG string; maintain a separate element registry in JS

### Deployment Pipeline (GitHub Actions)

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

**GitHub Pages Compatibility:** ✅ Standard Vite + GitHub Actions pattern. Free tier supports unlimited public repo deployments.

---

## 9. Constraints

| Constraint | Detail |
|---|---|
| No backend | All logic in browser. No API calls, no database, no server-side rendering. |
| No runtime CDN dependencies | All JS/CSS dependencies bundled by Vite at build time. No `<script src="https://...">` at runtime. |
| No user accounts | No auth, no sessions, no cookies beyond localStorage for ephemeral UI preferences. |
| No SVG mutation | Animation logic must layer effects via CSS classes/filters on top of the SVG — never rewrite the SVG source. |
| Large SVG handling | SVGs > 2MB should show a warning. The app should not freeze; use `requestIdleCallback` for parsing if needed. |
| URL share limit | Hash-encoded share links are capped at ~6KB serialized before compression. Warn users when exceeded. |

---

## 10. Success Criteria

### Qualitative

- "Wow" factor within first interaction
- Easy to understand without a tutorial
- Shareable demo quality output

### Quantitative (Optional)

- GitHub stars ⭐
- Demo usage (tracked via privacy-respecting analytics, e.g., Plausible with a free self-hosted or cloud plan — no server required on the ArchPulse repo itself)
- Community feedback / issues filed

---

## 11. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Complex SVG structures break element detection | Medium | Provide a "manual select" fallback where users click and label elements themselves |
| GIF export fails on complex SVGs (html2canvas limitations) | High | Clearly mark as beta; offer "Export PNG frames" as fallback |
| Share URLs too long for large diagrams | High | Warn at ~6KB; default sharing method is project file download |
| Users confused by step creation UX | Medium | Add an interactive onboarding overlay on first load (state stored in `localStorage`) |
| Performance on large SVGs (>500 elements) | Medium | Virtualize the element list; debounce click handlers |

---

## 12. Open Questions — Resolved

| Question | Resolution |
|---|---|
| How to best detect node vs edge reliably? | Classify by SVG tag: `rect/circle/ellipse/g` → node; `path/line/polyline` → edge. Expose a manual override in the UI. |
| Should `<g>` groups be treated as single nodes? | Yes. Treat each top-level `<g>` as one selectable node. Children are not individually selectable in MVP. |
| What is the simplest UX for step creation? | Click an element in the diagram → it's added to the currently selected step. No modal or form required. |
| Can we do shareable links without a backend? | Yes — URL hash + `fflate` compression. Cap at ~6KB. Project file download is the primary sharing method. |

---

## 13. Roadmap

### Phase 1 — MVP (2–3 weeks)

- [ ] Vite + React scaffold deployed to GitHub Pages via GitHub Actions
- [ ] SVG upload + inline render
- [ ] Element detection + click-to-select
- [ ] Step editor (add / remove / reorder)
- [ ] CSS animations (highlight, edge flow)
- [ ] Playback controls
- [ ] Save / load `.archpulse.json`

### Phase 2 — Polish (2 weeks)

- [ ] Per-step labels shown during playback
- [ ] Speed control
- [ ] Theme support (dark mode)
- [ ] Onboarding overlay
- [ ] UX polish + responsive layout

### Phase 3 — Power Features

- [ ] GIF export (`gif.js` + `html2canvas`)
- [ ] URL hash share links (`fflate`)
- [ ] Auto-animation suggestions (BFS/DFS graph traversal)
- [ ] Advanced timeline (per-step duration, parallel animations)

---

## 14. Vision

ArchPulse aims to become the simplest way to:

> Explain complex systems visually through motion.

Not just a diagram tool, but a **diagram storytelling engine** — entirely free, open source, and running in any browser with zero installation.