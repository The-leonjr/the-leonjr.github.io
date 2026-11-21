# Leon Jr Chua · Portfolio

Live: https://the-leonjr.github.io/

A React + Vite site. The homepage hero is a ShaderGradient background that moves like watercolour when the cursor passes through it, with the original three-band knot in the middle and the six project cards orbiting it in 3D (React Three Fiber). Below the hero: the projects in three pairs, an About section with the knot drawn in ASCII characters, and contact details. Every project has its own page at `/work/<id>`.

## Run it

```
npm install
npm run dev
```

`npm run build` writes the site to `dist/`, including a page per project (with its own link-preview tags) and a `404.html`.

## Where things live

| What | File |
|---|---|
| All text, links and project data | `src/data/projects.js` |
| Watercolour hero background | `src/components/WaterBackground.jsx` |
| 3D card sphere and knot | `src/components/CardSphere.jsx`, `src/three/knot.js` |
| ASCII knot (About and 404) | `src/components/AsciiKnot.jsx` |
| Styles and colours | `src/styles.css` |
| Per-project pages and 404 at build time | `scripts/spa-fallback.mjs` |

### Tuning the water

At the top of `WaterBackground.jsx`:

- `LEFT` / `RIGHT`: the two watercolour palettes (cursor on the left half vs the right half)
- `DECAY`: how long the colour takes to settle after being pushed (closer to 1 = slower)
- `PUSH`: how far the cursor shoves the colour
- `CURSOR_LAG`: how far the stir point trails behind the cursor
- `COLOUR_FADE`: how slowly one palette washes into the other

## Deploying

`.github/workflows/deploy.yml` builds and publishes on every push to `main`. One-time setup: in the repository's Settings → Pages, set Source to "GitHub Actions".

Bundled font notices are in `FONT-LICENSES.txt`.
