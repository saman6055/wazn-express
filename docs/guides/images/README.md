# Guide screenshots

Drop the screenshots here, then run:

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

A missing image is skipped, not left blank — the PDF always builds, and the
script lists whatever is still absent.
