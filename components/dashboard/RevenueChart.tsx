'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { RevenueTrendPoint } from '@/lib/tauri';
import { TrendingUp } from 'lucide-react';

type RevenueChartProps = {
  data: RevenueTrendPoint[];
  loading?: boolean;
  compact?: boolean;
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
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).replace(' ', '\n');
};

export function RevenueChart({ data, loading, compact = false, className }: RevenueChartProps & { className?: string }) {
  const height = compact ? 180 : 270;

  if (loading) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
        <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded mb-3 animate-pulse" />
        <div className={`bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse`} style={{ height }} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-sky-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Revenue Trend</h3>
        </div>
        <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height }}>
          No data for selected period
        </div>
      </div>
    );
  }

  // Calculate total for header
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.order_count, 0);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-sky-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Revenue Trend</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-500">
            <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(totalRevenue)}</span> revenue
          </span>
          <span className="text-slate-500">
            <span className="font-semibold text-slate-900 dark:text-white">{totalOrders}</span> orders
          </span>
        </div>
      </div>
      <div style={{ height }} className="w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
              </linearGradient>
            </defs>
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
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                return [value, 'Orders'];
              }}
              labelFormatter={(label) => formatDate(label)}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#0ea5e9"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
