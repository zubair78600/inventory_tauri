"use client";

import { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  className?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  onRowClick?: (item: T) => void;
  selectedId?: number | null;
  getRowId: (item: T) => number | string;
  className?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingComponent?: React.ReactNode;
}

export function VirtualizedTable<T>({
  data,
  columns,
  rowHeight = 52,
  onRowClick,
  selectedId,
  getRowId,
  className,
  emptyMessage = "No data available",
  isLoading = false,
  hasMore = false,
  onLoadMore,
  loadingComponent,
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 15, // Render extra rows for smooth scrolling
  });

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!parentRef.current || !onLoadMore || !hasMore || isLoading) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Load more when scrolled to 80% of the content
    if (scrollPercentage > 0.8) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, isLoading]);

  const virtualItems = virtualizer.getVirtualItems();

  if (data.length === 0 && !isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-64 text-gray-500", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Fixed Header */}
      <div className="flex-none border-b bg-gray-50/80 dark:bg-slate-900/80">
        <div className="flex">
          {columns.map((column, idx) => (
            <div
              key={String(column.key)}
              className={cn(
                "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                column.width || "flex-1",
                column.className,
                idx === 0 && "sticky left-0 bg-gray-50/80 dark:bg-slate-900/80 z-10"
              )}
              style={column.width ? { width: column.width, minWidth: column.width } : undefined}
            >
              {column.header}
            </div>
          ))}
        </div>
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = data[virtualRow.index];
            const rowId = getRowId(item);
            const isSelected = selectedId === rowId;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={cn(
                  "absolute top-0 left-0 w-full flex border-b transition-colors",
                  onRowClick && "cursor-pointer hover:bg-sky-50/60 dark:hover:bg-slate-800/60",
                  isSelected && "bg-sky-100 dark:bg-slate-700"
                )}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${rowHeight}px`,
                }}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column, idx) => (
                  <div
                    key={String(column.key)}
                    className={cn(
                      "px-4 py-3 text-sm flex items-center overflow-hidden",
                      column.width || "flex-1",
                      column.className,
                      idx === 0 && "sticky left-0 bg-white dark:bg-slate-950 z-10"
                    )}
                    style={column.width ? { width: column.width, minWidth: column.width } : undefined}
                  >
                    {column.render
                      ? column.render(item, virtualRow.index)
                      : String((item as Record<string, unknown>)[column.key as string] ?? "-")}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Loading indicator at bottom */}
        {isLoading && (
          <div className="py-4 text-center text-gray-500">
            {loadingComponent || "Loading more..."}
          </div>
        )}

        {/* Load more trigger for non-infinite scroll */}
        {hasMore && !isLoading && onLoadMore && (
          <div className="py-4 text-center">
            <button
              onClick={onLoadMore}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
