'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { PaymentMethodBreakdown } from '@/lib/tauri';
import { CreditCard } from 'lucide-react';

type PaymentMethodChartProps = {
  data: PaymentMethodBreakdown[];
  loading?: boolean;
};

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const formatCurrency = (value: number): string => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
};

export function PaymentMethodChart({ data, loading, className }: PaymentMethodChartProps & { className?: string }) {
  if (loading) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-3 animate-pulse" />
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-700/50 animate-pulse" />
          <div className="flex-1 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard size={16} className="text-purple-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Payment Methods</h3>
        </div>
        <div className="h-[120px] flex items-center justify-center text-slate-400 text-sm">
          No payment data available
        </div>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: item.payment_method || 'Unknown',
  }));

  const total = chartData.reduce((sum, d) => sum + d.total_amount, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-xs">
          <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
          <p className="text-slate-600 dark:text-slate-300">{formatCurrency(item.total_amount)}</p>
          <p className="text-slate-500">{item.order_count} orders</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <CreditCard size={16} className="text-purple-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Payment Methods</h3>
      </div>
      {/* Vertical layout: Chart on top, data below */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-36 h-36">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={62}
                paddingAngle={2}
                dataKey="total_amount"
                nameKey="name"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full space-y-1.5">
          {chartData.slice(0, 4).map((item, index) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  {item.name}
                </span>
              </div>
              <span className="text-xs font-medium text-slate-900 dark:text-white">
                {((item.total_amount / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
