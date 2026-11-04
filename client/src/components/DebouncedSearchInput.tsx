import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type InputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange">;

/**
 * A search box that keeps its own text.
 *
 * On a big screen the search text used to live in the page, so every letter
 * redrew the whole page before the next could appear: a hundred milliseconds
 * and more per key on a phone, and the typing itself felt heavy. Here a letter
 * redraws only this box. The page hears about it once the typing pauses, or
 * at once on Enter, which is what a barcode scanner sends.
 *
 * `value` still wins from outside: a clear button or a link empties the box.
 */
export function DebouncedSearchInput({
  value,
  onValueChange,
  delayMs = 150,
  onKeyDown,
  ...props
}: InputProps & {
  value: string;
  onValueChange: (next: string) => void;
  delayMs?: number;
}) {
  const [text, setText] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(onValueChange);
  latest.current = onValueChange;

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <Input
      {...props}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => latest.current(next), delayMs);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          window.clearTimeout(timer.current);
          latest.current(text);
        }
        onKeyDown?.(e);
      }}
    />
  );
}
