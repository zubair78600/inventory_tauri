'use client';

import { useRouter } from 'next/navigation';
import { ModeToggle } from '@/components/shared/ModeToggle';
import { useEffect, useState } from 'react';
import { OmniSearch } from '@/components/shared/OmniSearch';

interface HeaderProps {
  userEmail: string;
}

export function Header({ userEmail }: HeaderProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    // Format the current date
    const formatDate = () => {
      const now = new Date();
      return now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };
    setCurrentDate(formatDate());
  }, []);

  const handleNewInvoice = () => {
    router.push('/billing');
  };

  return (
    <header className="topbar">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50 whitespace-nowrap">
          Inventory Control Center
        </h1>
        <div className="hidden md:block w-full max-w-[480px]">
          <OmniSearch />
        </div>
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <div className="text-sm text-muted-foreground">{userEmail}</div>
        <button className="btn btn-ghost h-9 px-3">{currentDate || 'Today'}</button>
        <button className="btn btn-primary h-9 px-4" onClick={handleNewInvoice}>
          New Invoice
        </button>
        <ModeToggle />
      </div>
    </header>
  );
}
