'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

type SearchPillProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function SearchPill({ value, onChange, placeholder, className }: SearchPillProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={className}>
      <div
        className={`group relative flex items-center bg-slate-900 text-slate-800 h-[32px] rounded-full shadow-[0_10px_24px_-14px_rgba(15,23,42,0.6)] transition-all duration-300 border border-slate-950/70 ${
          expanded ? 'w-[260px] pl-10 pr-3' : 'w-[32px] justify-center'
        }`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => !value && setExpanded(false)}
      >
        <button
          type="button"
          className={`absolute flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-white shadow-[inset_0_0_12px_rgba(0,0,0,0.12),0_3px_10px_-7px_rgba(15,23,42,0.55)] transition border border-slate-200 ${
            expanded
              ? 'left-2 top-1/2 -translate-y-1/2'
              : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
          }`}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <Search size={16} className="text-slate-900" />
        </button>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Search...'}
          className={`bg-transparent text-sm text-white placeholder:text-slate-200 outline-none transition-all duration-300 ${
            expanded ? 'w-full opacity-100 pl-1' : 'w-0 opacity-0'
          }`}
          onFocus={() => setExpanded(true)}
        />
      </div>
    </div>
  );
}
