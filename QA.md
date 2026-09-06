# New-label validation

Completed 2026-09-06.

## Interactive browser checks

- Desktop editor and label preview render; all label images load at 1181 × 1772 pixels.
- Three independent branding font controls, product font, barcode dimensions, line spacing, and logo position update artwork.
- Price/Size colours are independently selectable; optional Size can be added and removed.
- Leading-zero barcode input is preserved; names wrap; quantity and starting-position changes update page counts.
- Product add, edit and delete work; settings and products survive reload.
- Out-of-range font and million-label quantity show validation instead of creating output.
- 13 labels with starting position 2 prepare two print sheets with all 13 images decoded.
- 390px iframe viewport: responsive settings stack correctly; table scrolls horizontally; font control remains usable. This is responsive browser testing, not an iPhone/Safari device test.
- Word button reaches successful generation state and re-enables itself.

## Automated and document checks

Eight regression tests pass: default/optional-size rendering; outer and barcode-section borders; dynamic name/Size flow with fixed barcode dimensions; watermark-only pixel differences with identical barcode pixels; independent font/colour changes; overflow rejection; Code128 leading-zero/quiet-zone checks; and two-page DOCX generation with distinct details sharing one barcode code.

The generated two-page DOCX was rendered through LibreOffice and both pages visually inspected. The single outer border and single barcode-section border, branding, full watermark, optional Size and changing prices fit without clipping. JavaScript syntax and whitespace checks pass. Standalone packaging embeds the logo, scripts and Word template.

## Limits

The cloud browser did not report a downloadable file event and did not expose a native print dialog. Word generation was independently verified by the same application functions and rendered; the DOM print sheets contained the expected loaded images. Download delivery and physical printing still need a check in the user's browser. Scanner hardware and actual paper alignment were not tested. No changes were merged to main or deployed to the existing production Site.
