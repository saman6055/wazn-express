/**
 * Build the China warehouse guide into a PDF.
 *
 *   node docs/guides/build-pdf.cjs
 *
 * Screenshots go in docs/guides/images/ as PNG or JPG, named after the
 * placeholders in the HTML. Each `<!--FIGURE:name-->` is replaced by the
 * matching image; a placeholder with no image is dropped, so the document is
 * always printable even when a screenshot is still missing.
 *
 * Images are inlined as data URIs rather than linked. Chrome prints local
 * files with a file:// base, and a linked image that fails to load leaves a
 * silent blank box in the PDF — inlining means the image is either in the
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

function findImage(name) {
  if (!fs.existsSync(IMAGES)) return null;
  for (const ext of [".png", ".jpg", ".jpeg"]) {
    const p = path.join(IMAGES, name + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

let html = fs.readFileSync(HTML, "utf8");
const used = [];
const missing = [];

html = html.replace(/[ \t]*<!--FIGURE:([a-z0-9-]+)-->/g, (_, name) => {
  const file = findImage(name);
  if (!file) {
    missing.push(name);
    return "";
  }
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === "png" ? "image/png" : "image/jpeg";
  const data = fs.readFileSync(file).toString("base64");
  used.push(`${name} (${Math.round(data.length / 1365)} KB)`);
  const caption = CAPTIONS[name] ? `\n      <figcaption>${CAPTIONS[name]}</figcaption>` : "";
  return `\n    <figure>\n      <img src="data:${mime};base64,${data}" alt="${name}">${caption}\n    </figure>`;
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

console.log(`\nImages included (${used.length}):`);
for (const u of used) console.log("  " + u);
if (missing.length) {
  console.log(`\nStill missing (${missing.length}) — put these in docs/guides/images/:`);
  for (const m of missing) console.log("  " + m + ".png");
}
console.log(`\nWrote ${path.relative(process.cwd(), OUT_PDF)} (${(fs.statSync(OUT_PDF).size / 1024).toFixed(0)} KB)`);
