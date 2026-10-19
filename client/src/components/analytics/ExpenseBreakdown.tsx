import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";

interface ExpenseBreakdownProps {
  data: Array<{
    category: string;
    totalAmount: number;
    count: number;
  }>;
}

const COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
];

export function ExpenseBreakdown({ data }: ExpenseBreakdownProps) {
  const { t } = useTranslation();

  const pieData = data.map((item, index) => ({
    name: item.category,
    value: item.totalAmount,
    count: item.count,
    color: COLORS[index % COLORS.length]
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-text">{t("an.exp_breakdown")}</CardTitle>
      </CardHeader>
      <CardContent>
        {pieData.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("an.no_expenses")}</p>
        ) : (
        <>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string, props: any) => [
                  formatCurrency(value), 
                  `${name} (${t("an.expenses_n", { n: String(props.payload.count) })})`
                ]}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry: any) => (
                  <span className="text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary List */}
        <div className="mt-4 space-y-2">
          {pieData.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }} 
                />
                <span className="text-text">{item.name}</span>
              </div>
              <div className="text-end">
                <div className="font-medium text-text">{formatCurrency(item.value)}</div>
                <div className="text-xs text-neutral">{t("an.expenses_n", { n: String(item.count) })}</div>
              </div>
            </div>
          ))}
        </div>
        </>
        )}
      </CardContent>
    </Card>
  );
}