import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = __dirname;
const read = (...p: string[]) => fs.readFileSync(path.join(SRC, ...p), "utf8").replace(/\r\n/g, "\n");

/** Every .tsx file under client/src, as [relative path, contents]. */
function sources(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx")) {
        out.push([path.relative(SRC, full).replace(/\\/g, "/"), fs.readFileSync(full, "utf8").replace(/\r\n/g, "\n")]);
      }
    }
  };
  walk(SRC);
  return out;
}

/**
 * Wherever Esc is the way out, there is something to press with the mouse.
 *
 * The owner, 2026-10-05: «هەموو ئەو جێگایانەی کە گەڕانەوە بە دوگمەی ESC ـە،
 * زەربێکیشی بۆ دابنێ، بە ماوس بتوانی بگەڕێیتەوە».
 *
 * Swept that day, every Esc in the app:
 *
 *   already had a button    the dialogs' own X, every alert's Cancel, the
 *                           system alert's OK, the image viewers, the inline
 *                           editors (tracking, platform, settings), the
 *                           full-screen "Exit", Quick Register's "Clear"
 *   had none, and got one   the Ctrl+K hub and the Alt+T task window — no X,
 *                           and once typed in, a click outside does not close
 *                           them either; the portal's detail sheet (a swipe,
 *                           a tap past the edge, or the key); the scanner box
 *                           (Esc empties it)
 *
 * The four are marked `data-mouse-close`. What this guards is the next one:
 * a window that turns the X off, or a sheet that slides up, must carry a
 * control of its own.
 */
describe("a window with its X turned off closes by a button of its own", () => {
  const files = sources();

  it("every dialog that hides the X carries a marked close control", () => {
    const hidden = files.filter(([, text]) => text.includes("showCloseButton={false}"));
    // The sweep found three; a count of none means the scan matched nothing.
    expect(hidden.length).toBeGreaterThanOrEqual(3);
    for (const [file, text] of hidden) {
      expect(text, `${file} hides the dialog's X and has no button of its own`).toContain("data-mouse-close");
    }
  });

  it("every sheet that slides up from the bottom does too", () => {
    const drawers = files.filter(([file, text]) => !file.startsWith("components/ui/") && text.includes("<DrawerContent"));
    expect(drawers.length).toBeGreaterThanOrEqual(1);
    for (const [file, text] of drawers) {
      expect(text, `${file} opens a drawer with no close button`).toContain("data-mouse-close");
    }
  });
});

describe("the four that had only the key", () => {
  it("the Ctrl+K hub: the 'Esc close' hint is the button", () => {
    const hub = read("components", "CommandPalette.tsx");
    const start = hub.indexOf('data-testid="hub-close"');
    expect(start).toBeGreaterThan(-1);
    const button = hub.slice(hub.lastIndexOf("<button", start), hub.indexOf("</button>", start));
    expect(button).toContain("onClick={() => onOpenChange(false)}");
    expect(button).toContain("<Kbd>Esc</Kbd> {say(T.hintClose)}");
  });

  it("the Alt+T task window", () => {
    const task = read("components", "tasks", "TaskComposer.tsx");
    const start = task.indexOf('data-testid="task-close"');
    expect(start).toBeGreaterThan(-1);
    const button = task.slice(task.lastIndexOf("<button", start), task.indexOf("</button>", start));
    expect(button).toContain("onClick={() => setOpen(false)}");
    expect(button).toContain("{L(TASK_WORDS.close)}");
  });

  it("the portal's detail sheet", () => {
    const sheet = read("components", "portal", "PortalSearchDetail.tsx");
    const start = sheet.indexOf('data-testid="portal-detail-close"');
    expect(start).toBeGreaterThan(-1);
    const button = sheet.slice(sheet.lastIndexOf("<button", start), sheet.indexOf("</button>", start));
    // The same step back the swipe, the tap outside and Esc take.
    expect(button).toContain("onClick={onRequestClose}");
    expect(button).toContain("tap-44");
  });

  it("the scanner box: what Esc empties, a press empties", () => {
    const scan = read("components", "scanner", "ScanInput.tsx");
    const start = scan.indexOf('data-testid="scan-clear"');
    expect(start).toBeGreaterThan(-1);
    const button = scan.slice(scan.lastIndexOf("<button", start), scan.indexOf("</button>", start));
    expect(button).toContain('setTrackingNumber("");');
    expect(button).toContain("inputRef.current?.focus();");
    // Only when there is something to clear.
    expect(scan.slice(scan.lastIndexOf("{trackingNumber && (", start), start)).toContain("<button");
  });
});

describe("the ones that already had it keep it", () => {
  it("full screen leaves by a button as well as by the key", () => {
    const layout = read("components", "DashboardLayout.tsx");
    expect(layout).toContain('if (e.key === "Escape") { setFullScreen(false); return; }');
    expect(layout).toContain("{fullScreen && !isMobile && (");
    expect(layout.split("onClick={() => setFullScreen(false)}").length - 1).toBeGreaterThanOrEqual(1);
  });

  it("the dialog primitive draws its X unless told not to", () => {
    const dialog = read("components", "ui", "dialog.tsx");
    expect(dialog).toContain("showCloseButton = true,");
  });

  it("Quick Register's Esc has its Clear button, and a correction its Cancel", () => {
    const page = read("pages", "QuickRegister.tsx");
    expect(page).toContain("onClick={clearAllForm}");
    expect(page).toContain('data-testid="qr-correction-cancel"');
  });
});
