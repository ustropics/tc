# Add new gallery content: 4 frame-sequence 2D products + Analysis section for static summary plots

## Background

Several visualization scripts in `ms-proj/` already have rendered output that isn't wired into the web client (`client/json/catalog.json`). Two categories:

1. **Frame-sequence 2D products** — fit the existing animation-viewer model directly (23 PNGs, frames 50–72, no overlay variants).
2. **Static summary plots** — storm-wide analysis charts (bar/heatmap/timeseries), one or a handful of fixed images per product, no frame animation. The current site has no content type for this.
3. **`tke_3d`** — 3D isosurface, but only 1 frame (70) rendered out of the 50–72 range; doesn't fit the existing 3D viewer's frame-loop assumption.

## Part 1 — Frame-sequence 2D products (no code changes)

Add 4 new entries under `"Ian"` in `client/json/catalog.json`, identical in shape to the existing `"Enthalpy Radial Profile (Azimuthal)"` entry (`type: "2d"`, `hasOverlays: false`, single `base` pattern, `frameStart: 50`, `frameEnd: 72`).

| Catalog key | Source dir (ms-proj/figures) | Filters |
|---|---|---|
| Quadrant Radial Enthalpy Flux | `eflx_rad_quad` | `["fluxes", "radial"]` |
| Radial Correlation (Enthalpy Flux) | `eflx_radial_corr` | `["fluxes", "radial"]` |
| Inflow Layer / Surface Comparison | `inflow_layer_surface_compare` | `["radial", "cross-sections"]` |
| Enthalpy Flux Diagnostic Panel | `eflx_diagnostic` | `["fluxes"]` |

Assets get copied from `ms-proj/figures/<dir>/` into `client/images/ian/<dir>/`, filenames unchanged (they already match `{storm}_{product}_{frame}.png` shape). No `js/app.js` or CSS changes — these flow through the existing 2D viewer machinery untouched.

## Part 2 — Analysis section (new content type + new UI)

### Asset placement

Copy the relevant PNGs (skip `.csv` companions — those are data exports, not display assets) from `ms-proj/figures/<dir>/` into `client/images/ian/analysis/<dir>/`.

### New catalog schema: `type: "static"`

For grouped image galleries — a product that's a fixed set of related charts rather than a frame sequence:

```json
"Quadrant Statistics": {
  "type": "static",
  "filters": ["fluxes", "quadrant"],
  "titlePattern": "{storm} Quadrant Statistics",
  "images": [
    { "src": "images/{storm}/analysis/eflx_quad_stats/{storm}_eflx_quad_stats_bar.png", "label": "Bar Chart" },
    { "src": "images/{storm}/analysis/eflx_quad_stats/{storm}_eflx_quad_stats_heatmap.png", "label": "Heatmap" },
    { "src": "images/{storm}/analysis/eflx_quad_stats/{storm}_eflx_quad_stats_timeseries.png", "label": "Timeseries" }
  ]
}
```

`{storm}` substituted same as existing patterns (lowercased for path, original case for title).

### New catalog schema: `type: "static-3d"`

For `tke_3d` — single fixed-frame interactive embed, reuses the existing 3D iframe viewer machinery but with a hardcoded frame number instead of a frame loop:

```json
"TKE Isosurface (3D)": {
  "type": "static-3d",
  "filters": [],
  "titlePattern": "{storm} TKE Isosurface",
  "pattern": "images/{storm}/analysis/tke_3d/{storm}_tke_3d_70.html",
  "staticImage": "images/static/3d/3d_tke.png"
}
```

`images/static/3d/3d_tke.png` doesn't exist yet (the other `3d_*` placeholders do). Needs to be generated — either via `generate_3d_thumbnails.py` against the rendered `tke_3d` HTML, or a manual screenshot/crop — before this entry will render correctly.

### The 7 Analysis cards

| Catalog key | Type | Source dir | Images in group | Filters |
|---|---|---|---|---|
| Hovmöller Diagram (Track-Relative) | static | `eflx_hovmoller_track_relative` | 1 (inward flux) | `["fluxes", "diagnostics"]` |
| Quadrant Statistics | static | `eflx_quad_stats` | 3 (bar, heatmap, timeseries) | `["fluxes", "quadrant"]` |
| Quadrant Stats — Radius Bins | static | `eflx_quad_stats_bins` | 9 (4 bar + 4 timeseries + 1 heatmap, by km bin) | `["fluxes", "quadrant", "radial"]` |
| Quadrant Stats — RMW Bins | static | `eflx_quad_stats_bins_rmw` | 9 (4 bar + 4 timeseries + 1 heatmap, by RMW bin) | `["fluxes", "quadrant", "radial"]` |
| Quadrant Compare — RMW Bins | static | `eflx_quad_compare_bins_rmw` | 8 (4 heatmap-compare + 4 timeseries-compare, by RMW bin) | `["fluxes", "quadrant", "radial"]` |
| Eyewall Budget (Motion-Relative) | static | `eflx_budget_motion_quad` | 5 (overall + 4 per-RMW-bin timeseries) | `["fluxes", "budget"]` |
| TKE Isosurface (3D) | static-3d | `tke_3d` | n/a (interactive embed) | `[]` |

Image `label` values within each group are derived from the bin range / chart type embedded in each filename (e.g. "Bar — 0–50 km", "Timeseries — 1–2 RMW", "Heatmap Compare — 2–3 RMW").

### UI: new "Analysis" nav button + overlay

- New `.nav-btn` "Analysis" added to `.nav-buttons` in `index.html`, alongside Storm / Primary / Compare / 3D View — always enabled once a storm is selected (doesn't depend on product selection).
- Clicking opens `#analysis-overlay`, a full-screen overlay matching the structural pattern of the existing `#viewer-3d-overlay` (header with storm name + close button, scrollable body).
- Overlay body renders a responsive card grid (`.analysis-grid` / `.analysis-card`): each card shows a thumbnail (first image in the group, or `staticImage` for `static-3d`), title, and an image-count badge (e.g. "9 charts").

### UI: lightbox

- Clicking a card opens `#lightbox-overlay`: full-screen, large image + label text, prev/next arrow buttons, close button.
- Keyboard support: `←`/`→` to navigate within the group, `Esc` to close.
- For `static-3d` cards, clicking opens directly in the existing 3D iframe viewer (`viewer3dIframe`) with the frame hardcoded to the value in the pattern — no lightbox needed, no prev/next.

### New code

- `js/app.js`: `renderAnalysisGrid()`, `openLightbox(productConfig, startIndex)`, `lightboxNext()`, `lightboxPrev()`, `closeLightbox()`, plus wiring for the new nav button (`els.analysisBtn.onclick = ...`) and keyboard listener.
- `css/components.css`: `.analysis-grid`, `.analysis-card`, `.analysis-card-badge`, `.lightbox-overlay`, `.lightbox-image`, `.lightbox-nav`, `.lightbox-label`.
- `index.html`: new nav button markup, `#analysis-overlay` and `#lightbox-overlay` container markup (mirroring `#viewer-3d-overlay` structure).

## Out of scope

- The `.csv` data exports sitting alongside the static PNGs — not surfaced in the UI.
- Generating more `tke_3d` frames — addressed separately if/when more get rendered; this spec wires in what exists today (frame 70 only).
- Any changes to the existing 2D/3D/Compare viewers beyond what's needed to add the 4 new frame-sequence products via catalog entries.
