'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { InventoryHealth } from '@/lib/tauri';
import { Package } from 'lucide-react';

type InventoryHealthChartProps = {
  data: InventoryHealth | null;
  loading?: boolean;
};

const COLORS = {
  healthy: '#10b981',
  low: '#f59e0b',
  out: '#ef4444',
};

const formatCurrency = (value: number): string => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
};

export function InventoryHealthChart({ data, loading }: InventoryHealthChartProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-3 animate-pulse" />
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700/50 animate-pulse" />
          <div className="flex-1 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Package size={16} className="text-sky-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Inventory Health</h3>
        </div>
        <div className="h-[100px] flex items-center justify-center text-slate-400 text-sm">
          No inventory data available
        </div>
      </div>
    );
  }

  const chartData = [
    { name: 'Healthy', value: data.healthy_stock_count, color: COLORS.healthy },
    { name: 'Low Stock', value: data.low_stock_count, color: COLORS.low },
    { name: 'Out of Stock', value: data.out_of_stock_count, color: COLORS.out },
  ].filter(item => item.value > 0);

  const healthPercent = ((data.healthy_stock_count / data.total_products) * 100).toFixed(0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <Package size={16} className="text-sky-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Inventory Health</h3>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 flex-shrink-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={38}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-slate-900 dark:text-white">{healthPercent}%</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.healthy }} />
              <span className="text-xs text-slate-600 dark:text-slate-300">Healthy</span>
            </div>
            <span className="text-xs font-semibold text-slate-900 dark:text-white">{data.healthy_stock_count}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.low }} />
              <span className="text-xs text-slate-600 dark:text-slate-300">Low Stock</span>
            </div>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{data.low_stock_count}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.out }} />
              <span className="text-xs text-slate-600 dark:text-slate-300">Out of Stock</span>
            </div>
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">{data.out_of_stock_count}</span>
          </div>
          <div className="pt-1 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Total Value</span>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">{formatCurrency(data.total_valuation)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
