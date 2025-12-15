'use client';

import type { TopProduct } from '@/lib/tauri';
import { Package } from 'lucide-react';

type TopProductsChartProps = {
  data: TopProduct[];
  loading?: boolean;
  limit?: number;
};

const formatCurrency = (value: number): string => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
};

const COLORS = ['#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e'];

export function TopProductsChart({ data, loading, limit = 5, className }: TopProductsChartProps & { className?: string }) {
  if (loading) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-3 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Package size={16} className="text-emerald-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top Products</h3>
        </div>
        <div className="h-[160px] flex items-center justify-center text-slate-400 text-sm">
          No sales data for selected period
        </div>
      </div>
    );
  }

  const chartData = data.slice(0, limit);
  const maxRevenue = Math.max(...chartData.map(p => p.revenue));

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Package size={16} className="text-emerald-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top Products</h3>
      </div>
      <div className="space-y-2">
        {chartData.map((product, index) => {
          const width = (product.revenue / maxRevenue) * 100;
          return (
            <div key={product.sku} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[60%]" title={product.product_name}>
                  {product.product_name.length > 25 ? product.product_name.slice(0, 25) + '...' : product.product_name}
                </span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(product.revenue)}
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${width}%`, backgroundColor: COLORS[index % COLORS.length] }}
                />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-slate-400">{product.sku}</span>
                <span className="text-[10px] text-slate-400">{product.quantity_sold} sold</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
