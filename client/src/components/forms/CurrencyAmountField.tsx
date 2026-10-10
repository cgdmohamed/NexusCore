import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency } from "@/lib/currency";
import { INPUT_CURRENCIES, fromEgp, isInputCurrency, toEgp, type InputCurrency } from "@/lib/currency-input";

interface Props {
  // Pounds, as a string. This is the only thing the form ever sees.
  value: string;
  onChange: (egp: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  placeholder?: string;
  min?: string;
  className?: string;
}

const RATES_KEY = "nx.fx.rates";
const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch { /* storage may be unavailable */ } };

function savedRates(): Record<string, string> {
  try { return JSON.parse(read(RATES_KEY) || "{}") || {}; } catch { return {}; }
}

// A money field that accepts dollars or riyals with the exchange rate and hands the form pounds
export function CurrencyAmountField({ value, onChange, onBlur, id, name, placeholder = "0.00", min = "0", className }: Props) {
  const { t } = useTranslation();
  // Every field starts in pounds, so opening an item never changes how another one is shown or saved
  const [currency, setCurrency] = useState<InputCurrency>("EGP");
  const [rate, setRate] = useState<string>("");
  const [typed, setTyped] = useState<string>(value);
  const lastEmitted = useRef(value);

  const emit = (text: string, cur: InputCurrency, r: string) => {
    const egp = cur === "EGP" ? text : (() => { const n = toEgp(text, cur, r); return n === null ? "" : n.toFixed(2); })();
    lastEmitted.current = egp;
    onChange(egp);
  };

  // The form may set the amount itself (a service's default price, opening an item to edit): show it in the current currency
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    if (currency === "EGP") { setTyped(value); return; }
    const back = fromEgp(value, currency, rate);
    setTyped(back === null ? "" : String(back));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeCurrency = (next: string) => {
    if (!isInputCurrency(next) || next === currency) return;
    const nextRate = next === "EGP" ? "" : savedRates()[next] ?? "";
    setCurrency(next);
    setRate(nextRate);
    if (next === "EGP") {
      // The pounds already stored stay as they are
      const back = value || typed;
      setTyped(back);
      emit(back, "EGP", "");
      return;
    }
    // With a known rate the amount keeps its value in pounds; otherwise the typed number is kept and waits for a rate
    const back = value ? fromEgp(value, next, nextRate) : null;
    if (back !== null) { setTyped(String(back)); return; } // only the display changes, so rounding never alters the stored pounds
    emit(typed, next, nextRate);
  };

  const changeRate = (next: string) => {
    setRate(next);
    write(RATES_KEY, JSON.stringify({ ...savedRates(), [currency]: next }));
    emit(typed, currency, next);
  };

  // What will be saved is what the form holds
  const converted = currency === "EGP" || value === "" ? null : parseFloat(value);
  const rateMissing = currency !== "EGP" && toEgp("0", currency, rate) === null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          name={name}
          type="number"
          step="0.01"
          min={min}
          inputMode="decimal"
          placeholder={placeholder}
          value={typed}
          className={className}
          onBlur={onBlur}
          onChange={(e) => { setTyped(e.target.value); emit(e.target.value, currency, rate); }}
        />
        <Select value={currency} onValueChange={changeCurrency}>
          <SelectTrigger className="w-24 shrink-0" aria-label={t("money.currency")} data-testid="select-input-currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INPUT_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {currency !== "EGP" && (
        <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
          <Label className="text-xs text-muted-foreground" htmlFor={id ? `${id}-rate` : undefined}>{t("money.rate_label", { cur: currency })}</Label>
          <Input
            id={id ? `${id}-rate` : undefined}
            type="number"
            step="0.0001"
            min="0"
            inputMode="decimal"
            value={rate}
            placeholder="50.00"
            onChange={(e) => changeRate(e.target.value)}
            data-testid="input-input-rate"
          />
          <p className={rateMissing ? "text-xs text-danger" : "text-xs text-muted-foreground tabular-nums"}>
            {rateMissing ? t("money.rate_required") : converted === null || !Number.isFinite(converted) ? "" : t("money.converted", { amount: formatCurrency(converted) })}
          </p>
        </div>
      )}
    </div>
  );
}
