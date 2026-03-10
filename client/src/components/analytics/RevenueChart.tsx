import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { TrendingUp } from "lucide-react";

interface RevenueChartProps {
  data: Array<{
    period: string;
    value: number;
    count: number;
  }>;
  title: string;
  color?: string;
}

export function RevenueChart({ data, title, color = "#3B82F6" }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-text">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex flex-col items-center justify-center text-neutral gap-3">
            <TrendingUp className="h-10 w-10 opacity-25" />
            <p className="text-sm">No data available for this period</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length < 2) {
    const point = data[0];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-text">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-neutral uppercase tracking-wide">{point.period}</p>
            <p className="text-3xl font-bold text-text">{formatCurrency(point.value)}</p>
            <p className="text-xs text-neutral mt-2">Not enough data to display trend</p>
            <p className="text-xs text-neutral">(at least two periods required)</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-text">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
              <XAxis
                dataKey="period"
                className="text-xs text-neutral"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                className="text-xs text-neutral"
                tick={{ fontSize: 12 }}
                tickFormatter={formatCurrency}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), title]}
                labelFormatter={(label) => `Period: ${label}`}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={{ fill: color, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
