import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import { INPUT_CURRENCIES, isInputCurrency, parseRate, type InputCurrency } from "@/lib/currency-input";
import { convertRows, rowsToCsv } from "@/lib/export-currency";

interface DataExportButtonProps {
  data: any[];
  filename: string;
  type: 'csv' | 'json';
  // Money columns (stored in EGP). When given, the export can be made in another currency.
  amountFields?: string[];
}

const RATES_KEY = "nx.fx.rates";
function savedRates(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(RATES_KEY) || "{}") || {}; } catch { return {}; }
}
function saveRate(currency: string, rate: string) {
  try { localStorage.setItem(RATES_KEY, JSON.stringify({ ...savedRates(), [currency]: rate })); } catch { /* storage may be unavailable */ }
}

export function DataExportButton({ data, filename, type, amountFields }: DataExportButtonProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<InputCurrency>("EGP");
  const [rate, setRate] = useState("");

  const download = (rows: any[]) => {
    try {
      let content: string;
      let mimeType: string;

      if (type === 'csv') {
        if (rows.length === 0) {
          toast({
            title: "No data to export",
            description: "There are no records to export.",
            variant: "destructive",
          });
          return;
        }
        content = rowsToCsv(rows);
        mimeType = 'text/csv';
      } else {
        content = JSON.stringify(rows, null, 2);
        mimeType = 'application/json';
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.${type}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `Data exported as ${filename}.${type}`,
      });
      setOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const changeCurrency = (next: string) => {
    if (!isInputCurrency(next)) return;
    setCurrency(next);
    setRate(next === "EGP" ? "" : savedRates()[next] ?? "");
  };

  const confirm = () => {
    if (parseRate(currency, rate) === null) {
      toast({ title: t("export.rate_invalid"), variant: "destructive" });
      return;
    }
    if (currency !== "EGP") saveRate(currency, rate);
    download(convertRows(data, amountFields ?? [], currency, rate));
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => (amountFields ? setOpen(true) : download(data))}
        className="flex items-center space-x-1"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
      </Button>

      {amountFields && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("export.title")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("export.currency")}</Label>
                <Select value={currency} onValueChange={changeCurrency}>
                  <SelectTrigger data-testid="select-export-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INPUT_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {currency !== "EGP" && (
                <div className="space-y-1.5">
                  <Label htmlFor="export-rate">{t("money.rate_label", { cur: currency })}</Label>
                  <Input
                    id="export-rate"
                    type="number"
                    step="0.0001"
                    min="0"
                    inputMode="decimal"
                    placeholder="50.00"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    data-testid="input-export-rate"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">{t("export.rows_hint", { n: String(data.length) })}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={confirm} data-testid="button-confirm-export">{t("common.export")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
