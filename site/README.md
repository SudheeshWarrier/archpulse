ArchPulse — static site demo

This folder contains a minimal static HTML preview demonstrating the `samples/base.css` color tokens.

Preview locally with Python's simple HTTP server:

```bash
# from the repo root
python -m http.server --directory site 8000
# then open http://localhost:8000
```

Next steps:
- Scaffold the Vite + React app as described in docs/plan.md
- Implement SVG upload and parsing components
- Wire styles to use CSS custom properties from samples/base.css
