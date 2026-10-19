import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

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
  // The one number the screen is about: 28px on phones instead of 22px
  primary?: boolean;
}

export function KpiCard({ title, value, change, icon: Icon, className, description, primary }: KpiCardProps) {
  const { t } = useTranslation();
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-neutral">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-neutral" />
      </CardHeader>
      <CardContent>
        <div className={cn("font-semibold tabular-nums text-text sm:text-2xl sm:font-bold", primary ? "text-2xl" : "text-xl")}>{value}</div>
        {change && (
          <p className={cn(
            "text-xs",
            change.isPositive ? "text-success" : "text-danger"
          )}>
            {change.isPositive ? "+" : ""}{change.value.toFixed(1)}% {t("an.from_last")}
          </p>
        )}
        {description && (
          <p className="text-xs text-neutral mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}