# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static web application for visualizing Tropical Cyclone Rapid Intensification (RI) case studies, hosted at weathercanvas.com. No build step required — serve `index.html` directly.

## Running Locally

```bash
python3 -m http.server
# or
npx http-server
```

The thumbnail generation utility (requires Playwright):
```bash
pip install playwright && playwright install chromium
python3 generate_3d_thumbnails.py
```

## Architecture

The app is a single-page application built with vanilla JS, Leaflet.js, and no bundler.

**Entry point:** `index.html` — contains all UI markup; loads `js/app.js` and `js/trackmap.js`.

**`js/app.js`** — main controller managing:
- Global state: `catalog`, `images1/images2`, `current` frame, playback, `selectedStorm/Product1/Product2`
- Frame animation loop (play/pause/speed/loop)
- Dual/single/compare view switching
- Overlay compositing (base + wind + rings PNG layers stacked via CSS `position: absolute`)
- Product dropdown rendering from `catalog.json`
- Exposes `window.catalog` for use by `trackmap.js`

**`js/trackmap.js`** — Leaflet map module managing:
- Interactive storm track with colored markers (intensity-based)
- Track filter buttons using diagnostic fields defined in `FILTERS` object
- Sidebar panel showing 2D product frames or diagnostics for a selected track point
- `window.sidebar2DFilters` Set used to filter sidebar product list by tag

**`json/catalog.json`** — product registry. Each entry under a storm name defines:
- `type`: `"2d"` or `"3d"`
- `patterns`: URL templates using `{storm}` and `{frame}` substitution
- `frameStart` / `frameEnd`: valid frame range
- `filters`: array of tag strings used to filter the sidebar product list
- `hasOverlays`: whether wind/rings overlay buttons apply

**`json/ian.json`** — per-timestep track data (frames 50–72) with `datetime`, pressure/eyewall center coordinates, `offset_km`, and `diagnostics` (pressure, enthalpy, latent heat, sensible heat fluxes).

**`css/`** — split into `core.css` (CSS variables, theme), `components.css`, `layout.css`, `map.css`.

## Adding a New Storm

1. Add an entry in `json/catalog.json` under a new storm key with product definitions.
2. Create a new `json/<storm>.json` track data file matching the `ian.json` schema.
3. Add image assets under `images/<storm>/`.
4. The storm selector in `app.js` reads storm names from `catalog.json` keys.

## Adding a New Product

Add an entry inside the storm key in `catalog.json`. If `hasOverlays: true`, provide `wind`, `rings`, and `full` pattern keys in addition to `base`. The `filters` array tags control which filter buttons in the sidebar surface the product.
