'use client';

import type { TopCustomer } from '@/lib/tauri';
import { Users } from 'lucide-react';

type TopCustomersChartProps = {
  data: TopCustomer[];
  loading?: boolean;
  limit?: number;
};

const formatCurrency = (value: number): string => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
};

export function TopCustomersChart({ data, loading, limit = 5 }: TopCustomersChartProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-3 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-purple-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top Customers</h3>
        </div>
        <div className="h-[160px] flex items-center justify-center text-slate-400 text-sm">
          No customer data for selected period
        </div>
      </div>
    );
  }

  const chartData = data.slice(0, limit);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <Users size={16} className="text-purple-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top Customers</h3>
      </div>
      <div className="space-y-2">
        {chartData.map((customer, index) => (
          <div
            key={customer.customer_id}
            className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                {customer.customer_name}
              </p>
              <p className="text-[10px] text-slate-500">
                {customer.order_count} orders
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                {formatCurrency(customer.total_spent)}
              </p>
              <p className="text-[10px] text-slate-400">
                avg {formatCurrency(customer.avg_order_value)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
