import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A toast in the corner is right for "saved". It is wrong for "that tracking
 * number does not exist": on a warehouse screen at arm's length, with a
 * compressor running and a box in both hands, a small notice in the corner
 * with a quiet tone is neither read nor heard — and the parcel goes on the
 * shelf unregistered until the customer asks.
 *
 * The other half of the rule matters just as much. Two hundred parcels is
 * two hundred dismissals, so a success must never come through here.
 */

const HERE = __dirname;
const read = (p: string) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

const alert = read(path.join(HERE, "SystemAlert.tsx"));

function slice(src: string, startMarker: string, endMarker: string, label: string): string {
  const start = src.indexOf(startMarker);
  expect(start, `${label}: start marker not found`).toBeGreaterThan(-1);
  const end = src.indexOf(endMarker, start + startMarker.length);
  expect(end, `${label}: end marker not found`).toBeGreaterThan(start);
  return src.slice(start, end);
}
const app = read(path.join(HERE, "..", "App.tsx"));
const quickRegister = read(path.join(HERE, "..", "pages", "QuickRegister.tsx"));
const sound = read(path.join(HERE, "..", "lib", "soundManager.ts"));

describe("a failure has to be acknowledged", () => {
  it("takes the middle of the screen and dims what is behind it", () => {
    // The blocking branch only. The transient one deliberately sits at the
    // top with no backdrop so the scan box stays reachable.
    expect(alert).toContain('"inset-0 items-center justify-center bg-black/60"');
  });

  it("stays until somebody dismisses it", () => {
    // A blocking alert that closes itself is a toast with extra steps, and
    // the operator was looking at the parcel. Only a request that explicitly
    // asks to be transient may carry a timer.
    const body = slice(alert, "const id = window.setTimeout(dismiss", "}, [current, dismiss]);", "auto dismiss");
    expect(body, "the timer must be gated on an explicit request").toContain("autoDismissMs");
    expect(alert).toContain("if (!current?.autoDismissMs) return;");
  });

  it("can be dismissed without finding the mouse", () => {
    expect(alert).toContain('e.key === "Enter" || e.key === "Escape"');
  });

  it("makes a noise loud enough to carry", () => {
    expect(alert).toContain("soundManager.playAlert()");
    const body = sound.slice(sound.indexOf("playAlert()"), sound.indexOf("playAlert()") + 200);
    // playError is a third of full volume — a hint beside a toast, inaudible
    // beside a strapping table.
    expect(body).toMatch(/0\.9\)/);
  });

  it("is mounted where every screen can reach it", () => {
    expect(app).toContain("<SystemAlertProvider>");
  });

  it("does not throw when used outside the provider", () => {
    // A component in a test or a stray corner must not crash for want of a
    // dialog.
    expect(alert).toContain("ctx ?? (() => {})");
  });
});

/**
 * Which failures. The rule the owner set: anything that can lose goods, or
 * put a big error into the accounts.
 *
 * Every one of these ends with somebody's parcel in the wrong place or the
 * wrong customer's invoice, and every one of them used to be a small notice
 * in the corner of a warehouse screen.
 */
describe("the failures that lose goods all stop the operator", () => {
  const boxPanel = read(path.join(HERE, "delivery", "BoxDetailPanel.tsx"));
  const arrival = read(path.join(HERE, "..", "pages", "ArrivalVerificationScanner.tsx"));
  const batchAssign = read(path.join(HERE, "..", "pages", "BatchAssignmentScanner.tsx"));

  it("a parcel that belongs to another customer", () => {
    // The server refuses it. What was missing was making the refusal
    // impossible to walk past: this one ends with somebody's goods handed to
    // the wrong person.
    expect(boxPanel).toContain("systemAlert({");
    expect(boxPanel).toContain("delivery.cannotAddToBox");
    expect(boxPanel).toContain('kind: routine ? "warning" : "error"');
  });

  it("but a barcode scanned twice does not stop the work", () => {
    // The commonest thing that happens while filling a box. Nothing is lost
    // and nothing is wrong, so a dialog with a button to find and press is a
    // tax on every box assembled.
    expect(boxPanel).toContain('const routine = err.data?.code === "CONFLICT"');
    expect(boxPanel).toContain("...(routine ? { autoDismissMs: 3500 } : {})");
  });

  it("tells them apart by the code, not by the sentence", () => {
    // The server already says which is which. Reading the Kurdish text to
    // decide would break the first time anybody rewords it.
    const body = slice(boxPanel, "onError: (err) =>", "setScanInput(\"\");", "add-item error");
    expect(body, "the wording must not be what decides")
      .not.toMatch(/err\.message\.(includes|startsWith|indexOf)/);
  });

  it("a parcel the system has never heard of, in a container on the floor", () => {
    expect(arrival).toContain("scan.packageNotFoundExcl");
    expect(batchAssign).toContain("scan.packageNotFound");
    for (const src of [arrival, batchAssign]) {
      expect(src).toContain("systemAlert({");
    }
  });

  it("a parcel scanned twice, so the count and the list have parted", () => {
    expect(arrival).toContain("scan.alreadyVerified");
    expect(batchAssign).toContain("scan.alreadyInBatch");
  });

  it("an arrival that never reached the database", () => {
    // On screen it looks verified. Tomorrow it is still "in China".
    expect(arrival).toContain("scan.arrivalNotSaved");
  });

  it("none of them left on a toast", () => {
    // The whole point. A toast beside these is a notice nobody reads.
    for (const [name, src] of [
      ["BoxDetailPanel", boxPanel],
      ["ArrivalVerificationScanner", arrival],
      ["BatchAssignmentScanner", batchAssign],
    ] as const) {
      const hasAlert = src.includes("useSystemAlert()");
      expect(hasAlert, `${name} does not raise blocking alerts at all`).toBe(true);
    }
  });
});

describe("a batch that cannot be charged for stops the operator", () => {
  const batchAssign = read(path.join(HERE, "..", "pages", "BatchAssignmentScanner.tsx"));

  it("warns when the batch has no selling price", () => {
    expect(batchAssign).toContain("batchMissingSellingPrice");
    expect(batchAssign).toContain("scan.batchHasNoPrice");
  });

  it("uses the shared rule rather than its own opinion", () => {
    // The scanner's warning and any server check must be the same rule, or
    // they drift and one of them is wrong about money.
    expect(batchAssign).toContain('from "@shared/batchPricing"');
  });

  it("says it once per batch, not once per parcel", () => {
    // Two hundred parcels cannot be two hundred dialogs.
    expect(batchAssign).toContain("pricelessBatchWarned.current.has");
    expect(batchAssign).toContain("pricelessBatchWarned.current.add");
  });
});

describe("a routine failure gets out of the way", () => {
  const quickReg = read(path.join(HERE, "..", "pages", "QuickRegister.tsx"));

  it("takes itself away rather than waiting for a hand", () => {
    // On quick register a tracking the system has never seen is the ordinary
    // case: the parcel is new and about to be registered. A dismissal per
    // parcel is how the dialog everywhere else stops being read.
    expect(quickReg).toContain("autoDismissMs:");
    expect(alert).toContain("window.setTimeout(dismiss, current.autoDismissMs)");
  });

  it("does not cover the screen or take the caret", () => {
    // The gun keeps firing underneath it.
    expect(alert).toContain("pointer-events-none");
    expect(alert).toContain("return; // and never pull the caret out of a scan box");
  });

  it("has no button to press", () => {
    expect(alert).toContain("{!current.autoDismissMs && (");
  });

  it("sounds ordinary, because it is ordinary", () => {
    // This started out sharing the two-tone siren with the blocking alert,
    // on the reasoning that transient does not mean quiet. On the floor it
    // was wrong: a siren for the commonest event of the shift is how an
    // operator learns to stop hearing sirens, and then the one that means a
    // parcel is about to be lost goes unheard too.
    const body = slice(alert, "if (!current) return;", "}, [current]);", "sound effect");
    const quiet = body.indexOf("soundManager.playNotice()");
    const loud = body.indexOf("soundManager.playAlert()");
    expect(quiet, "the transient notice has no sound of its own").toBeGreaterThan(-1);
    expect(loud, "the blocking alert must still be loud").toBeGreaterThan(-1);
    expect(quiet, "the quiet tone must belong to the transient branch").toBeLessThan(loud);
    expect(body.slice(0, quiet)).toContain("if (current.autoDismissMs) {");
  });

  it("is a line of text, not a dialog missing its button", () => {
    // "Ordinary" was the whole request: small, plain, gone. The blocking
    // alert keeps its full size — the two must not be styled as one thing.
    expect(alert).toContain('current.autoDismissMs ? "h-8 w-8" : "h-14 w-14"');
    expect(alert).toContain('current.autoDismissMs ? "px-4 py-3" : "border-b p-5"');
  });

  it("still says what to do next", () => {
    // Shrinking it must not quietly drop the sentence that tells the
    // operator they can carry on and register the parcel.
    expect(alert).toContain("{current.autoDismissMs && current.message && (");
  });
});

describe("only failures come through it", () => {
  it("offers no success kind at all", () => {
    expect(alert).toContain('export type SystemAlertKind = "error" | "warning"');
    expect(alert).not.toContain('"success"');
  });

  it("is what the not-found tracking uses", () => {
    // The case that prompted it.
    expect(quickRegister).toContain("systemAlert({");
    expect(quickRegister).toContain("quickRegister.trackingNotFound");
  });

  it("leaves the success path on a toast", () => {
    // Continuous scanning survives only if a good scan needs no dismissal.
    const successes = quickRegister.split("toast.success(").length - 1;
    expect(successes, "successes moved into the blocking dialog").toBeGreaterThan(0);
  });
});

/**
 * A parcel scanned twice.
 *
 * It was always detected at the scan — and said so in a toast, in the corner,
 * behind the form. The operator weighed it, photographed it, chose a
 * customer, and learned it was a duplicate only when the save came back
 * refusing it. On a bad day the second registration is the one that gets
 * kept, and then the parcel is charged for twice.
 */
describe("a duplicate stops the operator where it is worth knowing", () => {
  const quickReg = read(path.join(HERE, "..", "pages", "QuickRegister.tsx"));
  const branch = () =>
    slice(quickReg, 'if (result.source === "package") {', "} else {", "duplicate branch");

  it("raises the blocking alert, not a toast in the corner", () => {
    const body = branch();
    expect(body).toContain("systemAlert({");
    expect(body, "a toast is what failed here").not.toContain("toast.warning(");
  });

  it("waits for a hand", () => {
    // The transient form is for the routine case. This is not routine, and
    // an alert that takes itself away is one the operator can miss.
    expect(branch(), "a duplicate must not auto-dismiss").not.toContain("autoDismissMs");
  });

  it("says who has it and when it was registered", () => {
    // Enough to settle it at the bench: either this is the same parcel come
    // round twice, or two parcels carry one tracking, and the answer is in
    // the customer and the date.
    const body = branch();
    expect(body).toContain("result.customer?.customerCode");
    expect(body).toContain("registeredAt");
  });

  it("names the existing parcel, so the row can be found", () => {
    expect(branch()).toContain("already?.packageCode");
  });

  it("sends the caret back to the scan box, not into the weight", () => {
    // Landing in the weight field is the form inviting the second
    // registration the dialog just warned about.
    const body = slice(quickReg, 'if (result.source === "package") {', "}, 100);", "focus after duplicate");
    expect(body).toContain("trackingRef.current?.focus()");
  });
});

/**
 * The sound of the notice, after the owner heard it on the floor.
 */
describe("the transient notice is quiet enough to hear all day", () => {
  const sounds = read(path.join(HERE, "..", "lib", "soundManager.ts"));

  it("has a tone of its own rather than borrowing a failure's", () => {
    expect(sounds).toContain("playNotice()");
    expect(alert).toContain("soundManager.playNotice()");
  });

  it("is a sine, which has no harmonics to rasp", () => {
    const body = slice(sounds, "playNotice()", ";", "playNotice");
    expect(body).toContain("'sine'");
  });

  it("is far below the siren", () => {
    const notice = slice(sounds, "playNotice()", ";", "playNotice");
    const volume = Number(notice.match(/,\s*([0-9.]+)\s*\)/)?.[1]);
    expect(volume, "playNotice must declare a volume").toBeGreaterThan(0);
    expect(volume).toBeLessThanOrEqual(0.15);
  });

  it("ramps up instead of starting at full gain", () => {
    // A square edge on the first sample is a click, and the click is most of
    // what makes a short beep sound harsh — it is heard as part of the tone.
    expect(sounds).toContain("const ATTACK =");
    expect(sounds).toContain("gain.gain.setValueAtTime(0.0001, ctx.currentTime)");
    expect(sounds).toContain("exponentialRampToValueAtTime(volume, ctx.currentTime + ATTACK)");
  });

  it("ramps every tone in the sequence too", () => {
    const body = slice(sounds, "private playSequence", "playAlert()", "playSequence");
    expect(body).toContain("setValueAtTime(0.0001, at)");
    expect(body).toContain("exponentialRampToValueAtTime(volume, at + ATTACK)");
  });
});

/**
 * Where the transient notice sits, after it was reported unread.
 *
 * It appeared centred at the top of the window. That is where the browser's
 * own furniture lives — address bar, tabs, the page's own header — and a
 * notice there is read as more furniture. Meanwhile the eye on this screen
 * lives on the scan box and the row of figures under it, and never goes up.
 *
 * The bottom corner is out of the way of the work and still inside the field
 * of view, and a red circle that pulses once is what actually turns a head:
 * peripheral vision reads movement and colour well before it reads words.
 */
describe("the transient notice sits where it will be seen", () => {
  const transient = slice(alert, "current.autoDismissMs\n              ?", ": \"inset-0", "transient position");

  it("sits at the bottom of the window, not the top", () => {
    expect(transient).toContain("bottom-0");
    expect(transient, "the top is where the browser's own furniture is").not.toContain("top-0");
  });

  it("sits on the left, physically, not on the start edge", () => {
    // The app runs right-to-left, so `start-0` would put it back on the side
    // the eye has just left.
    expect(transient).toContain("left-0");
    expect(transient).not.toContain("start-0");
    expect(transient, "centred is what it was, and it was not read").not.toContain("justify-center");
  });

  it("still lets the scan gun fire underneath it", () => {
    // The whole reason this form exists. A notice that swallows a keystroke
    // costs a parcel.
    expect(transient).toContain("pointer-events-none");
  });

  it("rises from the bottom, in the direction it now comes from", () => {
    expect(alert).toContain("slide-in-from-bottom-2");
    expect(alert).not.toContain("slide-in-from-top-2");
  });

  it("carries a red circle that pulses once into view", () => {
    expect(alert).toContain('data-testid="system-alert-marker"');
    expect(alert).toContain("animate-ping");
    expect(alert).toContain("rounded-full bg-red-500");
  });

  it("wears a red ring, so it reads as something new before it is read", () => {
    expect(alert).toContain("ring-2 ring-red-500/60");
  });

  it("shows the circle only on the transient form", () => {
    // A blocking alert has the whole screen and a dimmed backdrop. A dot in
    // its corner would be decoration.
    const at = alert.indexOf('data-testid="system-alert-marker"');
    expect(at, "the marker is not there at all").toBeGreaterThan(-1);
    const around = alert.slice(at - 400, at + 400);
    expect(around, "the marker must be gated on the transient branch")
      .toContain("{current.autoDismissMs && (");
    expect(around, "the marker is decoration, not content").toContain('aria-hidden="true"');
  });

  it("pairs the marker's colours for dark mode", () => {
    expect(alert).toContain("dark:bg-red-400");
    expect(alert).toContain("dark:ring-red-500/50");
  });
});
