'use client';

import type { Customer, CustomerReport } from '@/types';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchPill } from '@/components/shared/SearchPill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type NewCustomerFormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [selectedReport, setSelectedReport] = useState<CustomerReport | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<
    { id: number; product_name: string; quantity: number; unit_price: number; total: number }[]
  >([]);
  const [activeInvoice, setActiveInvoice] = useState<number | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);
  const [activeInvoiceDetail, setActiveInvoiceDetail] = useState<
    CustomerReport['invoices'][number] | null
  >(null);
  const [newCustomer, setNewCustomer] = useState<NewCustomerFormState>({
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = (await res.json()) as Customer[];
      setCustomers(data);
      setSearchTerm('');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (customer: Customer) => {
    setReportLoading(true);
    setSelectedId(customer.id);
    setActiveInvoice(null);
    setInvoiceItems([]);
    try {
      const res = await fetch(
        `/api/reports/customer-search?q=${encodeURIComponent(customer.name)}`
      );
      if (!res.ok) throw new Error('Failed to load customer report');
      const data = (await res.json()) as CustomerReport[];
      const match = data.find((r) => r.customer.id === customer.id) ?? data[0] ?? null;
      setSelectedReport(match);
    } catch (error) {
      console.error(error);
      setSelectedReport(null);
    } finally {
      setReportLoading(false);
    }
  };

  const loadInvoiceItems = async (invoiceId: number) => {
    setActiveInvoice(invoiceId);
    setInvoiceError(null);
    const invoiceDetail = selectedReport?.invoices.find((i) => i.id === invoiceId) ?? null;
    setActiveInvoiceDetail(invoiceDetail);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/items`);
      if (!res.ok) {
        setInvoiceItems([]);
        setInvoiceError('Could not load items for this invoice.');
        return;
      }
      const data = (await res.json()) as {
        id: number;
        product_name: string;
        quantity: number;
        unit_price: number;
        total: number;
      }[];
      setInvoiceItems(data);
      setShowInvoiceModal(true);
    } catch (error) {
      console.error(error);
      setInvoiceItems([]);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });
      if (res.ok) {
        setShowAddForm(false);
        setNewCustomer({ name: '', email: '', phone: '', address: '' });
        void fetchData();
        setSelectedReport(null);
      } else {
        alert('Error adding customer');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editCustomer) return;
    try {
      const res = await fetch(`/api/customers/${editCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editCustomer),
      });
      if (res.ok) {
        setEditCustomer(null);
        void fetchData();
        setSelectedReport(null);
      } else {
        alert('Error updating customer');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this customer?')) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        void fetchData();
        setSelectedReport(null);
      } else {
        alert('Error deleting customer');
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div>Loading...</div>;

  const filteredCustomers = customers.filter((c) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      c.name.toLowerCase().includes(term) ||
      (c.email ?? '').toLowerCase().includes(term) ||
      (c.phone ?? '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-5">
          <h1 className="page-title">Customers</h1>
          <SearchPill
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search customers..."
          />
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="ghost" onClick={() => fetchData()}>
            Refresh
          </Button>
          <Button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditCustomer(null);
            }}
          >
            {showAddForm ? 'Cancel' : 'Add Customer'}
          </Button>
        </div>
      </div>

      {showAddForm && (
        <Card className="space-y-4 p-5">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Name</label>
                <Input
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <Input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <Input
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Address</label>
                <Input
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" className="mt-4">
              Save Customer
            </Button>
          </form>
        </Card>
      )}

      {editCustomer && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Edit Customer</h2>
            <Button variant="ghost" onClick={() => setEditCustomer(null)}>
              Close
            </Button>
          </div>
          <form onSubmit={handleUpdate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Name</label>
                <Input
                  value={editCustomer.name}
                  onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <Input
                  type="email"
                  value={editCustomer.email || ''}
                  onChange={(e) => setEditCustomer({ ...editCustomer, email: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <Input
                  value={editCustomer.phone || ''}
                  onChange={(e) => setEditCustomer({ ...editCustomer, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Address</label>
                <Input
                  value={editCustomer.address || ''}
                  onChange={(e) => setEditCustomer({ ...editCustomer, address: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button type="submit">Update Customer</Button>
              <Button variant="ghost" type="button" onClick={() => setEditCustomer(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="table-container p-0 lg:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(searchTerm ? filteredCustomers : filteredCustomers.slice(0, 10)).map((customer) => (
                <TableRow
                  key={customer.id}
                  className={`cursor-pointer hover:bg-sky-50/60 ${selectedId === customer.id ? 'bg-sky-50' : ''}`}
                  onClick={() => loadReport(customer)}
                >
                  <TableCell className="font-semibold space-y-1">
                    <div className="text-slate-900">{customer.name}</div>
                    {customer.address && (
                      <div className="text-xs text-muted-foreground">{customer.address}</div>
                    )}
                  </TableCell>
                  <TableCell className="space-y-1">
                    {customer.email && <div className="text-sm">{customer.email}</div>}
                    {customer.phone && (
                      <div className="text-sm text-muted-foreground">{customer.phone}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{customer.address ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {customer.created_at ? new Date(customer.created_at).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditCustomer(customer);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(customer.id);
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="section-title mb-0">Purchases</h3>
            {reportLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
          </div>
          {selectedReport && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold">{selectedReport.customer.name}</span>
                <span className="text-muted-foreground">
                  Last invoice:{' '}
                  {selectedReport.invoices[0]
                    ? new Date(selectedReport.invoices[0].created_at).toLocaleString()
                    : '—'}
                </span>
              </div>
              <div className="text-muted-foreground">
                {selectedReport.customer.phone ?? 'No phone'}
              </div>
            </div>
          )}
          {!selectedReport && !reportLoading && (
            <p className="text-sm text-muted-foreground">
              Select a customer to view their invoices and items.
            </p>
          )}
          {selectedReport && (
            <div className="space-y-4 mt-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-muted-foreground">Totals</p>
                <p className="text-lg font-semibold">
                  ₹{selectedReport.stats.total_spent.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedReport.stats.invoice_count} invoices • discounts ₹
                  {selectedReport.stats.total_discount.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Joined:{' '}
                  {selectedReport.customer.created_at
                    ? new Date(selectedReport.customer.created_at).toLocaleString()
                    : '—'}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Recent Invoices</h4>
                <div className="space-y-2 max-h-40 overflow-auto pr-1">
                  {selectedReport.invoices.map((inv) => (
                    <button
                      key={inv.id}
                      className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                        activeInvoice === inv.id
                          ? 'border-sky-300 bg-sky-50'
                          : 'border-slate-200 hover:border-sky-200 hover:bg-sky-50/60'
                      }`}
                      onClick={() => loadInvoiceItems(inv.id)}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{inv.invoice_number}</span>
                        <span className="font-semibold">₹{inv.total_amount.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString()} • {inv.item_count} items
                      </p>
                    </button>
                  ))}
                  {selectedReport.invoices.length === 0 && (
                    <p className="text-xs text-muted-foreground">No invoices yet.</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">
                    {activeInvoice ? 'Items for selected invoice' : 'Items Purchased'}
                  </h4>
                  {activeInvoice && (
                    <button
                      className="text-xs text-sky-600 hover:text-sky-700"
                      type="button"
                      onClick={() => {
                        setActiveInvoice(null);
                        setInvoiceItems([]);
                        setInvoiceError(null);
                      }}
                    >
                      Show all
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-40 overflow-auto pr-1">
                  {(activeInvoice ? invoiceItems : selectedReport.products).map((p, idx) => (
                    <div
                      key={`${'product_name' in p ? p.product_name : p.name ?? 'item'}-${idx}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span>{'product_name' in p ? p.product_name : p.name}</span>
                      <span className="font-semibold">
                        {'quantity' in p ? `${p.quantity} qty` : `${p.total_qty} qty`}
                      </span>
                    </div>
                  ))}
                  {(activeInvoice ? invoiceItems : selectedReport.products).length === 0 &&
                    !invoiceError && (
                      <p className="text-xs text-muted-foreground">No products purchased yet.</p>
                    )}
                  {invoiceError && <p className="text-xs text-danger">{invoiceError}</p>}
                </div>
              </div>
            </div>
          )}
        </Card>

        {showInvoiceModal && activeInvoiceDetail && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice</p>
                  <p className="text-lg font-semibold">{activeInvoiceDetail.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activeInvoiceDetail.created_at).toLocaleString()}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setShowInvoiceModal(false)}>
                  Close
                </Button>
              </div>
              <div className="mt-3 text-sm">
                <p className="font-semibold">{selectedReport?.customer.name}</p>
                <p className="text-muted-foreground">{selectedReport?.customer.phone ?? ''}</p>
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 max-h-64 overflow-auto divide-y">
                {invoiceItems.map((item) => (
                  <div
                    key={item.id}
                    className="px-3 py-2 flex items-center justify-between text-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        ₹{item.unit_price.toFixed(2)} • Qty {item.quantity}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900">₹{item.total.toFixed(2)}</p>
                  </div>
                ))}
                {invoiceItems.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No items loaded.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
