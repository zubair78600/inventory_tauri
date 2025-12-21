'use client';

import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

export type DateRange = {
  startDate: string;
  endDate: string;
  label: string;
};

const getISTDate = (): Date => {
  const now = new Date();
  const istString = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata' }).format(now);
  return new Date(istString);
};

// We need a custom formatter because toISOString() converts back to UTC, 
// potentially shifting the date back by 5.5 hrs (e.g., 2am IST becomes 8:30pm Previous Day UTC).
const formatISTDate = (date: Date): string => {
  // Use Intl to force Asia/Kolkata output in YYYY-MM-DD
  // en-CA is YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

// Restore formatDisplayDate for UI
const formatDisplayDate = (dateStr: string): string => {
  if (dateStr === '2000-01-01') return 'All time';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getDateRanges = (): Record<string, () => DateRange> => {
  const today = getISTDate();
  today.setHours(0, 0, 0, 0);

  return {
    '1d': () => {
      // For Day filter, we want strict start of IST day to end of IST day
      return { startDate: formatISTDate(today), endDate: formatISTDate(today), label: 'D' };
    },
    '7d': () => {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { startDate: formatISTDate(start), endDate: formatISTDate(today), label: 'W' };
    },
    '30d': () => {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { startDate: formatISTDate(start), endDate: formatISTDate(today), label: 'M' };
    },
    '90d': () => {
      const start = new Date(today);
      start.setDate(start.getDate() - 89);
      return { startDate: formatISTDate(start), endDate: formatISTDate(today), label: 'Q' };
    },
    '1y': () => {
      const start = new Date(today);
      start.setDate(start.getDate() - 364);
      return { startDate: formatISTDate(start), endDate: formatISTDate(today), label: 'Y' };
    },
    'all': () => ({
      startDate: '2000-01-01',
      endDate: formatISTDate(today),
      label: 'All',
    }),
  };
};

type DateRangeFilterProps = {
  value: DateRange;
  onChange: (range: DateRange) => void;
};

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const ranges = useMemo(() => getDateRanges(), []);

  const quickOptions = [
    { key: '1d', label: 'D' },
    { key: '7d', label: 'W' },
    { key: '30d', label: 'M' },
    { key: '90d', label: 'Q' },
    { key: '1y', label: 'Y' },
    { key: 'all', label: 'All' },
  ];

  const handleSelect = (key: string) => {
    const rangeGetter = ranges[key];
    if (rangeGetter) {
      onChange(rangeGetter());
    }
    setOpen(false);
  };

  const isActive = (key: string) => {
    const rangeGetter = ranges[key];
    if (!rangeGetter) return false;
    const range = rangeGetter();
    return range.startDate === value.startDate && range.endDate === value.endDate;
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Quick Filters - Pill style */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
        {quickOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => handleSelect(opt.key)}
            className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${isActive(opt.key)
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Date Range Dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
        >
          <span className="max-w-[140px] truncate">
            {value.label === 'All' ? 'All time' : `${formatDisplayDate(value.startDate)} - ${formatDisplayDate(value.endDate)}`}
          </span>
          <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 min-w-[200px]">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-[10px] font-medium text-slate-400 mb-0.5">From</label>
                  <input
                    type="date"
                    value={value.startDate}
                    onChange={(e) => onChange({ ...value, startDate: e.target.value, label: 'Custom' })}
                    className="w-full px-1.5 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-400 mb-0.5">To</label>
                  <input
                    type="date"
                    value={value.endDate}
                    onChange={(e) => onChange({ ...value, endDate: e.target.value, label: 'Custom' })}
                    className="w-full px-1.5 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-full py-1 text-[11px] font-medium text-white bg-slate-900 dark:bg-slate-600 rounded hover:bg-slate-800 dark:hover:bg-slate-500 transition-colors"
              >
                Apply
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export type DateRangeKey = '1d' | '7d' | '30d' | '90d' | '1y' | 'all';

const DEFAULT_RANGE_KEY: DateRangeKey = '1d';

export const getDateRangeForKey = (key: DateRangeKey): DateRange => {
  const ranges = getDateRanges();
  const rangeGetter = ranges[key] ?? ranges[DEFAULT_RANGE_KEY];
  return rangeGetter();
};

export const getDefaultDateRange = (): DateRange => getDateRangeForKey(DEFAULT_RANGE_KEY);
