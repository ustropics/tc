# Move storm imagery to Cloudflare R2

**Date:** 2026-08-12
**Status:** Approved

## Problem

`images/` holds 17GB of storm imagery (ian 6.5G, ida 3.8G, harvey 3.5G, michael 3.4G). Because it's tracked in git, every GitHub Pages deploy bundles the full working tree into one artifact — currently 14.4GB, over the Pages 1GB cap. Deploys fail. `.git` history is also bloated to 14GB from the commits that added this imagery.

## Goal

Serve storm imagery from Cloudflare R2 instead of the repo, so Pages deploys stay small and succeed. Strip the historical image blobs from `.git` to reclaim space.

## Architecture

- Storm imagery (`images/ian`, `images/ida`, `images/harvey`, `images/michael`) moves to an R2 bucket, served publicly at `img.weathercanvas.com`.
- `images/static/` (12M, UI icons) stays in the repo — not part of the deploy-breaking bloat.
- `catalog.json` (and any per-storm JSON with image patterns) is rewritten so all `images/{storm}/...` patterns become `https://img.weathercanvas.com/{storm}/...`. This covers both 2D PNG patterns and 3D `.html` iframe patterns.
- Repo no longer tracks the per-storm image directories going forward (`.gitignore`).
- Git history is rewritten with `git filter-repo --path images --invert-paths` to remove historical image blobs, then `images/static/` is re-added fresh in a normal commit.

## Steps

### 1. R2 setup (user, Cloudflare dashboard)
1. Create R2 bucket (e.g. `weathercanvas-images`), enable public access.
2. Bind custom domain `img.weathercanvas.com` to the bucket (domain already on Cloudflare DNS).
3. Generate an R2 API token (S3-compatible access key/secret) for `rclone config`. Credentials go directly into rclone's interactive prompt, not shared elsewhere.

### 2. Upload (rclone)
- Configure an rclone remote against the R2 S3-compatible endpoint.
- Sync each storm directory as its own batch: `images/ian`, `images/ida`, `images/harvey`, `images/michael`. Four controlled syncs rather than one 17GB transfer — rclone handles internal concurrency/resume per batch.
- `images/static/` is excluded from this sync (stays local/in-repo).

### 3. Catalog rewrite
- Script (one-off, run once) rewrites every `images/{storm}/...` pattern string in `json/catalog.json` and any per-storm JSON files to the `https://img.weathercanvas.com/{storm}/...` equivalent.
- Covers `base`, `wind`, `rings`, `full` pattern keys (2D) and `pattern` (3D `.html`).

### 4. Git cleanup
1. `git rm -r --cached images/ian images/ida images/harvey images/michael`
2. Add `images/ian/`, `images/ida/`, `images/harvey/`, `images/michael/` to `.gitignore`
3. Commit the untrack + catalog rewrite
4. `git filter-repo --path images --invert-paths` — strips all historical image blobs from every commit
5. Re-add `images/static/` fresh in a normal commit (small, keep versioned)
6. Force-push rewritten history to `origin/main` (solo repo, confirmed safe — no other clones/collaborators)

### 5. Verify
- Trigger a Pages deploy, confirm artifact size is under 1GB.
- Spot-check several product images (2D PNGs across all four storms, at least one 3D iframe) load correctly from `img.weathercanvas.com` in a browser.
- Confirm `images/static/` assets (icons) still render from the repo-local path.

## Out of scope
- No change to local dev workflow beyond image URLs now being absolute CDN links (works identically under `python3 -m http.server`).
- No CDN cache/versioning strategy beyond R2 defaults — not needed at this scale.
- No change to `generate_3d_thumbnails.py` unless it references local `images/` paths for output (to check during implementation).
