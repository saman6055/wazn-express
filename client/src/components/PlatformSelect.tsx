import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, Loader2, X } from "lucide-react";

/**
 * Which shop an order was placed on (Taobao, 1688, …).
 *
 * Platforms are rows in productAttributes (type "platform"), not a hard-coded
 * enum, so an admin can add their own without a migration. Because the list is
 * open-ended we badge each one with a coloured letter derived from its name
 * rather than shipping brand logos: a newly added platform gets a sensible
 * badge for free, and there are no trademarked assets to bundle.
 */

/** Remembers the last shop used, so a run of orders from one platform doesn't
 *  need it re-picked each time. Shared by the commission and full-package forms. */
export const LAST_PLATFORM_KEY = "wazn-last-order-platform";

// Brand-ish colours for the platforms shipped by default. Anything else falls
// back to a stable colour picked from its name, so a custom platform keeps the
// same badge every time it renders.
const KNOWN_COLORS: Record<string, string> = {
  taobao: "#FF4400",
  pinduoduo: "#E22E1F",
  alibaba: "#BA7517",
  aliexpress: "#D4537E",
  wechat: "#07C160",
  weixin: "#07C160",
  "1688": "#378ADD",
};

const FALLBACK_COLORS = ["#7F77DD", "#1D9E75", "#D85A30", "#378ADD", "#BA7517", "#D4537E"];

export function platformColor(name: string): string {
  const key = name.trim().toLowerCase();
  if (KNOWN_COLORS[key]) return KNOWN_COLORS[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

/** Badge text: "16" for 1688, otherwise the first letter. */
export function platformInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return /^\d/.test(trimmed) ? trimmed.slice(0, 2) : trimmed[0].toUpperCase();
}

function PlatformBadge({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-md font-semibold text-white shrink-0"
      style={{ width: size, height: size, background: platformColor(name), fontSize: size * 0.45 }}
    >
      {platformInitials(name)}
    </span>
  );
}

interface PlatformSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function PlatformSelect({ value, onChange, className }: PlatformSelectProps) {
  const { language } = useTranslation();
  const { user } = useAuth();
  const role = (user as any)?.role;
  const canAdd = role === "admin" || role === "super_admin";

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const utils = trpc.useUtils();
  const { data: platforms } = trpc.productAttributes.list.useQuery({ type: "platform" });

  const createMutation = trpc.productAttributes.create.useMutation({
    onSuccess: (created: any) => {
      utils.productAttributes.list.invalidate({ type: "platform" });
      onChange(created?.value ?? newName.trim());
      setAdding(false);
      setNewName("");
      setOpen(false);
      toast.success(pickLang(language, { ku: "پلاتفۆرم زیاد کرا", en: "Platform added", ar: "تمت إضافة المنصة", zh: "已添加平台" }));
    },
    onError: (err) => toast.error(err.message),
  });

  const list = (platforms ?? []).filter((p: any) => p.isActive !== false);
  const filtered = search.trim()
    ? list.filter((p: any) => p.value.toLowerCase().includes(search.trim().toLowerCase()))
    : list;

  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    // Don't create a duplicate — just select the existing one.
    const existing = list.find((p: any) => p.value.toLowerCase() === name.toLowerCase());
    if (existing) {
      onChange((existing as any).value);
      setAdding(false);
      setNewName("");
      setOpen(false);
      return;
    }
    createMutation.mutate({ type: "platform", value: name, sortOrder: list.length });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) { setAdding(false); setNewName(""); setSearch(""); }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-10 font-normal", className)}
        >
          {value ? (
            <span className="flex items-center gap-2 min-w-0">
              <PlatformBadge name={value} size={20} />
              <span className="truncate">{value}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              {pickLang(language, { ku: "پلاتفۆرم هەڵبژێرە", en: "Select a platform", ar: "اختر منصة", zh: "选择平台" })}
            </span>
          )}
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent variant="panel" className="w-[--radix-popover-trigger-width] min-w-[240px]" align="start">
        {/* shouldFilter={false} — filtering happens above so a search matches
            the platform name itself, not the rendered row. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={pickLang(language, { ku: "گەڕان...", en: "Search...", ar: "بحث...", zh: "搜索..." })}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {pickLang(language, { ku: "هیچ پلاتفۆرمێک نەدۆزرایەوە", en: "No platform found", ar: "لم يتم العثور على منصة", zh: "未找到平台" })}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((p: any) => (
                <CommandItem
                  key={p.id}
                  value={p.value}
                  onSelect={() => { onChange(p.value); setOpen(false); setSearch(""); }}
                >
                  <Check className={cn("me-2 h-4 w-4", value === p.value ? "opacity-100" : "opacity-0")} />
                  <span className="flex items-center gap-2">
                    <PlatformBadge name={p.value} />
                    <span>{p.value}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        {/* Add a platform — admins only, matching productAttributes.create. */}
        {canAdd && (
          <div className="border-t p-2">
            {adding ? (
              <div className="flex items-center gap-1.5">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); submitNew(); }
                    if (e.key === "Escape") { setAdding(false); setNewName(""); }
                  }}
                  placeholder={pickLang(language, { ku: "ناوی پلاتفۆرم", en: "Platform name", ar: "اسم المنصة", zh: "平台名称" })}
                  className="h-8 text-sm"
                />
                <Button type="button" size="sm" className="h-8 px-2" onClick={submitNew} disabled={createMutation.isPending || !newName.trim()}>
                  {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setAdding(false); setNewName(""); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 text-primary"
                onClick={() => { setAdding(true); setNewName(search); }}
              >
                <Plus className="me-2 h-4 w-4" />
                {pickLang(language, { ku: "زیادکردنی پلاتفۆرمی نوێ...", en: "Add a new platform...", ar: "إضافة منصة جديدة...", zh: "添加新平台..." })}
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
