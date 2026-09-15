# Analysis Lightbox Cross-Card Cycling

## Problem
Analysis overlay (`tc-ri/js/app.js`) opens a lightbox per card. Lightbox already has left/right arrow buttons + ArrowLeft/ArrowRight keyboard nav (`lightboxPrev`/`lightboxNext`), but they only cycle within one product's own `images[]` array. There's no way to move to the next/previous analysis card without closing the lightbox.

## Goal
Left/right arrow (button or key) cycles through every image across every `static`-type analysis card for the currently selected storm, wrapping at both ends. `static-3d` cards are excluded — they open the 3D viewer, not the lightbox, and stay out of scope.

## Design
- New `getAnalysisLightboxImages(stormName)`: iterates `window.catalogAnalysis[stormName]` in `Object.entries` order (same order the grid renders), skips `static-3d`, flattens each `static` product's `resolveStaticPaths()` result into one array of `{ src, label, productName }`.
- `openLightbox(productName, productConfig, stormName, startIndex)`: builds the flat list via the above, finds the flat index of the clicked product's `startIndex`-th image, stores it as `lightboxIndex`, stores the flat list as `lightboxImages` (replacing the old `lightboxProduct`/`lightboxStorm` pair used only for re-deriving images).
- `showLightboxFrame(images, idx)`: unchanged shape, but `images` is now the flat list; label rendered as `${productName} — ${label}`.
- `lightboxNext`/`lightboxPrev`: index math against `lightboxImages` instead of re-resolving a single product's paths.
- Prev/Next buttons: always visible when `lightboxImages.length > 1` (true whenever the storm has more than one static image total, which is normal).

## Out of scope
- `static-3d` cards.
- Cross-storm cycling (stays scoped to the currently selected analysis storm).
