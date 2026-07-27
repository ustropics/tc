# Model select checkboxes (CPL / UNCPL / SPRAY)

## Problem

The client shows WRF simulation output per storm, but a prior session already
restructured `images/<storm>/` into `cpl/`, `spray/`, `uncpl/` subfolders and
hardcoded every catalog path to `uncpl`. There is no UI to pick a model. This
adds one: three mutually-exclusive checkboxes (CPL / UNCPL / SPRAY) placed
next to the existing Wind Vectors / Radial Rings overlay checkboxes, one set
per viewer (primary, compare, single). CPL is the default.

## Scope

In scope:
- Add model radio-styled controls to the three overlay-controls blocks in
  `index.html` (primary, compare/secondary, single).
- Add per-viewer `model` state to `overlayState` in `js/app.js`, default
  `'cpl'`, reset to `'cpl'` on storm change.
- Wire the selected model into image URL generation (`{model}` placeholder).
- Update `catalog_2d.json` entries that have `hasOverlays: true` to use
  `{model}` instead of hardcoded `uncpl`.

Out of scope:
- `catalog_3d.json`, `catalog_diag.json`, `catalog_analysis.json`, and any
  `catalog_2d.json` entry with `hasOverlays: false` — these only have
  `uncpl` data on disk today. They keep the hardcoded `uncpl` path.
- Track map (`trackmap.js`) / sidebar diagnostics — these stay tied to the
  globally selected storm, not per-viewer model. Unrelated to this change.
- Backfilling missing cpl/spray data (see Known Gap below).
- Any other in-flight/unrelated WIP in this repo (e.g. Harvey multi-storm
  support already touched in `trackmap.js`/`app.js`).

## Why per-view, not global

CPL/UNCPL/SPRAY is treated the same way Wind Vectors/Radial Rings already
are: a per-viewer overlay control. This lets primary and compare show
different models side by side (e.g. CPL vs UNCPL comparison), which is a
natural use of the existing dual-view layout.

## Design

### State (`js/app.js`)

`overlayState` gains a third key per viewer:

```js
let overlayState = {
    primary: { wind: false, rings: false, model: 'cpl' },
    compare: { wind: false, rings: false, model: 'cpl' },
    single:  { wind: false, rings: false, model: 'cpl' }
};
```

Reset to `model: 'cpl'` wherever `overlayState` is currently reset to its
initial shape (storm change in `selectStorm`).

### Markup (`index.html`)

Reuse the existing checkbox markup/classes exactly
(`.overlay-checkbox`, `.overlay-input`, `.overlay-check`, `.overlay-label`)
but with `type="radio"` and a shared `name` per viewer so the browser
enforces single-selection natively — no custom JS toggle logic needed. The
CSS already fully hides the native input (`display: none`) and renders
`.overlay-check` as a custom square, so radio vs checkbox is visually
identical.

Added inside each `overlay-controls-*` block, alongside Wind Vectors /
Radial Rings:

```html
<label class="overlay-checkbox">
    <input type="radio" name="model-1" id="model-cpl-1" class="overlay-input" checked>
    <span class="overlay-check"></span>
    <span class="overlay-label">CPL</span>
</label>
<label class="overlay-checkbox">
    <input type="radio" name="model-1" id="model-uncpl-1" class="overlay-input">
    <span class="overlay-check"></span>
    <span class="overlay-label">UNCPL</span>
</label>
<label class="overlay-checkbox">
    <input type="radio" name="model-1" id="model-spray-1" class="overlay-input">
    <span class="overlay-check"></span>
    <span class="overlay-label">SPRAY</span>
</label>
```

Repeated for `-2` (compare) and `-single`, each with its own `name`
(`model-2`, `model-single`) so the three viewer groups don't cross-interfere.

No new CSS needed.

### Visibility

Model controls are shown/hidden by the exact same condition that already
governs wind/rings visibility in `updateOverlayControlsVisibility`
(`productConfig.hasOverlays`). Verified this lines up with what's actually
on disk: every `hasOverlays: true` product has `cpl/spray/uncpl` image
trees; every `hasOverlays: false` product (3D, diagnostics, cross-sections,
streamlines, analysis) only has `uncpl` data. No new per-product metadata
needed — same container, same gate.

### Catalog (`json/catalog_2d.json`)

For every entry with `hasOverlays: true`, replace the hardcoded `uncpl`
path segment with `{model}`, e.g.:

```
"base": "images/{storm}/uncpl/eflx_sfc_min/{storm}_eflx_sfc_min_{frame}.png"
→
"base": "images/{storm}/{model}/eflx_sfc_min/{storm}_eflx_sfc_min_{frame}.png"
```

Applied to all four pattern keys (`base`, `wind`, `rings`, `full`) on each
affected entry.

### Image generation (`js/app.js`)

`generateImageArray(productConfig, stormName, viewerType)` adds a
`{model}` substitution sourced from `overlayState[viewerType].model`:

```js
.replace(/{model}/g, overlayState[viewerType].model)
```

placed alongside the existing `{storm}`/`{frame}` replacements.

### Event wiring

New radio `change` listeners for each of the 9 new inputs (3 models × 3
viewers), mirroring the existing wind/rings listeners: on change, set
`overlayState[viewerType].model` and reload the current product's images
for that viewer (same call path the wind/rings handlers already use).

## Known gap (not fixed by this change)

CPL/SPRAY data is incomplete for the "Wind Speed (10m)" product's overlay
variants: `wind_sfc_min` and `wind_full` exist under `cpl/`/`spray/`, but
`wind_min`, `wind_winds`, `wind_rings` do not (only generated under
`uncpl/` so far). Selecting CPL or SPRAY for that product with the
Wind-Vectors-only or Radial-Rings-only overlay combination will 404 until
those are regenerated (main repo, `scripts/2d/plt_wind_min.py`,
`plt_wind_rings.py`, `plt_wind_winds.py`, run against the CPL/SPRAY WRF
files). Every other `hasOverlays: true` product has full cpl/spray/uncpl
parity today.

## Testing

Manual, since this is a no-build static site:
- Load app, confirm CPL is checked by default in all three overlay-controls
  blocks whenever they're visible.
- Select a `hasOverlays: true` product in primary view, toggle
  CPL/UNCPL/SPRAY, confirm image path changes and image loads.
- Do the same independently in compare (secondary) and single view;
  confirm one viewer's model selection doesn't affect another's.
- Switch storm, confirm all three reset to CPL.
- Select a `hasOverlays: false` product (e.g. a 3D or diagnostic view),
  confirm no model controls appear.
- Confirm combining model selection with wind/rings overlay toggles
  produces the correct `{model}`+pattern-key combined path.
