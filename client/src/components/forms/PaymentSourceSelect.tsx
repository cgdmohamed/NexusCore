import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { suggestSource, type SourceOption } from "@/lib/payment-source";

interface Props {
  id: string;
  value: string;
  onChange: (id: string) => void;
  label?: string;
  // When given, an unambiguous account for this payment method is chosen for the person until they pick one themselves
  suggestFor?: string;
}

// The account (bank, cash box, wallet) the money goes into or comes out of. Optional: left empty, no balance changes.
export function PaymentSourceSelect({ id, value, onChange, label, suggestFor }: Props) {
  const { t } = useTranslation();
  const { data: sources = [] } = useQuery<SourceOption[]>({ queryKey: ["/api/payment-sources"] });
  const touched = useRef(false);

  useEffect(() => {
    if (!suggestFor || touched.current || sources.length === 0) return;
    onChange(suggestSource(sources, suggestFor));
  }, [suggestFor, sources]); // eslint-disable-line react-hooks/exhaustive-deps

  const usable = sources.filter((s) => s.isActive !== false || s.id === value);
  return (
    <div>
      <Label htmlFor={id}>{label ?? t("paysrc.account")}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => { touched.current = true; onChange(e.target.value); }}
        className="w-full p-2 border border-input rounded-md bg-background"
        data-testid={id}
      >
        <option value="">{t("paysrc.none")}</option>
        {usable.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">{t("paysrc.hint")}</p>
    </div>
  );
}
