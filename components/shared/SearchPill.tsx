'use client';

import { Search } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

type SearchPillProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function SearchPill({ value, onChange, placeholder, className }: SearchPillProps) {
  const [manualExpanded, setManualExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stay expanded if: has value OR manually expanded OR focused
  const isExpanded = Boolean(value) || manualExpanded || focused;

  // Restore focus after re-renders when we should be focused
  useEffect(() => {
    if (focused && inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus();
    }
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Clear any existing timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }

    // Delay blur handling to allow for re-render focus restoration
    blurTimeoutRef.current = setTimeout(() => {
      // Check if focus is still outside the container
      if (!containerRef.current?.contains(document.activeElement)) {
        setFocused(false);
        // Only collapse manual expansion if there's no value
        if (!value) {
          setManualExpanded(false);
        }
      }
    }, 100);
  }, [value]);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className={`group relative flex items-center bg-slate-900 text-slate-800 h-[32px] rounded-full shadow-[0_10px_24px_-14px_rgba(15,23,42,0.6)] transition-all duration-300 border border-slate-950/70 ${
          isExpanded ? 'w-[260px] pl-10 pr-3' : 'w-[32px] justify-center'
        }`}
        onMouseEnter={() => !focused && setManualExpanded(true)}
        onMouseLeave={() => !value && !focused && setManualExpanded(false)}
        onBlur={handleBlur}
      >
        <button
          type="button"
          className={`absolute flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-white shadow-[inset_0_0_12px_rgba(0,0,0,0.12),0_3px_10px_-7px_rgba(15,23,42,0.55)] transition border border-slate-200 ${
            isExpanded
              ? 'left-2 top-1/2 -translate-y-1/2'
              : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
          }`}
          onClick={() => {
            if (!isExpanded) {
              setManualExpanded(true);
              // Focus the input when clicking the search button to expand
              setTimeout(() => inputRef.current?.focus(), 0);
            } else if (!value) {
              setManualExpanded(false);
            }
          }}
        >
          <Search size={16} className="text-slate-900" />
        </button>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Search...'}
          className={`bg-transparent text-sm text-white placeholder:text-slate-200 outline-none transition-all duration-300 ${
            isExpanded ? 'w-full opacity-100 pl-1' : 'w-0 opacity-0'
          }`}
          onFocus={() => {
            setFocused(true);
          }}
        />
      </div>
    </div>
  );
}
