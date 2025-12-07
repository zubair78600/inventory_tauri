'use client';

import { AlertTriangle } from 'lucide-react';
import type { LowStockAlert } from '@/lib/tauri';

type LowStockTableProps = {
  data: LowStockAlert[];
  loading?: boolean;
  limit?: number;
};

export function LowStockTable({ data, loading, limit = 5 }: LowStockTableProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-3 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Low Stock Alerts</h3>
        </div>
        {data.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
            {data.length}
          </span>
        )}
      </div>

      {data.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-sm">
          All products are well stocked
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.slice(0, limit).map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/30"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                  {item.name}
                </p>
                <p className="text-[10px] text-slate-500">{item.sku}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-center">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      item.stock_quantity === 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : item.stock_quantity < 5
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.stock_quantity} left
                  </span>
                </div>
                {item.days_until_stockout !== null && (
                  <span
                    className={`text-[10px] font-medium ${
                      item.days_until_stockout <= 3
                        ? 'text-red-600 dark:text-red-400'
                        : item.days_until_stockout <= 7
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {item.days_until_stockout}d
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
