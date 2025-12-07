'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { CashflowPoint } from '@/lib/tauri';
import { ArrowUpDown } from 'lucide-react';

type CashflowChartProps = {
  data: CashflowPoint[];
  loading?: boolean;
};

const formatCurrency = (value: number): string => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value}`;
};

const formatDate = (dateStr: string): string => {
  if (dateStr.includes('-W')) {
    return `W${dateStr.split('-W')[1]}`;
  }
  if (dateStr.match(/^\d{4}-\d{2}$/)) {
    const [, month] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(month) - 1];
  }
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

export function CashflowChart({ data, loading }: CashflowChartProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded mb-3 animate-pulse" />
        <div className="h-[180px] bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpDown size={16} className="text-sky-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Sales vs Purchases</h3>
        </div>
        <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">
          No cashflow data for selected period
        </div>
      </div>
    );
  }

  const totalSales = data.reduce((sum, d) => sum + d.sales, 0);
  const totalPurchases = data.reduce((sum, d) => sum + d.purchases, 0);
  const netCashflow = totalSales - totalPurchases;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowUpDown size={16} className="text-sky-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Sales vs Purchases</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-500">{formatCurrency(totalSales)}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-slate-500">{formatCurrency(totalPurchases)}</span>
          </span>
          <span className={`font-medium px-1.5 py-0.5 rounded text-[10px] ${
            netCashflow >= 0
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            Net: {formatCurrency(netCashflow)}
          </span>
        </div>
      </div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontSize: '11px',
              }}
              formatter={(value: number, name: string) => [formatCurrency(value), name]}
              labelFormatter={(label) => formatDate(label)}
            />
            <Bar
              dataKey="sales"
              name="Sales"
              fill="#10b981"
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
            />
            <Bar
              dataKey="purchases"
              name="Purchases"
              fill="#f59e0b"
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Net"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ fill: '#0ea5e9', strokeWidth: 0, r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
