import { useState, type ReactNode } from "react";
import { WifiOff, Loader2, Check, ChevronsUpDown, X } from "lucide-react";
import { searchText, type SelectOption } from "@/lib/select-options";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useKeyboard } from "./keyboard";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

export const inputCls =
  "h-12 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

// iOS gives date inputs their own minimum width and hides an empty value; this keeps them inside the form
export const dateInputCls = `${inputCls} block min-w-0 max-w-full appearance-none text-start [&::-webkit-date-and-time-value]:min-h-[1.5em] [&::-webkit-date-and-time-value]:text-start`;

export function BottomSheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const { inset, height } = useKeyboard();
  // With the keyboard up the sheet rests on top of it and never grows taller than what is visible
  const style = {
    bottom: inset,
    maxHeight: height ? `min(92dvh, ${Math.floor(height) - 12}px)` : undefined,
  };
  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[92dvh]" style={style}>
        {/* Swiping down closes a sheet, but a visible way to close it is always offered too */}
        <div className="flex items-center justify-between gap-2 ps-4 pe-1 pt-2">
          <DrawerTitle className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</DrawerTitle>
          <DrawerClose aria-label={t("m.close")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted" data-testid="sheet-close">
            <X className="h-5 w-5" />
          </DrawerClose>
        </div>
        <DrawerDescription className="sr-only">{title}</DrawerDescription>
        <div
          className="overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"
          onFocus={(e) => {
            const el = e.target as HTMLElement;
            if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
          }}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function Field({ label, children, error }: { label: string; children: ReactNode; error?: string | null }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {error && <span className="block text-sm text-danger">{error}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, disabled }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-11 flex-1 rounded-md px-2 text-sm font-medium transition-colors",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function OfflineBanner() {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex items-center gap-2 bg-warning-soft px-4 py-2 text-sm text-warning">
      <WifiOff className="h-4 w-4 shrink-0" />
      {t("m.offline")}
    </div>
  );
}

export function ListState({ loading, error, empty, emptyTitle, emptyHint, onRetry, children }: {
  loading: boolean; error: boolean; empty: boolean; emptyTitle: string; emptyHint?: string; onRetry: () => void; children: ReactNode;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("m.load_failed")}</p>
        <button onClick={onRetry} className="mt-3 h-11 rounded-lg border border-border px-5 text-sm font-medium">{t("m.retry")}</button>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="font-medium text-foreground">{emptyTitle}</p>
        {emptyHint && <p className="mt-1 text-sm text-muted-foreground">{emptyHint}</p>}
      </div>
    );
  }
  return <>{children}</>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      enterKeyHint="search"
      className={inputCls}
      aria-label={placeholder}
    />
  );
}

// A searchable list for phone forms. It opens inline, in the page, rather than in a floating layer: a layer opened from
// inside a bottom sheet fights the sheet for focus and the keyboard.
export function SearchPicker({ value, onChange, options, placeholder, searchPlaceholder, emptyText }: {
  value: string; onChange: (v: string) => void; options: SelectOption[]; placeholder: string; searchPlaceholder?: string; emptyText?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => searchText(o).toLowerCase().includes(q)) : options;

  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={cn(inputCls, "flex items-center justify-between gap-2 text-start")} data-testid="search-picker">
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? selected.label : placeholder}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-border bg-card">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder ?? t("common.search")} className="h-12 w-full border-b border-border bg-background px-3 text-base focus:outline-none" autoFocus data-testid="search-picker-input" />
          <ul className="max-h-56 overflow-y-auto overscroll-contain">
            {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">{emptyText ?? t("common.noResults")}</li>}
            {shown.map((o) => (
              <li key={o.value}>
                <button type="button" onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-start text-base active:bg-accent">
                  <Check className={cn("h-4 w-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0"><span className="block truncate">{o.label}</span>{o.description && <span className="block truncate text-xs text-muted-foreground">{o.description}</span>}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
