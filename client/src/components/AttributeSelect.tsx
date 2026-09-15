import { useMemo, useState } from "react";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { rankOptions, readOptionUsage, recordOptionUse } from "@/lib/optionUsage";

/**
 * A picker that learns.
 *
 * The owner's rule (Sep 2026), meant for every list in the app: what gets
 * picked most rises to the top, and among equals the one picked last. The
 * lists in settings are curated once and then read hundreds of times, and a
 * shop that turns out to sell mostly clothes should not scroll past Shoes
 * and Jewellery every single order.
 *
 * The few promoted sit in their own group under a heading, so the change in
 * order explains itself; everything else keeps exactly the order it was
 * given. A list nobody has used yet looks precisely as it always did.
 *
 * `usageKey` names the list, not the field — two screens picking a product
 * type should share what they have learned, so they pass the same key.
 */
export interface AttributeOption {
  /** What is stored, and what the ranking remembers. */
  value: string;
  /** What is shown; defaults to the value. */
  label?: string;
}

interface AttributeSelectProps {
  /** Which list this is: "productType", "color", "size", "platform"… */
  usageKey: string;
  options: AttributeOption[] | undefined;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** The "— none —" row's text. Omit for a list that cannot be cleared. */
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
  /** Controlled open state, for a form that opens it to point at a gap. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const NONE = "__none__";

export function AttributeSelect({
  usageKey,
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  className,
  disabled,
  open,
  onOpenChange,
}: AttributeSelectProps) {
  const { language } = useTranslation();

  /**
   * Read once per open, not on every keystroke elsewhere on the form: the
   * order must not rearrange itself under a finger that is already moving
   * toward a row. Bumped when a pick is made, so the next open reflects it.
   */
  const [usageVersion, setUsageVersion] = useState(0);
  const usage = useMemo(() => readOptionUsage(usageKey), [usageKey, usageVersion]);

  const { top, rest } = useMemo(
    () => rankOptions(options ?? [], usage, (o) => o.value),
    [options, usage],
  );

  const row = (o: AttributeOption) => (
    <SelectItem key={o.value} value={o.value}>{o.label ?? o.value}</SelectItem>
  );

  return (
    <Select
      value={value}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
      onValueChange={(v) => {
        const picked = v === NONE ? "" : v;
        onChange(picked);
        if (picked) {
          recordOptionUse(usageKey, picked);
          setUsageVersion((n) => n + 1);
        }
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {emptyLabel && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
        {top.length > 0 && (
          <>
            <SelectGroup>
              <SelectLabel className="text-[11px] text-muted-foreground">
                {pickLang(language, {
                  ku: "زۆرترین بەکارهاتوو",
                  en: "Used most",
                  ar: "الأكثر استخداماً",
                  zh: "最常用",
                })}
              </SelectLabel>
              {top.map(row)}
            </SelectGroup>
            {rest.length > 0 && <SelectSeparator />}
          </>
        )}
        {rest.map(row)}
      </SelectContent>
    </Select>
  );
}

/** The trigger height the order forms use, kept here so callers stay short. */
export const attributeTriggerClass = (extra?: string) => cn("h-10", extra);
