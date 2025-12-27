'use client';

import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';

export type PanelSizeClass = 'xs' | 'sm' | 'md' | 'lg';

interface PanelSize {
  width: number;
  height: number;
  sizeClass: PanelSizeClass;
}

const defaultSize: PanelSize = {
  width: 400,
  height: 400,
  sizeClass: 'md',
};

const PanelSizeContext = createContext<PanelSize>(defaultSize);

export const usePanelSize = () => useContext(PanelSizeContext);

// Determine size class based on available dimensions
function getSizeClass(width: number, height: number): PanelSizeClass {
  const minDimension = Math.min(width, height);
  if (minDimension < 200) return 'xs';
  if (minDimension < 300) return 'sm';
  if (minDimension < 450) return 'md';
  return 'lg';
}

interface ResponsivePanelProps {
  children: ReactNode;
  className?: string;
}

export function ResponsivePanel({ children, className = '' }: ResponsivePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<PanelSize>(defaultSize);

  const updateSize = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      const newSizeClass = getSizeClass(width, height);

      // Only update if values actually changed to prevent unnecessary re-renders
      setSize(prev => {
        if (prev.width === width && prev.height === height && prev.sizeClass === newSizeClass) {
          return prev;
        }
        return { width, height, sizeClass: newSizeClass };
      });
    }
  }, []);

  useEffect(() => {
    // Initial size calculation
    updateSize();

    // Watch for size changes
    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to debounce updates
      requestAnimationFrame(updateSize);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [updateSize]);

  return (
    <PanelSizeContext.Provider value={size}>
      <div ref={containerRef} className={`h-full w-full overflow-hidden ${className}`}>
        {children}
      </div>
    </PanelSizeContext.Provider>
  );
}
