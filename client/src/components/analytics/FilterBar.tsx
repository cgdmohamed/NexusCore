import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Filter } from "lucide-react";
import { format } from "@/lib/dateUtils";
import { useTranslation } from "@/lib/i18n";
import { useState } from "react";

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

  return (
    <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 md:gap-4 p-4 bg-muted/50 rounded-lg">
      {/* Label row */}
      <div className="flex items-center space-x-2">
        <Filter className="h-4 w-4 text-neutral" />
        <span className="text-sm font-medium text-text">{t("an.filters")}</span>
      </div>

      {/* Quick Period Selection */}
      <Select onValueChange={onPeriodChange}>
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
