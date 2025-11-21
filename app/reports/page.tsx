'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { analyticsCommands, type DashboardStats, type CustomerReport } from '@/lib/tauri';

export default function Reports() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<{
    revenue: number;
    taxCollected: number;
    invoices: number;
    topProducts: { id: number; name: string; quantity: number }[];
    topCustomers: { id: number; name: string; spent: number }[];
  } | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CustomerReport[]>([]);
  const [searching, setSearching] = useState<boolean>(false);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await analyticsCommands.getDashboardStats();
        setStats(data);
        // TODO: Analytics endpoint not yet implemented
        // const analyticsData = await analyticsCommands.getAnalytics();
        // setAnalytics(analyticsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    void fetchReports();
  }, []);

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchQuery) return;

    setSearching(true);
    try {
      const data = await analyticsCommands.customerSearch(searchQuery);
      setSearchResults(data);
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!stats) return <div>Error loading reports</div>;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Reports</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Revenue</span>
              <span className="font-semibold">₹{stats.total_revenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Orders</span>
              <span className="font-semibold">{stats.total_orders}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Valuation</span>
              <span className="font-semibold">₹{stats.total_valuation.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Low Stock Items</span>
              <span className={`font-semibold ${stats.low_stock_count > 0 ? 'text-danger' : ''}`}>
                {stats.low_stock_count}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {analytics && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Analytics</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-semibold">₹{analytics.revenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax Collected</span>
                <span className="font-semibold">₹{analytics.taxCollected.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoices</span>
                <span className="font-semibold">{analytics.invoices}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Top Products / Customers</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Products</h4>
                <div className="space-y-2">
                  {analytics.topProducts.map(p => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span>{p.name}</span>
                      <Badge>{p.quantity} sold</Badge>
                    </div>
                  ))}
                  {analytics.topProducts.length === 0 && <div className="text-muted-foreground text-sm">No data</div>}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Customers</h4>
                <div className="space-y-2">
                  {analytics.topCustomers.map(c => (
                    <div key={c.id} className="flex justify-between text-sm">
                      <span>{c.name}</span>
                      <Badge>₹{c.spent.toFixed(2)}</Badge>
                    </div>
                  ))}
                  {analytics.topCustomers.length === 0 && <div className="text-muted-foreground text-sm">No data</div>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Customer Search</h2>
          <span className="text-xs text-muted-foreground">Name or phone</span>
        </div>
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
          <input
            className="form-input md:flex-1"
            placeholder="Search by Name or Phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-6">
            {searchResults.map((result, index) => (
              <div key={result.customer.id ?? index} className={index > 0 ? 'pt-6 border-t border-slate-200' : ''}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{result.customer.name}</h3>
                    <div className="text-muted-foreground text-sm">{result.customer.phone ?? 'No Phone'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-success">Total Spent: ₹{result.stats.total_spent.toFixed(2)}</div>
                    <div className="text-muted-foreground text-sm">Orders: {result.stats.invoice_count}</div>
                  </div>
                </div>

                <h4 className="font-semibold mb-2">Products Purchased</h4>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Total Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.products.map(p => (
                        <tr key={p.name}>
                          <td>{p.name}</td>
                          <td>{p.total_qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
        {searchResults.length === 0 && searchQuery && !searching && (
          <div className="text-muted-foreground text-center py-6">
            No customers found or no search performed yet.
          </div>
        )}
      </div>
    </div>
  );
}
