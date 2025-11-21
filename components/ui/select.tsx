import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));

Select.displayName = 'Select';

export { Select };
