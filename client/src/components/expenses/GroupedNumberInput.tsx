import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * A number with its thousands marked, while it is being typed.
 *
 * 15000 and 150000 are one keystroke and one order of magnitude apart, and
 * on a dinar figure that is the difference between a tank of fuel and a
 * month's rent. Nobody reads a long unbroken run of digits accurately —
 * 15,000 is read at a glance and 15000 is counted.
 *
 * A native `type="number"` cannot show separators at all: the browser owns
 * the display and rejects a comma outright. So this is a text field that
 * formats what it shows and hands the caller the plain number, which also
 * means it loses the +/− pills — a fair trade on a field where stepping by
 * one is meaningless.
 *
 * The digits are kept exactly as typed. A trailing decimal point survives
 * while somebody is mid-number, because reformatting "15." to "15" moves the
 * caret and eats the next keystroke.
 */
export const GroupedNumberInput = React.forwardRef<
  HTMLInputElement,
  {
    value: string;
    onValueChange: (raw: string) => void;
  } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type">
>(({ value, onValueChange, ...props }, ref) => {
  const display = React.useMemo(() => {
    if (value === "") return "";
    const [whole = "", ...rest] = value.split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    // `rest.length` rather than a truthy check: "15." is mid-typing and its
    // point must stay.
    return rest.length > 0 ? `${grouped}.${rest.join("")}` : grouped;
  }, [value]);

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      dir="ltr"
      value={display}
      onChange={(e) => {
        // Everything that is not a digit or a point goes, including the
        // separators this field just put in.
        const cleaned = e.target.value.replace(/[^\d.]/g, "");
        // One point only: a second one is a typo, not a number.
        const firstPoint = cleaned.indexOf(".");
        const raw =
          firstPoint === -1
            ? cleaned
            : cleaned.slice(0, firstPoint + 1) + cleaned.slice(firstPoint + 1).replace(/\./g, "");
        onValueChange(raw);
      }}
    />
  );
});

GroupedNumberInput.displayName = "GroupedNumberInput";
