import { cn } from '@/lib/utils';

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn('min-w-full text-sm text-slate-800 dark:text-slate-100', className)}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('', className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-sky-50/60 dark:hover:bg-slate-800/80 last:[&>td]:border-b-0 last:[&>th]:border-b-0',
        className
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'text-left text-[11px] uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 font-semibold px-4 py-3 border-b border-slate-200/80 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/70',
        className
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-4 py-3 border-b border-slate-100 dark:border-slate-700/60', className)}
      {...props}
    />
  );
}
