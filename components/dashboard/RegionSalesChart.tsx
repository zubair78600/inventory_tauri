'use client';

import type { RegionSales } from '@/lib/tauri';
import { MapPin } from 'lucide-react';

type RegionSalesChartProps = {
  data: RegionSales[];
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

export function RegionSalesChart({ data, loading, limit = 5 }: RegionSalesChartProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-3 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-6 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={16} className="text-sky-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Sales by Region</h3>
        </div>
        <div className="h-[140px] flex items-center justify-center text-slate-400 text-sm">
          No regional data for selected period
        </div>
      </div>
    );
  }

  const filteredData = data.filter(d => d.state !== 'Unknown' || data.length === 1);
  const chartData = filteredData.slice(0, limit);
  const maxRevenue = Math.max(...chartData.map(r => r.revenue));

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={16} className="text-sky-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Sales by Region</h3>
      </div>
      <div className="space-y-2">
        {chartData.map((region, index) => {
          const width = (region.revenue / maxRevenue) * 100;
          return (
            <div key={region.state} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[50%]">
                  {region.state}
                </span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(region.revenue)}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${width}%`, backgroundColor: COLORS[index % COLORS.length] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
