import { useTranslation } from "@/lib/i18n";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { clientOptions } from "@/lib/select-options";
import type { Client } from "@shared/schema";

interface ClientComboboxProps {
  clients: Client[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Kept for the forms that already use it; it is the shared searchable select with the client list
export function ClientCombobox({ clients, value, onChange, placeholder = "Select a client" }: ClientComboboxProps) {
  const { t } = useTranslation();
  return (
    <SearchableSelect
      options={clientOptions(clients)}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder}
      searchPlaceholder={t("common.search")}
      data-testid="button-client-combobox"
    />
  );
}
