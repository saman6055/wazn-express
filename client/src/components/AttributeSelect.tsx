import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { rankOptions, readOptionUsage, recordOptionUse } from "@/lib/optionUsage";

/**
 * A picker that learns, and that can be searched.
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
 * And it takes typing. The owner, 2026-09-27, looking at a product-type list
 * fifteen long: «لێرەش سێرچ هەبێ». A dropdown that has to be scrolled past
 * Cosmetics, Make up, Furniture, Instrument, Dress, Skirt, Tshirt, Heel,
 * PANT, Pants, Jeans, Set is a dropdown somebody stops reading. Two letters
 * now reach any of them.
 *
 * Built on the command list rather than the select, because a native select
 * swallows keystrokes for its own first-letter jumping and cannot hold a
 * box to type in. What the caller sees is unchanged: the same props, the
 * same value, the same learning.
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

/** Typing is worth offering once a list is longer than a glance. */
const SEARCH_FROM = 8;

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
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

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

  const all = options ?? [];
  const chosen = all.find((o) => o.value === value);
  const showSearch = all.length >= SEARCH_FROM;

  const pick = (next: string) => {
    onChange(next);
    if (next) {
      recordOptionUse(usageKey, next);
      setUsageVersion((n) => n + 1);
    }
    setOpen(false);
  };

  const row = (o: AttributeOption) => (
    <CommandItem
      key={o.value}
      // cmdk matches on this, not on the element's text, so a value whose
      // label differs is still reachable by either.
      value={`${o.label ?? o.value} ${o.value}`}
      onSelect={() => pick(o.value)}
    >
      <Check className={cn("me-2 h-4 w-4", o.value === value ? "opacity-100" : "opacity-0")} />
      {o.label ?? o.value}
    </CommandItem>
  );

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50",
            !chosen && "text-muted-foreground",
            className,
          )}
          data-testid={`attribute-${usageKey}`}
        >
          <span className="truncate">{chosen ? chosen.label ?? chosen.value : placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(18rem,calc(100vw-2rem))] p-0" align="start">
        <Command>
          {showSearch && (
            <CommandInput
              placeholder={pickLang(language, {
                ku: "بگەڕێ…",
                en: "Search…",
                ar: "ابحث…",
                zh: "搜索…",
              })}
            />
          )}
          <CommandList>
            <CommandEmpty>
              {pickLang(language, {
                ku: "هیچ نەدۆزرایەوە",
                en: "Nothing found",
                ar: "لا نتائج",
                zh: "无结果",
              })}
            </CommandEmpty>
            {emptyLabel && (
              <CommandItem value={emptyLabel} onSelect={() => pick("")}>
                <Check className={cn("me-2 h-4 w-4", value ? "opacity-0" : "opacity-100")} />
                {emptyLabel}
              </CommandItem>
            )}
            {top.length > 0 && (
              <>
                <CommandGroup
                  heading={pickLang(language, {
                    ku: "زۆرترین بەکارهاتوو",
                    en: "Used most",
                    ar: "الأكثر استخداماً",
                    zh: "最常用",
                  })}
                >
                  {top.map(row)}
                </CommandGroup>
                {rest.length > 0 && <CommandSeparator />}
              </>
            )}
            <CommandGroup>{rest.map(row)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** The trigger height the order forms use, kept here so callers stay short. */
export const attributeTriggerClass = (extra?: string) => cn("h-10", extra);
