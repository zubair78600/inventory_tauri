'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OmniSearch } from '@/components/shared/OmniSearch';

interface HeaderProps {
  userEmail: string;
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, ChevronDown, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function Header({ userEmail }: HeaderProps) {
  const router = useRouter();
  const { hasPermission, logout } = useAuth();
  const [currentDate, setCurrentDate] = useState('');

  // Dialogs
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  // Menu State
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useState<HTMLDivElement | null>(null);

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

    // Click outside to close menu
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // Standard DOM event listener for native menu interaction
    const handleNativeSettingsResult = () => {
      // Direct navigation
      router.push('/settings');
    };

    window.addEventListener('native-settings-click', handleNativeSettingsResult);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('native-settings-click', handleNativeSettingsResult);
    };
  }, [hasPermission]);

  const handleNewInvoice = () => {
    router.push('/billing');
  };

  const handleLogout = () => {
    logout();
    setShowLogoutDialog(false);
  };



  return (
    <>
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

          {/* User Menu */}
          <div className="relative user-menu-container">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm text-slate-700 dark:text-slate-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <UserIcon size={14} />
              </div>
              <div className="font-medium">{userEmail}</div>
              <ChevronDown size={14} className={`transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Content */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-md bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50 animated-in fade-in zoom-in-95 duration-200">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                    // Direct navigation without password prompt
                    router.push('/settings');
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Settings size={16} />
                  Settings
                </button>
                <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                    setTimeout(() => setShowLogoutDialog(true), 100);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

          <button className="btn btn-ghost h-9 px-3 text-slate-500">{currentDate || 'Today'}</button>
          <button className="btn btn-primary h-9 px-4 shadow-sm" onClick={handleNewInvoice}>
            New Invoice
          </button>
        </div>
      </header>

      {/* Logout Confirmation */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to logout? You will need to login again to access the application.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogout} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
              <LogOut size={16} />
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
