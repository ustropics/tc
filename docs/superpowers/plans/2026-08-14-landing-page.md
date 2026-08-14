# Weather Canvas Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Move the existing TC RI app from site root to `/tc-ri/`, then build a new landing page at root matching the PolarWx sample layout (navbar + hero + 3-card grid), plus a placeholder `/about/` page.

**Architecture:** Static HTML/CSS/vanilla-JS site, no build step, no test framework — verification is manual (local HTTP server + browser). This is a pure file-move + two new static pages. `css/core.css` stays at root as the single shared variable source; the relocated app and the new pages both link to it by relative path.

**Tech Stack:** Plain HTML/CSS/JS, Font Awesome (CDN), Google Fonts (CDN). No npm, no bundler.

---

## Task 1: Relocate the TC RI app into `/tc-ri/`

**Files:**
- Move (git-tracked): `index.html` → `tc-ri/index.html`
- Move (git-tracked): `js/` → `tc-ri/js/`
- Move (git-tracked): `css/components.css`, `css/layout.css`, `css/map.css`, `css/mobile.css` → `tc-ri/css/`
- Move (git-tracked): `json/` → `tc-ri/json/`
- Move (git-tracked): `images/static/` → `tc-ri/images/static/`
- Move (git-tracked): `components/` → `tc-ri/components/`
- Move (git-tracked): `generate_3d_thumbnails.py`, `rewrite_image_urls.py` → `tc-ri/`
- Move (untracked, gitignored, large — plain `mv` not `git mv`): `images/ian/`, `images/ida/`, `images/harvey/`, `images/michael/` → `tc-ri/images/`
- Keep at root, untouched: `css/core.css`, `CNAME`, `README.md`
- Modify: `.gitignore`
- Modify: `tc-ri/index.html:19` (core.css link path)

This is a pure relocation — every reference inside `js/app.js`, `js/trackmap.js`, `generate_3d_thumbnails.py`, and `rewrite_image_urls.py` is a relative path (`json/...`, `images/...`, `Path(__file__).resolve().parent`) with no leading slash, so nothing inside those files needs to change. Only the `core.css` link in `tc-ri/index.html` needs a path fix since that one file now lives one directory below where `core.css` stays.

- [x] **Step 1: Create the `tc-ri/` directory and move git-tracked app files into it**

```bash
mkdir -p tc-ri
git mv index.html tc-ri/index.html
git mv js tc-ri/js
git mv json tc-ri/json
git mv components tc-ri/components
git mv generate_3d_thumbnails.py tc-ri/generate_3d_thumbnails.py
git mv rewrite_image_urls.py tc-ri/rewrite_image_urls.py
mkdir -p tc-ri/css
git mv css/components.css tc-ri/css/components.css
git mv css/layout.css tc-ri/css/layout.css
git mv css/map.css tc-ri/css/map.css
git mv css/mobile.css tc-ri/css/mobile.css
git mv images/static tc-ri/images/static
```

- [x] **Step 2: Move the large untracked per-storm image directories (plain `mv`, not `git mv` — they're gitignored)**

```bash
mkdir -p tc-ri/images
mv images/ian tc-ri/images/ian
mv images/ida tc-ri/images/ida
mv images/harvey tc-ri/images/harvey
mv images/michael tc-ri/images/michael
rmdir images
```

Expected: `images/` at root no longer exists; `du -sh tc-ri/images/*` shows the same directories/sizes as before the move (~6.5G ian, ~8.0G ida, ~7.3G harvey, ~6.4G michael, ~12M static).

- [x] **Step 3: Fix the `core.css` link path in the relocated app**

Read `tc-ri/index.html` around line 19, then:

```html
<!-- before -->
<link rel="stylesheet" href="css/core.css">
<!-- after -->
<link rel="stylesheet" href="../css/core.css">
```

Leave the other four stylesheet links (`css/components.css`, `css/layout.css`, `css/map.css?v=4`, `css/mobile.css`) unchanged — they now correctly resolve to `tc-ri/css/...` since the HTML file itself moved with them.

- [x] **Step 4: Update `.gitignore` for the new image paths**

Read current `.gitignore`, then replace the four `images/<storm>/` lines:

```
.DS_Store
.claude
.superpowers
CLAUDE.md
tc-ri/images/ian/
tc-ri/images/ida/
tc-ri/images/harvey/
tc-ri/images/michael/
```

- [x] **Step 5: Verify the relocated app still works**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/tc-ri/` in a browser. Expected: app loads exactly as before (title "TROPICAL CYCLONE RI CASE STUDIES", storm track map, product dropdowns populated). Check the browser console (or `mcp__claude-in-chrome__read_console_messages` if using browser automation) for 404s on `css/`, `js/`, or `json/` — there should be none. Stop the server (Ctrl-C) when done.

- [x] **Step 6: Commit**

```bash
git add -A
git status
git commit -m "chore: relocate TC RI app to /tc-ri/ ahead of new landing page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Landing page stylesheet

**Files:**
- Create: `css/landing.css`

Builds on `css/core.css`'s existing variables (`--bg-deep`, `--bg-primary`, `--accent-primary`, `--text-primary`, `--text-secondary`, `--font-display`, `--font-body`, `--space-*`, `--border-subtle`, `--transition-normal`, etc. — see `css/core.css:1-49`, unchanged by Task 1). No new variables are introduced; `landing.css` only adds selectors for the navbar, hero, and card grid.

- [x] **Step 1: Write `css/landing.css`**

```css
/* ============================================
   WEATHER CANVAS — LANDING PAGE
   ============================================ */

/* === Navbar === */
.landing-navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-xl);
  background: rgba(10, 22, 40, 0.85);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-subtle);
}

.landing-brand {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
}

.landing-brand i {
  color: var(--accent-primary);
  font-size: 1.4rem;
}

.landing-nav-tabs {
  display: flex;
  gap: var(--space-lg);
}

.landing-nav-tabs a {
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  padding: var(--space-sm) var(--space-md);
  border-radius: 8px;
  transition: var(--transition-fast);
}

.landing-nav-tabs a:hover {
  color: var(--text-primary);
  background: var(--surface-glass);
}

.landing-nav-tabs a.active {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

/* === Hero === */
.landing-hero {
  position: relative;
  padding: 96px var(--space-xl) 80px;
  text-align: center;
  background-image:
    linear-gradient(180deg, rgba(5, 12, 24, 0.75) 0%, rgba(5, 12, 24, 0.55) 40%, rgba(10, 22, 40, 1) 100%),
    url('../tc-ri/images/static/winds.png');
  background-size: cover;
  background-position: center 30%;
}

.landing-hero h1 {
  font-family: var(--font-display);
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: var(--space-md);
}

.landing-hero p {
  font-family: var(--font-body);
  font-size: clamp(1rem, 2vw, 1.15rem);
  color: var(--text-secondary);
  max-width: 640px;
  margin: 0 auto;
  line-height: 1.6;
}

/* === Card grid === */
.landing-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-lg);
  padding: var(--space-2xl) var(--space-xl);
  max-width: 1200px;
  margin: 0 auto;
}

.landing-card {
  display: block;
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface-glass);
  border: 1px solid var(--border-subtle);
  text-decoration: none;
  transition: var(--transition-normal);
}

a.landing-card:hover {
  border-color: var(--border-medium);
  transform: translateY(-2px);
  box-shadow: var(--glow-primary);
}

.landing-card-thumb {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  display: block;
  background: var(--bg-tertiary);
}

.landing-card-placeholder {
  width: 100%;
  aspect-ratio: 16 / 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
  color: var(--text-muted);
  font-size: 2.5rem;
}

.landing-card-body {
  padding: var(--space-lg);
}

.landing-card-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.landing-card-title-row h3 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--text-primary);
}

.landing-badge {
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--accent-secondary);
  background: rgba(0, 149, 255, 0.12);
  border: 1px solid rgba(0, 149, 255, 0.3);
  border-radius: 999px;
  padding: 2px 10px;
}

.landing-card-body p {
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.landing-card.disabled {
  cursor: default;
}

/* === About page body === */
.landing-about {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-2xl) var(--space-xl) 96px;
}

.landing-about h1 {
  font-family: var(--font-display);
  font-size: 2rem;
  color: var(--text-primary);
  margin-bottom: var(--space-lg);
}

.landing-about p {
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: var(--space-md);
}

/* === Responsive === */
@media (max-width: 900px) {
  .landing-cards {
    grid-template-columns: 1fr;
  }
  .landing-nav-tabs {
    gap: var(--space-sm);
  }
}
```

- [x] **Step 2: Commit**

```bash
git add css/landing.css
git commit -m "feat: add landing page stylesheet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Landing page markup

**Files:**
- Create: `index.html` (new root landing page)

Depends on Task 1 (assets live at `tc-ri/images/static/3d.png` and `tc-ri/images/static/winds.png`, and `tc-ri/` is the link target for the TC RI card and nav tab) and Task 2 (`css/landing.css` classes used here).

- [x] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weather Canvas</title>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <!-- Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

    <link rel="stylesheet" href="css/core.css">
    <link rel="stylesheet" href="css/landing.css">
</head>
<body>
    <header class="landing-navbar">
        <a href="/" class="landing-brand">
            <i class="fas fa-hurricane"></i>
            <span>Weather Canvas</span>
        </a>
        <nav class="landing-nav-tabs">
            <a href="/" class="active">Home</a>
            <a href="/tc-ri/">TC RI</a>
            <a href="/about/">About</a>
        </nav>
    </header>

    <section class="landing-hero">
        <h1>Welcome to Weather Canvas</h1>
        <p>
            Tropical cyclone research visualization tools. This site is under active
            development — start with the TC Rapid Intensification case study explorer
            below while more analysis and visualization tools are added.
        </p>
    </section>

    <main class="landing-cards">
        <a href="/tc-ri/" class="landing-card">
            <img class="landing-card-thumb" src="tc-ri/images/static/3d.png" alt="TC RI 3D enthalpy flux visualization">
            <div class="landing-card-body">
                <div class="landing-card-title-row">
                    <h3>TC RI</h3>
                </div>
                <p>Rapid Intensification case study explorer — interactive WRF-derived storm structure and moist enthalpy flux visualizations.</p>
            </div>
        </a>

        <div class="landing-card disabled">
            <div class="landing-card-placeholder"><i class="fas fa-chart-line"></i></div>
            <div class="landing-card-body">
                <div class="landing-card-title-row">
                    <h3>Uncertainty</h3>
                    <span class="landing-badge">Coming soon</span>
                </div>
                <p>Forecast uncertainty visualization tools.</p>
            </div>
        </div>

        <div class="landing-card disabled">
            <div class="landing-card-placeholder"><i class="fas fa-satellite-dish"></i></div>
            <div class="landing-card-body">
                <div class="landing-card-title-row">
                    <h3>Recon</h3>
                    <span class="landing-badge">Coming soon</span>
                </div>
                <p>Aircraft reconnaissance data tools.</p>
            </div>
        </div>
    </main>
</body>
</html>
```

- [x] **Step 2: Verify in browser**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Expected: dark navbar with "Weather Canvas" + Home/TC RI/About tabs, hero section showing the Ian enthalpy-transport map darkened behind the headline/subtitle text (text must be legible against the image), 3-card grid below with the TC RI card showing the 3D isosurface thumbnail and two "Coming soon" placeholder cards. Click the TC RI card — expected: navigates to `/tc-ri/` and the app loads correctly (this confirms Task 1's relocation and this task's relative image path are both correct). Click browser back, then check the layout at a narrow window width (~500px) — expected: cards stack to a single column per the `@media (max-width: 900px)` rule. Stop the server when done.

- [x] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add landing page at site root

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: About placeholder page

**Files:**
- Create: `about/index.html`

- [x] **Step 1: Write `about/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About — Weather Canvas</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

    <link rel="stylesheet" href="../css/core.css">
    <link rel="stylesheet" href="../css/landing.css">
</head>
<body>
    <header class="landing-navbar">
        <a href="/" class="landing-brand">
            <i class="fas fa-hurricane"></i>
            <span>Weather Canvas</span>
        </a>
        <nav class="landing-nav-tabs">
            <a href="/">Home</a>
            <a href="/tc-ri/">TC RI</a>
            <a href="/about/" class="active">About</a>
        </nav>
    </header>

    <main class="landing-about">
        <h1>About</h1>
        <p>
            Weather Canvas is a research visualization site for tropical cyclone
            structure and moist enthalpy flux analysis, built on WRF (Weather
            Research and Forecasting) model output.
        </p>
        <p>
            The site is under active development. The TC RI (Rapid Intensification)
            case study explorer is the first tool available, with more analysis and
            visualization products planned.
        </p>
    </main>
</body>
</html>
```

- [x] **Step 2: Verify in browser**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/about/`. Expected: same navbar as the landing page with "About" tab highlighted active, blurb text below. Navigate via the Home and TC RI tabs — expected: both resolve correctly (`/` and `/tc-ri/`). Stop the server when done.

- [x] **Step 3: Commit**

```bash
git add about/index.html
git commit -m "feat: add About placeholder page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Update CLAUDE.md for the new structure

**Files:**
- Modify: `CLAUDE.md`

The current `CLAUDE.md` (root of the `client` repo) documents the site as if `index.html` at root is the RI app itself. Update it to describe the landing page + `/tc-ri/` + `/about/` structure.

- [x] **Step 1: Read the current file and update the relevant sections**

Read `CLAUDE.md` in full first. Then apply these changes:

1. In the **Project Overview** section, after the existing description, add a sentence noting the site is now a landing page at root with the RI app moved to `/tc-ri/`.
2. In **Architecture**, change "Entry point: `index.html`" to describe the new root `index.html` (landing page) and add `tc-ri/index.html` as the RI app's entry point, updating the `js/app.js` / `js/trackmap.js` paths to `tc-ri/js/app.js` / `tc-ri/js/trackmap.js`.
3. Update the `json/catalog.json` and `json/ian.json` path references to `tc-ri/json/catalog.json` and `tc-ri/json/ian.json`.
4. Update the `css/` description to note `css/core.css` stays shared at root (used by both the landing page and `tc-ri/`), while `tc-ri/css/` holds the RI-app-specific stylesheets (`components.css`, `layout.css`, `map.css`, `mobile.css`), and root `css/landing.css` holds landing/about page styles.
5. Add a new top-level section (after **Architecture**, before **Adding a New Storm**) titled **Site Structure**:

```markdown
## Site Structure

```
index.html          — landing page (site root)
about/index.html    — About placeholder page
css/core.css         — shared variables/theme (used by all pages)
css/landing.css      — landing + about page styles
tc-ri/               — TC RI case-study app (moved from root)
  index.html
  js/app.js, js/trackmap.js
  css/               — app-specific styles
  json/               — catalog + per-storm track data
  images/             — per-storm imagery + images/static/
```
```

6. In **Adding a New Storm** and **Adding a New Product**, prefix the referenced paths (`json/catalog.json`, `json/<storm>.json`, `images/<storm>/`) with `tc-ri/`.

- [x] **Step 2: Verify the edits read correctly**

Read the full updated `CLAUDE.md` back and confirm every path mentioned matches the actual post-move file locations from Task 1 (spot check: `tc-ri/index.html`, `tc-ri/js/app.js`, `tc-ri/json/catalog.json`, `css/core.css`, `css/landing.css`).

- [x] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for landing page + /tc-ri/ restructure

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: End-to-end verification

**Files:** none (verification only)

- [x] **Step 1: Full local smoke test**

```bash
python3 -m http.server 8000
```

Walk through, in a browser:
1. `http://localhost:8000/` — landing page loads, hero image visible with legible text, 3 cards render, TC RI thumbnail visible.
2. Click "TC RI" nav tab — lands on `/tc-ri/`, app loads fully (track map, product dropdowns, playback controls all functional as before the move).
3. Click "Home" nav tab from within `/tc-ri/` — returns to `/`.
4. Click "About" nav tab — lands on `/about/`, content renders, "About" tab shows active state.
5. From `/about/`, click "TC RI" — lands on `/tc-ri/` correctly.
6. Resize browser to mobile width (~400px) on `/` — verify no horizontal scroll, cards stack, navbar doesn't overflow.

Expected: no broken images, no 404s in the console on any of the three pages, all nav links resolve correctly. Stop the server when done.

- [x] **Step 2: Check for stray references to the old root-level paths**

```bash
grep -rn "src=\"images/\|src=\"js/\|src=\"json/\|href=\"css/components\|href=\"css/layout\|href=\"css/map\|href=\"css/mobile" index.html about/index.html
```

Expected: no matches (these paths only make sense from inside `tc-ri/` now; the root landing/about pages should never reference them without the `tc-ri/` prefix, except the two intentional `tc-ri/images/static/...` thumbnail/hero references already in `index.html`).

- [x] **Step 3: Final status check**

```bash
git status
git log --oneline -8
```

Expected: working tree clean, last several commits show the relocation + landing page + about page + CLAUDE.md update.
