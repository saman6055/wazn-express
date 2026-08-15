# Guide screenshots

The guide already has a picture for every step — drawings of each screen,
in `docs/guides/figures/`. They were made because a guide that waits for six
screenshots is a guide nobody has, and the warehouse needed it.

A real screenshot is better and always wins over the drawing. Drop one here
with the matching name and rebuild; the caption stops saying "illustration"
by itself.

    node docs/guides/build-pdf.cjs

    node docs/guides/build-pdf.cjs

Names must match exactly (`.png` or `.jpg`):

| File | What it should show |
|---|---|
| `1-scanner-sidebar.png` | Batch Assignment page with the Scanning menu open in the sidebar |
| `2-scanner-empty.png`   | Batch Assignment before a batch is chosen ("No open batches") |
| `3-batches-list.png`    | The Batches page with the New Batch button |
| `4-create-basic.png`    | New Batch dialog, Basic Information tab, filled in |
| `5-create-volume.png`   | New Batch dialog, Volume & Cost tab |
| `6-create-price.png`    | New Batch dialog, Selling Price tab |

Anything with no screenshot falls back to its drawing, so the PDF always
builds. The script prints which pictures were screenshots and which were
drawings.
