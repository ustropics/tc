#!/usr/bin/env python3
"""Rewrite images/{storm}/ URL patterns in catalog JSON files to the R2 CDN URL.

images/static/ patterns are untouched (different literal prefix) since those
assets stay in the repo.
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
OLD_PREFIX = "images/{storm}/"
NEW_PREFIX = "https://img.weathercanvas.com/{storm}/"
CATALOG_FILES = [
    REPO_ROOT / "json" / "catalog.json",
    REPO_ROOT / "json" / "catalog_2d.json",
    REPO_ROOT / "json" / "catalog_3d.json",
    REPO_ROOT / "json" / "catalog_diag.json",
    REPO_ROOT / "json" / "catalog_analysis.json",
]


def main():
    dry_run = "--dry-run" in sys.argv
    total = 0
    for path in CATALOG_FILES:
        original = path.read_text()
        count = original.count(OLD_PREFIX)
        total += count
        if count == 0:
            print(f"{path.name}: 0 replacements")
            continue
        rewritten = original.replace(OLD_PREFIX, NEW_PREFIX)
        json.loads(rewritten)  # fail loud if this broke JSON validity
        print(f"{path.name}: {count} replacements")
        if not dry_run:
            path.write_text(rewritten)
    suffix = " (dry run, no files written)" if dry_run else ""
    print(f"Total: {total} replacements{suffix}")


if __name__ == "__main__":
    main()
