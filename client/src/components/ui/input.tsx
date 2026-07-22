import { useDialogComposition } from "@/components/ui/dialog";
import { useComposition } from "@/hooks/useComposition";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import * as React from "react";

// Number inputs render +/− stepper pills inside a wrapper div. Layout
// classes (width, margin, flex/grid placement) must move to that wrapper so
// the overlay tracks the visible box; visual classes stay on the <input>.
const LAYOUT_CLASS =
  /^(-?m[trblsexy]?-|w-|min-w-|max-w-|flex-|flex$|grow|shrink|basis-|self-|col-|row-|order-|justify-self-|place-self-)/;

function splitLayoutClasses(className?: string) {
  if (!className) return { wrapper: undefined, input: undefined };
  const wrapper: string[] = [];
  const input: string[] = [];
  for (const cls of className.split(/\s+/).filter(Boolean)) {
    const base = cls.split(":").pop() ?? cls;
    (LAYOUT_CLASS.test(base) ? wrapper : input).push(cls);
  }
  return { wrapper: wrapper.join(" ") || undefined, input: input.join(" ") || undefined };
}

function decimalsOf(n: number) {
  const s = String(n);
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

const HOLD_DELAY_MS = 400;
const HOLD_REPEAT_MS = 80;

type InputProps = React.ComponentProps<"input"> & {
  /** Set false to hide the built-in +/− stepper pills on a number input
   *  (e.g. when the field already has its own dedicated buttons). */
  stepper?: boolean;
};

function Input({
  className,
  type,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  ref,
  stepper = true,
  ...props
}: InputProps) {
  // Get dialog composition context if available (will be no-op if not inside Dialog)
  const dialogComposition = useDialogComposition();

  // Add composition event handlers to support input method editor (IME) for CJK languages.
  const {
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    onKeyDown: handleKeyDown,
  } = useComposition<HTMLInputElement>({
    onKeyDown: (e) => {
      // Check if this is an Enter key that should be blocked
      const isComposing = (e.nativeEvent as any).isComposing || dialogComposition.justEndedComposing();

      // If Enter key is pressed while composing or just after composition ended,
      // don't call the user's onKeyDown (this blocks the business logic)
      if (e.key === "Enter" && isComposing) {
        return;
      }

      // Otherwise, call the user's onKeyDown
      onKeyDown?.(e);
    },
    onCompositionStart: e => {
      dialogComposition.setComposing(true);
      onCompositionStart?.(e);
    },
    onCompositionEnd: e => {
      // Mark that composition just ended - this helps handle the Enter key that confirms input
      dialogComposition.markCompositionEnd();
      // Delay setting composing to false to handle Safari's event order
      // In Safari, compositionEnd fires before the ESC keydown event
      setTimeout(() => {
        dialogComposition.setComposing(false);
      }, 100);
      onCompositionEnd?.(e);
    },
  });

  const hasStepper = type === "number" && stepper;
  // One stepper per field: clicks move point-by-point (0.1); fields that
  // declare a whole-number step (quantities, counts) move by that instead.
  const stepAttrNum = props.step != null ? parseFloat(String(props.step)) : NaN;
  const isIntegerField = Number.isFinite(stepAttrNum) && stepAttrNum >= 1;
  const clickStep = isIntegerField ? stepAttrNum : 0.1;

  const innerRef = React.useRef<HTMLInputElement | null>(null);
  const delayTimer = React.useRef<number | null>(null);
  const repeatTimer = React.useRef<number | null>(null);

  const setRefs = (el: HTMLInputElement | null) => {
    innerRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const stopRepeat = () => {
    if (delayTimer.current !== null) {
      window.clearTimeout(delayTimer.current);
      delayTimer.current = null;
    }
    if (repeatTimer.current !== null) {
      window.clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  };

  React.useEffect(() => stopRepeat, []);

  const stepBy = (delta: number) => {
    const el = innerRef.current;
    if (!el || el.disabled || el.readOnly) return;
    const parsed = parseFloat(el.value);
    const base = Number.isFinite(parsed) ? parsed : 0;
    const decimals = Math.min(Math.max(decimalsOf(Math.abs(delta)), decimalsOf(base)), 10);
    let next = Number((base + delta).toFixed(decimals));
    if (el.min !== "" && Number.isFinite(Number(el.min))) next = Math.max(next, Number(el.min));
    if (el.max !== "" && Number.isFinite(Number(el.max))) next = Math.min(next, Number(el.max));
    // Go through the native setter + input event so controlled React inputs
    // (value/onChange) see the change exactly like a keystroke.
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setValue?.call(el, String(next));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  // Click steps once; press-and-hold repeats. preventDefault keeps focus
  // where it is (typically the input) instead of moving it to the button.
  const pressHandlers = (delta: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      stopRepeat();
      stepBy(delta);
      delayTimer.current = window.setTimeout(() => {
        repeatTimer.current = window.setInterval(() => stepBy(delta), HOLD_REPEAT_MS);
      }, HOLD_DELAY_MS);
    },
    onPointerUp: stopRepeat,
    onPointerLeave: stopRepeat,
    onPointerCancel: stopRepeat,
  });

  const split = hasStepper ? splitLayoutClasses(className) : undefined;

  const inputEl = (
    <input
      ref={hasStepper ? setRefs : ref}
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        hasStepper ? split?.input : className,
        // Reserve room on the right for the single stepper pill.
        hasStepper && "pr-14"
      )}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );

  if (!hasStepper) return inputEl;

  const stepperDisabled = props.disabled || props.readOnly;
  const stepperButton =
    "inline-flex h-6 w-6 select-none touch-manipulation items-center justify-center bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className={cn("relative w-full", split?.wrapper)}>
      {inputEl}
      {/* Single [− +] pill; dir=ltr keeps − left / + right in RTL pages too */}
      <div
        className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center overflow-hidden rounded-md border border-input bg-background shadow-xs"
        dir="ltr"
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="decrease"
          disabled={stepperDisabled}
          className={stepperButton}
          {...pressHandlers(-clickStep)}
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="h-4 w-px bg-input" />
        <button
          type="button"
          tabIndex={-1}
          aria-label="increase"
          disabled={stepperDisabled}
          className={stepperButton}
          {...pressHandlers(clickStep)}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export { Input };
