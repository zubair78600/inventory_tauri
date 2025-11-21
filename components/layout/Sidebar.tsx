'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Menu,
  Truck,
  Users,
  Receipt,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname() ?? '';

  type NavLink = { href: string; label: string; icon: React.ElementType };
  const links: NavLink[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/billing', label: 'Billing', icon: CreditCard },
    { href: '/sales', label: 'Sales', icon: Receipt },
    { href: '/customers', label: 'Customers', icon: Users },
    { href: '/inventory', label: 'Inventory', icon: Boxes },
    { href: '/suppliers', label: 'Suppliers', icon: Truck },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
  ];

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="md:hidden fixed top-4 left-4 z-30 rounded-full bg-primary text-white p-3 shadow-lg"
        aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
      >
        <Menu size={18} />
      </button>

      <aside
        className={`sidebar fixed md:static inset-y-0 left-0 z-20 transform transition-all duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        <div className="sidebar-header">
          {isCollapsed ? (
            <div className="flex justify-center">
              <div className="text-2xl text-primary font-bold">I</div>
            </div>
          ) : (
            <div>
              <div className="text-lg text-primary font-semibold">InventoryOS</div>
              <div className="text-sm text-muted-foreground">Billing & Stock</div>
            </div>
          )}
        </div>

        {/* Collapse/Expand button for desktop */}
        <button
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="hidden md:flex absolute -right-3 top-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight size={16} className="text-slate-600 dark:text-slate-300" />
          ) : (
            <ChevronLeft size={16} className="text-slate-600 dark:text-slate-300" />
          )}
        </button>

        <nav className="flex-1 space-y-1 px-3">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${active ? 'active' : ''} ${
                  isCollapsed ? 'justify-center px-3' : ''
                }`}
                onClick={() => setIsOpen(false)}
                title={isCollapsed ? link.label : undefined}
              >
                <Icon size={18} className={active ? 'text-primary' : 'text-slate-400'} />
                {isCollapsed ? <span className="sr-only">{link.label}</span> : link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
