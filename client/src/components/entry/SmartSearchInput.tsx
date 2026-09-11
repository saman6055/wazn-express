import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { cleanTrackingPaste } from "@/lib/entry/cleanPaste";
import { useSearchHistory } from "@/hooks/entry/useSearchHistory";
import { useFocusShortcut } from "@/hooks/entry/useFocusShortcut";

interface SmartSearchInputProps {
  /** Which box this is — each keeps its own list: "tracking", "customer", "batch"… */
  scope: string;
  value: string;
  onChange: (value: string) => void;
  /** Enter, or a past search picked from the list. */
  onSearch?: (value: string) => void;
  placeholder?: string;
  /** "tracking": a paste keeps only the tracking number (lib/entry/cleanPaste.ts). */
  paste?: "tracking" | "as-is";
  /** Ctrl+/ puts the cursor here. One box per page should ask for it. */
  focusShortcut?: boolean;
  id?: string;
  className?: string;
}

/**
 * A search box that remembers.
 *
 * Click into it: the last eight searches of this box, from this browser — no
 * server involved. Type: an earlier search that starts the same way is offered
 * underneath, and Tab takes it. Paste a tracking number from a chat: the
 * Chinese label, the spaces and the invisible marks are dropped. Ctrl+/ from
 * anywhere on the page puts the cursor here.
 */
export function SmartSearchInput({
  scope,
  value,
  onChange,
  onSearch,
  placeholder,
  paste = "as-is",
  focusShortcut = false,
  id,
  className,
}: SmartSearchInputProps) {
  const { language } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { history, remember, clear, suggest } = useSearchHistory(scope);
  const [open, setOpen] = useState(false);
  useFocusShortcut(inputRef, focusShortcut);

  const suggestion = suggest(value);
  const showList = open && value.trim() === "" && history.length > 0;

  const search = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    remember(clean);
    onSearch?.(clean);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") search(value);
    else if (e.key === "Tab" && !e.shiftKey && suggestion) {
      e.preventDefault();
      onChange(suggestion);
    } else if (e.key === "Escape") setOpen(false);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (paste !== "tracking") return;
    const cleaned = cleanTrackingPaste(e.clipboardData.getData("text/plain"));
    if (!cleaned) return;
    e.preventDefault();
    onChange(cleaned);
  };

  const words = {
    recent: pickLang(language, { ku: "دواین گەڕانەکان", en: "Recent searches", ar: "عمليات البحث الأخيرة", zh: "最近搜索" }),
    clear: pickLang(language, { ku: "سڕینەوەی لیستەکە", en: "Clear list", ar: "مسح القائمة", zh: "清除列表" }),
    take: pickLang(language, { ku: "Tab بۆ وەرگرتن", en: "Tab to use", ar: "Tab للاستخدام", zh: "按 Tab 使用" }),
  };

  // mousedown is stopped on the list so picking an item does not blur the box first.
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

  return (
    <div className={cn("relative", className)}>
      <Input
        ref={inputRef}
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        dir="auto"
      />
      {suggestion && (
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => onChange(suggestion)}
          className="mt-1 flex max-w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <span dir="auto" className="truncate font-medium text-foreground/70">{suggestion}</span>
          <span aria-hidden="true">·</span>
          <span>{words.take}</span>
        </button>
      )}
      {showList && (
        <div id={listId} role="listbox" aria-label={words.recent} className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground">
            <span>{words.recent}</span>
            <button type="button" onMouseDown={keepFocus} onClick={clear} className="hover:text-foreground">
              {words.clear}
            </button>
          </div>
          {history.map((term) => (
            <button
              key={term}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={keepFocus}
              onClick={() => {
                onChange(term);
                search(term);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-start text-sm hover:bg-accent focus-visible:bg-accent"
            >
              <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span dir="auto" className="truncate">{term}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
