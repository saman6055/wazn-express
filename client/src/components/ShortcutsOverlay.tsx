import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useTranslation } from "@/contexts/LanguageContext";

/**
 * Self-contained keyboard-shortcuts overlay.
 * Listens for the "?" key (when not typing) and shows a Dialog of shortcuts.
 * Manages its own open state — render once anywhere (e.g. in the app shell).
 * Presentational only: no data fetching, no business logic.
 */
export function ShortcutsOverlay() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        node.isContentEditable
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // "?" usually requires Shift; ignore other modifiers / typing contexts.
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setOpen((prev) => !prev);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shortcuts: { keys: string[]; label: string }[] = [
    {
      keys: ["Ctrl", "K"],
      label: t("shortcuts.commandPalette") || "کردنەوەی فەرماندە",
    },
    {
      keys: ["?"],
      label: t("shortcuts.showShortcuts") || "پیشاندانی قەدبڕەکان",
    },
    {
      keys: ["Esc"],
      label: t("shortcuts.closeDialog") || "داخستنی دیالۆگ",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5 text-muted-foreground" aria-hidden />
            {t("shortcuts.title") || "قەدبڕە تەختەکلیلەکان"}
          </DialogTitle>
          <DialogDescription>
            {t("shortcuts.description") ||
              "ئەم قەدبڕانە بەکاربهێنە بۆ خێراتر کارکردن."}
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
          {shortcuts.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="text-sm text-foreground">{s.label}</span>
              <KbdGroup>
                {s.keys.map((k, i) => (
                  <span key={k} className="flex items-center gap-1">
                    {i > 0 && (
                      <span className="text-xs text-muted-foreground">+</span>
                    )}
                    <Kbd>{k}</Kbd>
                  </span>
                ))}
              </KbdGroup>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export default ShortcutsOverlay;
