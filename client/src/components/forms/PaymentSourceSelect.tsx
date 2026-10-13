import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { suggestSource, type SourceOption } from "@/lib/payment-source";

const NONE = "__none__"; // the empty choice ("no account") needs a value of its own

interface Props {
  id: string;
  value: string;
  onChange: (id: string) => void;
  label?: string;
  // When given, an unambiguous account for this payment method is chosen for the person until they pick one themselves
  suggestFor?: string;
  // For money received: with no better match the default account is offered
  fallbackToDefault?: boolean;
}

// The account (bank, cash box, wallet) the money goes into or comes out of. Optional: left empty, no balance changes.
export function PaymentSourceSelect({ id, value, onChange, label, suggestFor, fallbackToDefault }: Props) {
  const { t } = useTranslation();
  const { data: sources = [] } = useQuery<SourceOption[]>({ queryKey: ["/api/payment-sources"] });
  const touched = useRef(false);

  useEffect(() => {
    if (suggestFor === undefined || touched.current || sources.length === 0) return;
    onChange(suggestSource(sources, suggestFor, fallbackToDefault));
  }, [suggestFor, sources]); // eslint-disable-line react-hooks/exhaustive-deps

  const usable = sources.filter((s) => s.isActive !== false || s.id === value);
  return (
    <div>
      <Label htmlFor={id}>{label ?? t("paysrc.account")}</Label>
      <SearchableSelect
        id={id}
        options={[
          { value: NONE, label: t("paysrc.none") },
          ...usable.map((s) => ({ value: s.id, label: `${s.name}${s.isDefault ? ` — ${t("paysrc.default")}` : ""}`, keywords: s.name })),
        ]}
        value={value || NONE}
        onValueChange={(v) => { touched.current = true; onChange(v === NONE ? "" : v); }}
        placeholder={t("paysrc.none")}
        data-testid={id}
      />
      <p className="mt-1 text-xs text-muted-foreground">{t("paysrc.hint")}</p>
    </div>
  );
}
