'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

type KPICardProps = {
  title: string;
  value: string | number;
  change?: number;
  subtitle?: string;
  variant?: 'default' | 'highlight' | 'accent';
  loading?: boolean;
  format?: 'currency' | 'number' | 'percent';
  compact?: boolean;
};

const formatValue = (value: string | number, format?: 'currency' | 'number' | 'percent'): string => {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'currency':
      if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
      if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
      if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
      return `₹${value.toLocaleString('en-IN')}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return value.toLocaleString('en-IN');
  }
};

export function KPICard({
  title,
  value,
  change,
  subtitle,
  variant = 'default',
  loading = false,
  format,
  compact = false,
}: KPICardProps) {
  const hasChange = change !== undefined && change !== null && !isNaN(change);
  const isPositive = hasChange && change > 0;
  const isNegative = hasChange && change < 0;

  const bgClass = variant === 'highlight'
    ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white'
    : variant === 'accent'
    ? 'bg-gradient-to-br from-slate-800 to-slate-900 text-white dark:from-slate-700 dark:to-slate-800'
    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700';

  if (loading) {
    return (
      <div className={`rounded-xl ${compact ? 'p-3' : 'p-4'} ${bgClass}`}>
        <div className="animate-pulse">
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
          <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl ${compact ? 'p-3' : 'p-4'} ${bgClass} transition-all hover:shadow-md`}>
      <p className={`text-[11px] font-medium mb-1 ${
        variant !== 'default' ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'
      }`}>
        {title}
      </p>
      <div className="flex items-baseline gap-2">
        <p className={`${compact ? 'text-xl' : 'text-2xl'} font-bold tracking-tight ${
          variant !== 'default' ? 'text-white' : 'text-slate-900 dark:text-white'
        }`}>
          {formatValue(value, format)}
        </p>
        {hasChange && (
          <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            isPositive
              ? variant !== 'default' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
              : isNegative
              ? variant !== 'default' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {isPositive ? <TrendingUp size={10} /> : isNegative ? <TrendingDown size={10} /> : null}
            {isPositive ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
      {subtitle && (
        <p className={`text-[10px] mt-1 ${
          variant !== 'default' ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'
        }`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function KPICardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl ${compact ? 'p-3' : 'p-4'} border border-slate-200 dark:border-slate-700`}>
      <div className="animate-pulse">
        <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
        <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    </div>
  );
}

// Mini stat for inline display
export function MiniStat({
  label,
  value,
  change,
  format
}: {
  label: string;
  value: number;
  change?: number;
  format?: 'currency' | 'number' | 'percent';
}) {
  const hasChange = change !== undefined && !isNaN(change);
  const isPositive = hasChange && change > 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
      <div className="flex-1">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-900 dark:text-white">{formatValue(value, format)}</p>
      </div>
      {hasChange && (
        <span className={`text-[10px] font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
        </span>
      )}
    </div>
  );
}
