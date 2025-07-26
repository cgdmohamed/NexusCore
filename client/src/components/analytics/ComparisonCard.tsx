import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonCardProps {
  title: string;
  currentValue: number;
  previousValue: number;
  change: {
    absolute: number;
    percentage: number;
  };
  formatter?: (value: number) => string;
}

export function ComparisonCard({ 
  title, 
  currentValue, 
  previousValue, 
  change, 
  formatter = (val) => val.toString() 
}: ComparisonCardProps) {
  const isPositive = change.percentage > 0;
  const isNeutral = change.percentage === 0;

  const formatChange = (value: number) => {
    if (formatter.toString().includes('currency')) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.abs(value));
    }
    return Math.abs(value).toString();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-neutral">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-text">
            {formatter(currentValue)}
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={cn(
              "flex items-center space-x-1 text-xs px-2 py-1 rounded-full",
              isPositive ? "bg-green-100 text-green-700" :
              isNeutral ? "bg-gray-100 text-gray-600" :
              "bg-red-100 text-red-700"
            )}>
              {isNeutral ? (
                <Minus className="h-3 w-3" />
              ) : isPositive ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              <span>{Math.abs(change.percentage).toFixed(1)}%</span>
            </div>
            <span className="text-xs text-neutral">
              {isPositive ? "+" : isNeutral ? "" : "-"}{formatChange(change.absolute)} vs previous period
            </span>
          </div>
          
          <div className="text-xs text-neutral">
            Previous: {formatter(previousValue)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}