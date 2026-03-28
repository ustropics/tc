#!/usr/bin/env python3
"""
Generate PNG thumbnails from 3D interactive HTML files.

Requirements:
    pip install playwright
    playwright install chromium

Usage:
    python generate_3d_thumbnails.py --base-dir /path/to/site/root

This reads catalog.json, finds all 3D products, opens each per-frame
HTML file in a headless browser, waits for the 3D scene to render,
and saves a PNG screenshot as the thumbnail.
"""

import argparse
import json
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright


def generate_thumbnails(base_dir: str, width: int = 800, height: int = 600,
                        wait_ms: int = 4000, force: bool = False):
    """
    Parameters
    ----------
    base_dir : str
        Root directory of the website (where catalog.json and images/ live).
    width, height : int
        Viewport size for the headless browser screenshot.
    wait_ms : int
        Milliseconds to wait after page load for the 3D scene to render.
        Increase if your Plotly/Three.js scenes are heavy.
    """
    base = Path(base_dir).resolve()
    catalog_path = base / "json" / "catalog.json"

    with open(catalog_path) as f:
        catalog = json.load(f)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": width, "height": height})

        for storm_name, products in catalog.items():
            storm_lower = storm_name.lower()

            for prod_name, cfg in products.items():
                if cfg.get("type") != "3d":
                    continue

                pattern = cfg.get("pattern", "")
                thumb_pattern = cfg.get("thumbnailPattern", "")
                frame_start = cfg.get("frameStart", 50)
                frame_end = cfg.get("frameEnd", 72)

                if not pattern or not thumb_pattern:
                    print(f"  SKIP {prod_name}: missing pattern or thumbnailPattern")
                    continue

                print(f"\n[{storm_name}] {prod_name}  frames {frame_start}-{frame_end}")

                for frame in range(frame_start, frame_end + 1):
                    html_rel = (pattern
                                .replace("{storm}", storm_lower)
                                .replace("{frame}", str(frame)))
                    html_path = base / html_rel

                    thumb_rel = (thumb_pattern
                                 .replace("{storm}", storm_lower)
                                 .replace("{frame}", str(frame)))
                    thumb_path = base / thumb_rel

                    if not html_path.exists():
                        print(f"  [!] HTML not found: {html_path}")
                        continue

                    # Skip if thumbnail already exists (unless --force)
                    if thumb_path.exists() and not force:
                        print(f"  T{frame} -> SKIP (exists)")
                        continue

                    # Ensure output directory exists
                    thumb_path.parent.mkdir(parents=True, exist_ok=True)

                    # Load the HTML file
                    file_url = f"file://{html_path}"
                    page.goto(file_url, wait_until="networkidle")

                    # Extra wait for Three.js / Plotly render
                    page.wait_for_timeout(wait_ms)

                    # Screenshot
                    page.screenshot(path=str(thumb_path), type="png")
                    print(f"  T{frame} -> {thumb_rel}")

        browser.close()

    print("\nDone. Update catalog.json thumbnailPattern fields if you haven't already.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate PNG thumbnails from 3D HTML visualizations.")
    parser.add_argument("--base-dir", required=True,
                        help="Root directory of the site (contains json/ and images/)")
    parser.add_argument("--width", type=int, default=800,
                        help="Screenshot viewport width (default: 800)")
    parser.add_argument("--height", type=int, default=600,
                        help="Screenshot viewport height (default: 600)")
    parser.add_argument("--wait", type=int, default=4000,
                        help="Wait time in ms for 3D render (default: 4000)")
    parser.add_argument("--force", action="store_true",
                        help="Regenerate all thumbnails even if they already exist")
    args = parser.parse_args()

    generate_thumbnails(args.base_dir, args.width, args.height, args.wait,
                        args.force)