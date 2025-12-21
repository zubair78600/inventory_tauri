'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  DateRangeFilter,
  getDateRangeForKey,
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
import type { DateRange, DateRangeKey } from '@/components/dashboard';
import {
  analyticsCommands,
  type DashboardStats,
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

const SALES_VOLUME_THRESHOLD = 200000;

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
  const [autoRangeApplied, setAutoRangeApplied] = useState(false);
  const [hasUserChangedRange, setHasUserChangedRange] = useState(false);
  const queryClient = useQueryClient();

  // Prefetch other ranges for smooth switching (Deferred)
  useEffect(() => {
    const timer = setTimeout(() => {
      const ranges: DateRangeKey[] = ['1d', '7d', '30d', '90d', '1y'];

      ranges.forEach(key => {
        const range = getDateRangeForKey(key);
        const gran = getGranularity(range.startDate, range.endDate);

        // Skip if it matches current range (already being fetched)
        if (range.startDate === dateRange.startDate && range.endDate === dateRange.endDate) return;

        // Prefetch Sales Analytics
        queryClient.prefetchQuery({
          queryKey: ['sales-analytics', range.startDate, range.endDate],
          queryFn: () => analyticsCommands.getSalesAnalytics(range.startDate, range.endDate),
          staleTime: 60_000,
        });

        // Prefetch Revenue Trend
        queryClient.prefetchQuery({
          queryKey: ['revenue-trend', range.startDate, range.endDate, gran],
          queryFn: () => analyticsCommands.getRevenueTrend(range.startDate, range.endDate, gran),
          staleTime: 60_000,
        });

        // Prefetch Top Products
        queryClient.prefetchQuery({
          queryKey: ['top-products', range.startDate, range.endDate],
          queryFn: () => analyticsCommands.getTopProducts(range.startDate, range.endDate, 10),
          staleTime: 60_000,
        });

        // Prefetch Payment Methods
        queryClient.prefetchQuery({
          queryKey: ['payment-methods', range.startDate, range.endDate],
          queryFn: () => analyticsCommands.getSalesByPaymentMethod(range.startDate, range.endDate),
          staleTime: 60_000,
        });

        // Prefetch Customer Analytics
        queryClient.prefetchQuery({
          queryKey: ['customer-analytics', range.startDate, range.endDate],
          queryFn: () => analyticsCommands.getCustomerAnalytics(range.startDate, range.endDate),
          staleTime: 60_000,
        });

        // We can prefetch others too if needed, but these are the main ones visible "above fold" or high priority
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [queryClient, dateRange]);

  const granularity = useMemo(
    () => getGranularity(dateRange.startDate, dateRange.endDate),
    [dateRange]
  );

  const shouldPoll = useMemo(() => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return days <= 7;
  }, [dateRange.startDate, dateRange.endDate]);

  const dashboardQueryOptions = {
    staleTime: 60_000,
    refetchInterval: shouldPoll ? 5000 : false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  } as const;

  const { data: dashboardStats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => analyticsCommands.getDashboardStats(),
    staleTime: 5 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (autoRangeApplied || hasUserChangedRange || !dashboardStats) return;

    const nextRangeKey = dashboardStats.total_orders >= SALES_VOLUME_THRESHOLD ? '7d' : '1d';
    const nextRange = getDateRangeForKey(nextRangeKey);

    if (nextRange.startDate !== dateRange.startDate || nextRange.endDate !== dateRange.endDate) {
      setDateRange(nextRange);
    }
    setAutoRangeApplied(true);
  }, [
    autoRangeApplied,
    hasUserChangedRange,
    dashboardStats,
    dateRange.startDate,
    dateRange.endDate,
  ]);

  const handleDateRangeChange = (range: DateRange) => {
    setHasUserChangedRange(true);
    setDateRange(range);
  };

  // Sales Analytics
  const { data: salesAnalytics, isLoading: salesLoading } = useQuery<SalesAnalytics>({
    queryKey: ['sales-analytics', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getSalesAnalytics(dateRange.startDate, dateRange.endDate),
    ...dashboardQueryOptions,
  });

  // Revenue Trend
  const { data: revenueTrend, isLoading: trendLoading } = useQuery<RevenueTrendPoint[]>({
    queryKey: ['revenue-trend', dateRange.startDate, dateRange.endDate, granularity],
    queryFn: () => analyticsCommands.getRevenueTrend(dateRange.startDate, dateRange.endDate, granularity),
    ...dashboardQueryOptions,
  });

  // Top Products
  const { data: topProducts, isLoading: productsLoading } = useQuery<TopProduct[]>({
    queryKey: ['top-products', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getTopProducts(dateRange.startDate, dateRange.endDate, 10),
    ...dashboardQueryOptions,
  });

  // Payment Methods
  const { data: paymentMethods, isLoading: paymentsLoading } = useQuery<PaymentMethodBreakdown[]>({
    queryKey: ['payment-methods', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getSalesByPaymentMethod(dateRange.startDate, dateRange.endDate),
    ...dashboardQueryOptions,
  });

  // Region Sales
  const { data: regionSales, isLoading: regionLoading } = useQuery<RegionSales[]>({
    queryKey: ['region-sales', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getSalesByRegion(dateRange.startDate, dateRange.endDate),
    ...dashboardQueryOptions,
  });

  // Customer Analytics
  const { data: customerAnalytics, isLoading: customersLoading } = useQuery<CustomerAnalytics>({
    queryKey: ['customer-analytics', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getCustomerAnalytics(dateRange.startDate, dateRange.endDate),
    ...dashboardQueryOptions,
  });

  // Top Customers
  const { data: topCustomers, isLoading: topCustomersLoading } = useQuery<TopCustomer[]>({
    queryKey: ['top-customers', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getTopCustomers(dateRange.startDate, dateRange.endDate, 10),
    ...dashboardQueryOptions,
  });

  // Inventory Health
  const { data: inventoryHealth, isLoading: inventoryLoading } = useQuery<InventoryHealth>({
    queryKey: ['inventory-health'],
    queryFn: () => analyticsCommands.getInventoryHealth(),
    ...dashboardQueryOptions,
  });

  // Low Stock Alerts
  const { data: lowStockAlerts, isLoading: lowStockLoading } = useQuery<LowStockAlert[]>({
    queryKey: ['low-stock-alerts'],
    queryFn: () => analyticsCommands.getLowStockAlerts(),
    ...dashboardQueryOptions,
  });

  // Purchase Analytics
  const { data: purchaseAnalytics, isLoading: purchaseLoading } = useQuery<PurchaseAnalytics>({
    queryKey: ['purchase-analytics', dateRange.startDate, dateRange.endDate],
    queryFn: () => analyticsCommands.getPurchaseAnalytics(dateRange.startDate, dateRange.endDate),
    ...dashboardQueryOptions,
  });

  // Cashflow Trend
  const { data: cashflowTrend, isLoading: cashflowLoading } = useQuery<CashflowPoint[]>({
    queryKey: ['cashflow-trend', dateRange.startDate, dateRange.endDate, granularity],
    queryFn: () => analyticsCommands.getCashflowTrend(dateRange.startDate, dateRange.endDate, granularity),
    ...dashboardQueryOptions,
  });

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Business analytics overview</p>
        </div>
        <DateRangeFilter value={dateRange} onChange={handleDateRangeChange} />
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
