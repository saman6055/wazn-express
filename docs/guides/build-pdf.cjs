/**
 * Build the China warehouse guide into a PDF.
 *
 *   node docs/guides/build-pdf.cjs
 *
 * Each `<!--FIGURE:name-->` in the HTML is replaced by a picture of that
 * screen. Two sources, in this order:
 *
 *   1. docs/guides/images/<name>.png|jpg — a real screenshot, if one exists.
 *   2. docs/guides/figures/<name>.svg    — a drawing of the same screen.
 *
 * The drawings exist so the guide is usable now. A photograph of the real
 * screen is better and always wins, but a guide that waits for six
 * screenshots is a guide nobody has, and the person in the China warehouse
 * needs it this week. Captions say which kind of picture it is, so nobody
 * hunts for a button that a drawing has simplified away.
 *
 * A placeholder with neither is dropped rather than left blank, so the
 * document always prints.
 *
 * Pictures are inlined as data URIs rather than linked. Chrome prints local
 * files with a file:// base, and a linked image that fails to load leaves a
 * silent blank box in the PDF — inlining means the picture is either in the
 * document or the build tells us it is not.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const DIR = __dirname;
const HTML = path.join(DIR, "batch-guide-en.html");
const OUT_HTML = path.join(DIR, ".batch-guide-built.html");
const OUT_PDF = path.join(DIR, "batch-guide-en.pdf");
const IMAGES = path.join(DIR, "images");
const FIGURES = path.join(DIR, "figures");

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => fs.existsSync(p));

if (!CHROME) {
  console.error("No Chrome or Edge found to print the PDF.");
  process.exit(1);
}

const CAPTIONS = {
  "1-scanner-sidebar": "The Scanning menu in the sidebar, with Batch Assignment selected",
  "2-scanner-empty": "The Batch Assignment screen before a batch is chosen",
  "3-batches-list": "The Batches page. New Batch is at the top right",
  "4-create-basic": "New Batch — Basic Information, filled in",
  "5-create-volume": "New Batch — Volume & Cost",
  "6-create-price": "New Batch — Selling Price",
};

/** A real screenshot if there is one, else the drawing, else nothing. */
function findPicture(name) {
  if (fs.existsSync(IMAGES)) {
    for (const ext of [".png", ".jpg", ".jpeg"]) {
      const p = path.join(IMAGES, name + ext);
      if (fs.existsSync(p)) return { file: p, kind: "screenshot" };
    }
  }
  const drawn = path.join(FIGURES, name + ".svg");
  if (fs.existsSync(drawn)) return { file: drawn, kind: "drawing" };
  return null;
}

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml" };

let html = fs.readFileSync(HTML, "utf8");
const used = [];
const drawn = [];
const missing = [];

html = html.replace(/[ \t]*<!--FIGURE:([a-z0-9-]+)-->/g, (_, name) => {
  const found = findPicture(name);
  if (!found) {
    missing.push(name);
    return "";
  }
  const ext = path.extname(found.file).slice(1).toLowerCase();
  const data = fs.readFileSync(found.file).toString("base64");
  const size = `${name} (${Math.round(data.length / 1365)} KB)`;
  (found.kind === "screenshot" ? used : drawn).push(size);

  // A drawing is labelled as one. The reader should not go looking for a
  // button that only a simplification left out.
  const note = found.kind === "drawing" ? " <em>(illustration)</em>" : "";
  const caption = CAPTIONS[name]
    ? `\n      <figcaption>${CAPTIONS[name]}${note}</figcaption>`
    : "";
  return `\n    <figure>\n      <img src="data:${MIME[ext]};base64,${data}" alt="${name}">${caption}\n    </figure>`;
});

fs.writeFileSync(OUT_HTML, html, "utf8");

execFileSync(CHROME, [
  "--headless",
  "--disable-gpu",
  "--no-pdf-header-footer",
  `--print-to-pdf=${OUT_PDF}`,
  "file:///" + OUT_HTML.replace(/\\/g, "/"),
], { stdio: "inherit" });

fs.unlinkSync(OUT_HTML);

console.log(`\nScreenshots (${used.length}):`);
for (const u of used) console.log("  " + u);
if (drawn.length) {
  console.log(`\nDrawings standing in for screenshots (${drawn.length}):`);
  for (const d of drawn) console.log("  " + d);
  console.log("  Replace any of these by dropping the real screenshot into docs/guides/images/.");
}
if (missing.length) {
  console.log(`\nNo picture at all (${missing.length}):`);
  for (const m of missing) console.log("  " + m);
}
console.log(`\nWrote ${path.relative(process.cwd(), OUT_PDF)} (${(fs.statSync(OUT_PDF).size / 1024).toFixed(0)} KB)`);
