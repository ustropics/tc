# Weather Canvas Landing Page — Design

## Goal

`weathercanvas.com` currently serves the TC RI case-study app directly at root. Add a proper landing page at root, moving the RI app to `/tc-ri/`. Landing page follows the visual pattern of the provided PolarWx sample: dark themed navbar, full-bleed hero, 3-card product grid.

## File restructure

Move the entire current app as-is into `/tc-ri/`:

```
tc-ri/
  index.html        (formerly root index.html, unchanged content)
  js/                (app.js, trackmap.js)
  css/               (components.css, layout.css, map.css, mobile.css — core.css stays at root, see below)
  json/              (catalog.json, catalog_3d.json, per-storm json, etc.)
  images/            (ian/, harvey/, ida/, michael/, static/)
  components/
  generate_3d_thumbnails.py
  rewrite_image_urls.py
```

All internal references in `js/app.js` and `js/trackmap.js` are relative (`json/...`, `images/...`) with no leading slash and no URL-param/deep-link handling, so the move is a straight `git mv` with no code changes required inside `tc-ri/`, except:

- `tc-ri/index.html`'s `<link href="css/core.css">` becomes `<link href="../css/core.css">` (core.css stays shared at root — see CSS approach below).

New root:

```
index.html           (new landing page)
css/
  core.css            (existing — shared variables, unchanged, stays at root)
  landing.css          (new — landing-page-specific styles)
about/
  index.html          (new — About placeholder page, reuses core.css + landing.css)
CNAME                 (unchanged, stays at root — required by GitHub Pages)
CLAUDE.md             (updated to reflect new structure)
README.md             (unchanged)
```

## CSS approach

`css/core.css` (CSS variables: colors, fonts, spacing, reset) stays at root as the single shared source of truth. Both `tc-ri/index.html` and the new landing/about pages link to it via relative paths (`../css/core.css` from `tc-ri/` and `about/`, `css/core.css` from root). `tc-ri`'s other stylesheets (`components.css`, `layout.css`, `map.css`, `mobile.css`) move into `tc-ri/css/` since they're specific to the RI app. New `css/landing.css` at root holds landing-page-specific rules (navbar, hero, cards) and is shared between the landing page and the About page.

## Landing page (`index.html`)

### Navbar
- Logo: reuse existing `fa-hurricane` icon (Font Awesome, already loaded) + "Weather Canvas" wordmark
- Tabs: `Home` (current/active) | `TC RI` (links to `/tc-ri/`) | `About` (links to `/about/`)
- Same dark navbar styling as sample (sticky, translucent dark background)

### Hero
- Full-bleed background image: `tc-ri/images/static/winds.png` (Hurricane Ian horizontal enthalpy-transport map — storm swirl + Florida coastline, dark background)
- Dark gradient overlay on top of the image for text legibility (matches sample's darkened map treatment)
- Headline: "Welcome to Weather Canvas" (or similar — final copy at implementation time)
- Subtitle: short description of the site's purpose (tropical cyclone research visualization), noting site is under active development

### Product card grid (3 cards, matching sample's card component style)
1. **TC RI** — thumbnail `tc-ri/images/static/3d.png` (Ian 3D enthalpy flux isosurface), title "TC RI", short description, links to `/tc-ri/`
2. **Uncertainty** — placeholder card, "Coming soon" badge, no thumbnail image (use a dark gradient/icon placeholder), not clickable
3. **Recon** — placeholder card, "Coming soon" badge, same placeholder treatment, not clickable

## About page (`/about/index.html`)

- Same navbar (About tab active) and overall theme (dark bg, core.css variables)
- Short placeholder blurb about the research project/site purpose
- No nav/link changes needed elsewhere

## Out of scope

- No functional changes to the TC RI app itself beyond its relocation
- No content/copy finalization beyond placeholder text (headline, subtitle, About blurb) — refined at implementation time, structure is what's being specified here
- No new nav tabs (Models/Products) until real products exist beyond TC RI
