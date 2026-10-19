import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Filter } from "lucide-react";
import { format } from "@/lib/dateUtils";
import { useTranslation } from "@/lib/i18n";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { BottomSheet, Field, dateInputCls } from "@/mobile/ui";

interface FilterBarProps {
  onDateRangeChange: (start: Date | null, end: Date | null) => void;
  onPeriodChange: (period: string) => void;
  onExport: () => void;
  showExport?: boolean;
}

export function FilterBar({ onDateRangeChange, onPeriodChange, onExport, showExport = true }: FilterBarProps) {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const phone = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [preset, setPreset] = useState<string>("month");

  const handleStartDateChange = (date: Date | undefined) => {
    const newDate = date || null;
    setStartDate(newDate);
    onDateRangeChange(newDate, endDate);
  };

  const handleEndDateChange = (date: Date | undefined) => {
    const newDate = date || null;
    setEndDate(newDate);
    onDateRangeChange(startDate, newDate);
  };

  const presetRanges = [
    { label: t("an.last7"), value: "week" },
    { label: t("an.last30"), value: "month" },
    { label: t("an.last3m"), value: "quarter" },
    { label: t("an.last12m"), value: "year" },
  ];

  const toInput = (d: Date | null) => (d ? format(d, "yyyy-MM-dd") : "");
  const fromInput = (v: string) => (v ? new Date(`${v}T00:00:00`) : null);
  const customLabel = startDate || endDate ? `${startDate ? format(startDate, "dd/MM") : "…"} – ${endDate ? format(endDate, "dd/MM") : "…"}` : null;
  const presetLabel = presetRanges.find((r) => r.value === preset)?.label ?? t("an.quick");

  // On a phone the controls fold into one row: the period opens a sheet, export stays one tap away
  if (phone) {
    return (
      <>
        <div className="flex items-center gap-2" data-testid="analytics-filter-row">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 text-start text-sm font-medium active:bg-muted"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="shrink-0 text-muted-foreground">{t("an.period")}:</span>
            <span className="truncate">{customLabel ?? presetLabel}</span>
          </button>
          {showExport && (
            <button
              type="button"
              onClick={onExport}
              aria-label={t("an.export")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-input bg-card active:bg-muted"
            >
              <Download className="h-5 w-5" />
            </button>
          )}
        </div>
        <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title={t("an.period")}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {presetRanges.map((range) => (
                <button
                  key={range.value}
                  type="button"
                  aria-pressed={!customLabel && preset === range.value}
                  onClick={() => { setStartDate(null); setEndDate(null); setPreset(range.value); onPeriodChange(range.value); setSheetOpen(false); }}
                  className={`h-11 rounded-lg border px-3 text-sm font-medium ${!customLabel && preset === range.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("an.start")}>
                <input type="date" className={dateInputCls} value={toInput(startDate)} onChange={(e) => { const d = fromInput(e.target.value); setStartDate(d); onDateRangeChange(d, endDate); }} />
              </Field>
              <Field label={t("an.end")}>
                <input type="date" className={dateInputCls} value={toInput(endDate)} onChange={(e) => { const d = fromInput(e.target.value); setEndDate(d); onDateRangeChange(startDate, d); }} />
              </Field>
            </div>
          </div>
        </BottomSheet>
      </>
    );
  }

  return (
    <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 md:gap-4 p-4 bg-muted/50 rounded-lg">
      {/* Label row */}
      <div className="flex items-center space-x-2">
        <Filter className="h-4 w-4 text-neutral" />
        <span className="text-sm font-medium text-text">{t("an.filters")}</span>
      </div>

      {/* Quick Period Selection */}
      <Select onValueChange={(v) => { setPreset(v); onPeriodChange(v); }}>
        <SelectTrigger className="w-full md:w-40">
          <SelectValue placeholder={t("an.quick")} />
        </SelectTrigger>
        <SelectContent>
          {presetRanges.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Custom Date Range */}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral whitespace-nowrap w-10">{t("an.from")}</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 md:flex-none md:w-32 justify-start text-start font-normal">
                <CalendarIcon className="me-2 h-4 w-4 shrink-0" />
                {startDate ? format(startDate, "MMM dd") : t("an.start")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate || undefined}
                onSelect={handleStartDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral whitespace-nowrap w-10 md:w-auto">{t("an.to")}</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 md:flex-none md:w-32 justify-start text-start font-normal">
                <CalendarIcon className="me-2 h-4 w-4 shrink-0" />
                {endDate ? format(endDate, "MMM dd") : t("an.end")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate || undefined}
                onSelect={handleEndDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Export Button */}
      {showExport && (
        <Button onClick={onExport} variant="outline" className="w-full md:w-auto md:ms-auto">
          <Download className="me-2 h-4 w-4" />
          {t("an.export")}
        </Button>
      )}
    </div>
  );
}
