'use client';

import type { DashboardStats } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Package, Receipt, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await fetch('/api/reports');
      if (!res.ok) throw new Error('Failed to load stats');
      return (await res.json()) as DashboardStats;
    },
    staleTime: 30_000,
  });

  if (isLoading) return <div>Loading...</div>;
  if (isError || !stats) return <div>Error loading stats</div>;

  const statCards = [
    {
      title: 'Total Revenue',
      value: `₹${stats.total_revenue.toFixed(2)}`,
      helper: 'Overall billed amount',
      icon: TrendingUp,
      gradient: 'from-sky-500 via-cyan-400 to-emerald-400',
      glow: 'shadow-[0_20px_60px_-28px_rgba(14,165,233,0.65)]',
      valueClass: 'text-white',
    },
    {
      title: 'Total Orders',
      value: stats.total_orders.toLocaleString(),
      helper: 'Invoices created',
      icon: Receipt,
      gradient: 'from-indigo-500 via-sky-500 to-cyan-400',
      glow: 'shadow-[0_20px_60px_-28px_rgba(79,70,229,0.5)]',
      valueClass: 'text-white',
    },
    {
      title: 'Low Stock',
      value: stats.low_stock_count.toLocaleString(),
      helper: 'Items under threshold',
      icon: AlertTriangle,
      gradient: 'from-amber-500 via-orange-500 to-rose-500',
      glow: 'shadow-[0_20px_60px_-28px_rgba(249,115,22,0.55)]',
      valueClass: 'text-amber-50',
    },
    {
      title: 'Inventory Value',
      value: `₹${stats.total_valuation.toFixed(2)}`,
      helper: 'Current stock worth',
      icon: Package,
      gradient: 'from-emerald-500 via-sky-500 to-indigo-500',
      glow: 'shadow-[0_20px_60px_-28px_rgba(16,185,129,0.55)]',
      valueClass: 'text-white',
    },
  ];

  return (
    <div className="relative space-y-10">
      <div
        className="pointer-events-none absolute inset-x-0 -top-10 h-48 bg-[radial-gradient(120%_60%_at_50%_10%,rgba(14,165,233,0.18),transparent)] blur-2xl"
        aria-hidden
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className={`relative overflow-hidden border-0 bg-gradient-to-br ${card.gradient} text-white ${card.glow} hover:-translate-y-1 duration-300`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_35%)] opacity-60" />
              <CardContent className="relative space-y-4">
                <div className="flex items-start justify-between">
                  <div className="rounded-2xl bg-white/15 p-2.5 shadow-inner shadow-white/10">
                    <Icon size={18} />
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/70">
                    Snapshot
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-white/80">{card.title}</p>
                  <p
                    className={`text-3xl font-semibold leading-tight drop-shadow-sm ${card.valueClass}`}
                  >
                    {card.value}
                  </p>
                </div>
                <p className="text-xs text-white/75">{card.helper}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="relative overflow-hidden border border-slate-200/80 dark:border-slate-700/60 bg-white/95 dark:bg-slate-800/85 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.22)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-400" />
        <CardHeader className="flex flex-col gap-2 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
              Recent Sales
            </CardTitle>
            <span className="inline-flex items-center gap-2 rounded-full bg-white text-slate-700 text-xs font-semibold px-3 py-1 border border-slate-200/70 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.4)] dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600">
              Last 5 invoices
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            A crisp snapshot of movement, with sharper contrast to stay readable.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-5 pb-5">
            <div className="table-container overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/70 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.2)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="rounded-none">Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent_sales.map((sale) => (
                    <TableRow key={sale.id} className="group">
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-50">
                        {sale.invoice_number}
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-200">
                        {sale.customer_name ?? 'Walk-in Customer'}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-300">
                        {new Date(sale.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-50 text-right">
                        ₹{sale.total_amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {stats.recent_sales.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-6 bg-white/60 dark:bg-slate-800/50"
                      >
                        No recent sales
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
