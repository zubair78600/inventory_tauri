'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DateRangeFilter,
  getDefaultDateRange,
  KPICard,
  KPICardSkeleton,
  RevenueChart,
  TopProductsChart,
  PaymentMethodChart,
  TopCustomersChart,
  InventoryHealthChart,
  LowStockTable,
  RegionSalesChart,
  CashflowChart,
} from '@/components/dashboard';
import type { DateRange } from '@/components/dashboard';
import {
  analyticsCommands,
  type SalesAnalytics,
  type RevenueTrendPoint,
  type TopProduct,
  type PaymentMethodBreakdown,
  type CustomerAnalytics,
  type TopCustomer,
  type InventoryHealth,
  type LowStockAlert,
  type RegionSales,
  type PurchaseAnalytics,
  type CashflowPoint,
} from '@/lib/tauri';

const getGranularity = (startDate: string, endDate: string): 'daily' | 'weekly' | 'monthly' => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (days <= 31) return 'daily';
  if (days <= 90) return 'weekly';
  return 'monthly';
};

const formatCurrency = (value: number): string => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toLocaleString('en-IN')}`;
};

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);

  const granularity = useMemo(
    () => getGranularity(dateRange.startDate, dateRange.endDate),
    [dateRange]
  );

  // Sales Analytics
  const { data: salesAnalytics, isLoading: salesLoading } = useQuery<SalesAnalytics>({
    queryKey: ['sales-analytics', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getSalesAnalytics(dateRange.startDate, dateRange.endDate),
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Revenue Trend
  const { data: revenueTrend, isLoading: trendLoading } = useQuery<RevenueTrendPoint[]>({
    queryKey: ['revenue-trend', dateRange.startDate, dateRange.endDate, granularity],
    queryFn: () => analyticsCommands.getRevenueTrend(dateRange.startDate, dateRange.endDate, granularity),
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Top Products
  const { data: topProducts, isLoading: productsLoading } = useQuery<TopProduct[]>({
    queryKey: ['top-products', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getTopProducts(dateRange.startDate, dateRange.endDate, 10),
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Payment Methods
  const { data: paymentMethods, isLoading: paymentsLoading } = useQuery<PaymentMethodBreakdown[]>({
    queryKey: ['payment-methods', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getSalesByPaymentMethod(dateRange.startDate, dateRange.endDate),
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Region Sales
  const { data: regionSales, isLoading: regionLoading } = useQuery<RegionSales[]>({
    queryKey: ['region-sales', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getSalesByRegion(dateRange.startDate, dateRange.endDate),
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Customer Analytics
  const { data: customerAnalytics, isLoading: customersLoading } = useQuery<CustomerAnalytics>({
    queryKey: ['customer-analytics', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getCustomerAnalytics(dateRange.startDate, dateRange.endDate),
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Top Customers
  const { data: topCustomers, isLoading: topCustomersLoading } = useQuery<TopCustomer[]>({
    queryKey: ['top-customers', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getTopCustomers(dateRange.startDate, dateRange.endDate, 10),
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Inventory Health
  const { data: inventoryHealth, isLoading: inventoryLoading } = useQuery<InventoryHealth>({
    queryKey: ['inventory-health'],
    queryFn: () => analyticsCommands.getInventoryHealth(),
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Low Stock Alerts
  const { data: lowStockAlerts, isLoading: lowStockLoading } = useQuery<LowStockAlert[]>({
    queryKey: ['low-stock-alerts'],
    queryFn: () => analyticsCommands.getLowStockAlerts(),
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Purchase Analytics
  const { data: purchaseAnalytics, isLoading: purchaseLoading } = useQuery<PurchaseAnalytics>({
    queryKey: ['purchase-analytics', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getPurchaseAnalytics(dateRange.startDate, dateRange.endDate),
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Cashflow Trend
  const { data: cashflowTrend, isLoading: cashflowLoading } = useQuery<CashflowPoint[]>({
    queryKey: ['cashflow-trend', dateRange.startDate, dateRange.endDate, granularity],
    queryFn: () => analyticsCommands.getCashflowTrend(dateRange.startDate, dateRange.endDate, granularity),
    staleTime: 0,
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Business analytics overview</p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Row 1: Primary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {salesLoading ? (
          <>
            <KPICardSkeleton compact />
            <KPICardSkeleton compact />
            <KPICardSkeleton compact />
            <KPICardSkeleton compact />
          </>
        ) : (
          <>
            <KPICard
              title="Total Revenue"
              value={salesAnalytics?.total_revenue ?? 0}
              format="currency"
              change={salesAnalytics?.revenue_change_percent}
              variant="highlight"
              compact
            />
            <KPICard
              title="Total Orders"
              value={salesAnalytics?.total_orders ?? 0}
              format="number"
              change={salesAnalytics?.orders_change_percent}
              compact
            />
            <KPICard
              title="Avg Order Value"
              value={salesAnalytics?.avg_order_value ?? 0}
              format="currency"
              compact
            />
            <KPICard
              title="Gross Profit"
              value={salesAnalytics?.gross_profit ?? 0}
              format="currency"
              variant="accent"
              compact
            />
          </>
        )}
      </div>

      {/* Row 2: Revenue Chart + Top Products + Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-6">
          <RevenueChart data={revenueTrend ?? []} loading={trendLoading} className="h-full" />
        </div>
        <div className="lg:col-span-3">
          <TopProductsChart data={topProducts ?? []} loading={productsLoading} className="h-full" />
        </div>
        <div className="lg:col-span-3">
          <PaymentMethodChart data={paymentMethods ?? []} loading={paymentsLoading} className="h-full" />
        </div>
      </div>

      {/* Row 3: Customer KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {customersLoading ? (
          <>
            <KPICardSkeleton compact />
            <KPICardSkeleton compact />
            <KPICardSkeleton compact />
            <KPICardSkeleton compact />
          </>
        ) : (
          <>
            <KPICard
              title="Active Customers"
              value={customerAnalytics?.total_customers ?? 0}
              format="number"
              subtitle="In period"
              compact
            />
            <KPICard
              title="New Customers"
              value={customerAnalytics?.new_customers ?? 0}
              format="number"
              subtitle="First-time"
              compact
            />
            <KPICard
              title="Repeat Rate"
              value={customerAnalytics?.repeat_rate ?? 0}
              format="percent"
              subtitle={`${customerAnalytics?.repeat_customers ?? 0} repeat`}
              compact
            />
            <KPICard
              title="Avg Lifetime Value"
              value={customerAnalytics?.avg_lifetime_value ?? 0}
              format="currency"
              compact
            />
          </>
        )}
      </div>

      {/* Row 4: Top Customers + Region Sales + Inventory Health + Low Stock */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <TopCustomersChart data={topCustomers ?? []} loading={topCustomersLoading} />
        <RegionSalesChart data={regionSales ?? []} loading={regionLoading} />
        <InventoryHealthChart data={inventoryHealth ?? null} loading={inventoryLoading} />
        <LowStockTable data={lowStockAlerts ?? []} loading={lowStockLoading} />
      </div>

      {/* Row 5: Purchase KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {purchaseLoading ? (
          <>
            <KPICardSkeleton compact />
            <KPICardSkeleton compact />
            <KPICardSkeleton compact />
            <KPICardSkeleton compact />
          </>
        ) : (
          <>
            <KPICard
              title="Total Purchases"
              value={purchaseAnalytics?.total_purchases ?? 0}
              format="currency"
              subtitle="In period"
              compact
            />
            <KPICard
              title="Amount Paid"
              value={purchaseAnalytics?.total_paid ?? 0}
              format="currency"
              subtitle="To suppliers"
              compact
            />
            <KPICard
              title="Pending Payments"
              value={purchaseAnalytics?.pending_payments ?? 0}
              format="currency"
              subtitle="Outstanding"
              compact
            />
            <KPICard
              title="Active Suppliers"
              value={purchaseAnalytics?.active_suppliers ?? 0}
              format="number"
              subtitle="With orders"
              compact
            />
          </>
        )}
      </div>

      {/* Row 6: Cashflow Chart */}
      <CashflowChart data={cashflowTrend ?? []} loading={cashflowLoading} />
    </div>
  );
}
