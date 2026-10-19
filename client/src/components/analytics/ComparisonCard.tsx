import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

interface ComparisonCardProps {
  title: string;
  currentValue: number;
  previousValue: number;
  change: {
    absolute: number;
    percentage: number;
    isNew?: boolean;
  };
  formatter?: (value: number) => string;
}

export function ComparisonCard({
  title,
  currentValue,
  previousValue,
  change,
  formatter = (val) => Number(val.toFixed(2)).toString(),
}: ComparisonCardProps) {
  const { t } = useTranslation();
  const isPositive = change.percentage > 0;
  const isNeutral = change.percentage === 0;

  const absChange = Math.abs(change.absolute);
  const absPct = Math.abs(change.percentage);

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
              isPositive ? "bg-success-soft text-success" :
              isNeutral ? "bg-muted text-muted-foreground" :
              "bg-danger-soft text-danger"
            )}>
              {isNeutral ? (
                <Minus className="h-3 w-3" />
              ) : isPositive ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              <span>{change.isNew ? t("an.new") : `${absPct >= 10 ? absPct.toFixed(0) : absPct.toFixed(1)}%`}</span>
            </div>
            <span className="text-xs text-neutral">
              {isPositive ? "+" : isNeutral ? "" : "-"}{formatter(absChange)} {t("an.vs_previous")}
            </span>
          </div>

          <div className="text-xs text-neutral">
            {t("an.previous")}: {formatter(previousValue)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
