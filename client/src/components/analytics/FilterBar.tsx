import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Filter } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface FilterBarProps {
  onDateRangeChange: (start: Date | null, end: Date | null) => void;
  onPeriodChange: (period: string) => void;
  onExport: () => void;
  showExport?: boolean;
}

export function FilterBar({ onDateRangeChange, onPeriodChange, onExport, showExport = true }: FilterBarProps) {
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
    { label: "Last 7 days", value: "week" },
    { label: "Last 30 days", value: "month" },
    { label: "Last 3 months", value: "quarter" },
    { label: "Last 12 months", value: "year" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-2">
        <Filter className="h-4 w-4 text-neutral" />
        <span className="text-sm font-medium text-text">Filters:</span>
      </div>

      {/* Quick Period Selection */}
      <Select onValueChange={onPeriodChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Quick periods" />
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
      <div className="flex items-center space-x-2">
        <span className="text-sm text-neutral">From:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-32 justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "MMM dd") : "Start date"}
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

        <span className="text-sm text-neutral">To:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-32 justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "MMM dd") : "End date"}
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

      {/* Export Button */}
      {showExport && (
        <Button onClick={onExport} variant="outline" className="ml-auto">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      )}
    </div>
  );
}