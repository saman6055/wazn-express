import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A window that has been typed in does not close because you clicked past it.
 *
 * The owner, 2026-09-25: "when you open a window and click a link outside it,
 * the window goes at once and everything you had filled in goes with it — you
 * have to start again. That problem is in the system; fix it."
 *
 * There is no undo for that: the form is gone and so is the work. The fix is
 * in the two primitives every panel in the app is built from, so it cannot be
 * forgotten on the seventy-ninth dialog somebody adds.
 */

const read = (p: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

const FORM_SURFACES = ["src/components/ui/dialog.tsx", "src/components/ui/sheet.tsx"];

describe("a window somebody has written in", () => {
  it("stays when the click lands outside it", () => {
    for (const file of FORM_SURFACES) {
      const src = read(file);
      expect(src, file).toContain("onInteractOutside={handleInteractOutside}");
      // Written slightly differently in each — the dialog also rings — so
      // the guard is checked by its parts: a caller's own veto is honoured,
      // and typing is what stops the close.
      expect(src, file).toContain("defaultPrevented");
      expect(src, file).toContain("typedIn");
      expect(src, file).toContain("e.preventDefault();");
    }
  });

  it("knows it was written in from the events, not from the fields", () => {
    // The primitive knows nothing about the forms inside it, and every
    // control in the app — inputs, textareas, selects, the rich editors —
    // announces a change the same way. Captured, so a field that stops the
    // event still counts.
    for (const file of FORM_SURFACES) {
      const src = read(file);
      expect(src, file).toContain("onInputCapture={() => setTypedIn(true)}");
      expect(src, file).toContain("onChangeCapture={() => setTypedIn(true)}");
    }
  });

  it("lets an untouched one go, which is how you put down something you only read", () => {
    // Not a blanket lock: `typedIn` gates it, and it starts false.
    for (const file of FORM_SURFACES) {
      expect(read(file), file).toContain("useState(false)");
    }
  });
});

describe("and it says it heard", () => {
  it("rings once, briefly, instead of doing nothing at all", () => {
    // A click that does nothing reads as a broken window.
    const dialog = read("src/components/ui/dialog.tsx");
    expect(dialog).toContain('refused && "ring-2 ring-primary');
    expect(dialog).toContain("setTimeout(() => setRefused(false), 600)");
    // …and the timer is cleared, so a dialog closed mid-flash sets no state.
    expect(dialog).toContain("if (refusedTimer.current) clearTimeout(refusedTimer.current)");
  });
});

describe("the deliberate ways out are untouched", () => {
  it("keeps the close button and lets Escape through", () => {
    const dialog = read("src/components/ui/dialog.tsx");
    // The X is a Radix Close, which no outside-click rule can reach.
    expect(dialog).toContain("<DialogPrimitive.Close");
    // Escape keeps its own handler, which only stops for an IME composition.
    expect(dialog).toContain("onEscapeKeyDown={handleEscapeKeyDown}");
    expect(dialog).toContain("onEscapeKeyDown?.(e);");
  });

  it("still passes a caller's own handler through first", () => {
    for (const file of FORM_SURFACES) {
      expect(read(file), file).toContain("onInteractOutside?.(e);");
    }
  });
});
