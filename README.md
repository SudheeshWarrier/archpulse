# ArchPulse

ArchPulse is a client-side SVG animation editor that converts static architecture diagrams into step-by-step walkthroughs.

## Getting started

```bash
npm install
npm run dev
```

Then open the local Vite preview at `http://localhost:5173`.

## Features implemented so far

- SVG upload with drag-and-drop support
- Element detection and step assignment
- Step list UI with item counts and expandable element details
- Playback controls with play/pause, step navigation, speed, and loop
- Export/import project support using `.archpulse.json`
- CSS animation framework with highlight classes
- Static project-ready layout and GitHub Pages-friendly build

## Sample assets

A starter SVG is available at `samples/sample-diagram.svg`.

## Notes

This project is designed to run fully in a browser with no backend. If Node is unavailable in your environment, the app can also be previewed using a static server on the `site/` folder:

```bash
python -m http.server --directory site 8000
```

Then open `http://localhost:8000`.
