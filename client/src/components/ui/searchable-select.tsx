import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SelectOption {
  value: string;
  label: string;
  // A second line under the label, also searched
  description?: string;
  // Extra words the search should match
  keywords?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

// What the search matches against: the label, the description, any extra words, and the id (which also keeps every row unique)
export function searchText(o: SelectOption): string {
  return [o.label, o.description, o.keywords, o.value].filter(Boolean).join(" ");
}

export interface SearchableSelectProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange"> {
  options: SelectOption[];
  value?: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
}

// A drop-in replacement for a Select whose options come from data: the list can be searched, which matters once it grows.
// It accepts the props FormControl passes (id, aria-*), so it works inside react-hook-form fields unchanged.
export const SearchableSelect = React.forwardRef<HTMLButtonElement, SearchableSelectProps>(function SearchableSelect(
  { options, value, onValueChange, placeholder, searchPlaceholder, emptyText, loading, className, disabled, ...props },
  ref,
) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    // modal: the list scrolls with the wheel even when opened from inside a dialog
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-placeholder={selected ? undefined : ""}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-start text-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.icon}
            <span className="truncate">{selected ? selected.label : placeholder ?? ""}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[12rem] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? t("common.search")} data-testid="searchable-select-input" />
          <CommandList>
            <CommandEmpty>{loading ? t("common.loading") : emptyText ?? t("common.noResults")}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={searchText(o)}
                  disabled={o.disabled}
                  onSelect={() => { onValueChange(o.value); setOpen(false); }}
                  data-testid={`option-${o.value}`}
                >
                  <Check className={cn("me-2 h-4 w-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
                  {o.icon && <span className="me-2 shrink-0">{o.icon}</span>}
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.description && <span className="block truncate text-xs text-muted-foreground">{o.description}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
