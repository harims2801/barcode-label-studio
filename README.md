# Barcode Label Studio — new-label

Portrait shop labels with blue/cyan branding and a movable logo watermark.

- 50 × 75 mm labels; 3 columns × 3 rows on A4 with 1.8 mm gaps.
- Enter code, product name, quantity, optional size and price directly.
- Separate font controls for Yes We, Authentic Designs and Trust. Quality. Style.
- Logo vertical position is in millimetres: negative moves up, positive moves down. Its 17 × 30 mm size stays fixed. Default position keeps the complete logo above the barcode.
- Size and Price have separate colour controls. Blank Size is omitted.
- Product names wrap to at most two lines. Invalid layouts show a message instead of printing clipped text.
- Preview, browser printing and Word share 600 dpi label artwork. Word contains embedded label images; edit content in the app before downloading.
- New-label preferences use separate browser storage. Existing product data/settings are imported once without changing the original app's saved data. Old page geometry resets to the new layout.

## Run

Open the self-contained `index.html` in a modern browser. No installation or server is required for daily use. Print at 100%, A4 portrait, with browser headers/footers disabled.

Readable source lives in `src/`. To develop: `npm ci`, then `npm run dev`. Rebuild the standalone entrypoint with `node build-standalone.cjs`. Run regression checks with `npm test` (headless raster tests use Nimbus Sans when available).

## Branch policy

All new label work stays on `new-label`. Merge into `main` only when the owner explicitly requests it.

## Validation

See `QA.md` for completed tests and remaining real-device checks.
