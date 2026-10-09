import type { ReactNode } from "react";
import { WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

export const inputCls =
  "h-12 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function BottomSheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerTitle className="px-4 pt-4 text-lg font-semibold">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">{title}</DrawerDescription>
        <div className="overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">{children}</div>
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
            "h-10 flex-1 rounded-md px-2 text-sm font-medium transition-colors",
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
            "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
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
