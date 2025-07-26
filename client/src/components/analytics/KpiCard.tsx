import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    isPositive: boolean;
  };
  icon: LucideIcon;
  className?: string;
  description?: string;
}

export function KpiCard({ title, value, change, icon: Icon, className, description }: KpiCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-neutral">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-neutral" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-text">{value}</div>
        {change && (
          <p className={cn(
            "text-xs",
            change.isPositive ? "text-green-600" : "text-red-600"
          )}>
            {change.isPositive ? "+" : ""}{change.value.toFixed(1)}% from last period
          </p>
        )}
        {description && (
          <p className="text-xs text-neutral mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}