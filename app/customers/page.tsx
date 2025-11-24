'use client';

import type { Customer } from '@/lib/tauri';
import type { CustomerReport } from '@/lib/tauri';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
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
import { customerCommands, analyticsCommands, invoiceCommands } from '@/lib/tauri';
import { ask } from '@tauri-apps/plugin-dialog';

type NewCustomerFormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  place: string;
};

export default function Customers() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [selectedReport, setSelectedReport] = useState<CustomerReport | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newCustomer, setNewCustomer] = useState<NewCustomerFormState>({
    name: '',
    email: '',
    phone: '',
    address: '',
    place: '',
  });

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await customerCommands.getAll();
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
    try {
      const data = await analyticsCommands.customerSearch(customer.name);
      const match = data.find((r) => r.customer.id === customer.id) ?? data[0] ?? null;
      setSelectedReport(match);
    } catch (error) {
      console.error(error);
      setSelectedReport(null);
    } finally {
      setReportLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await customerCommands.create({
        name: newCustomer.name,
        email: newCustomer.email || null,
        phone: newCustomer.phone || null,
        address: newCustomer.address || null,
        place: newCustomer.place || null,
      });
      setShowAddForm(false);
      setNewCustomer({ name: '', email: '', phone: '', address: '', place: '' });
      void fetchData();
      setSelectedReport(null);
    } catch (error) {
      console.error(error);
      alert('Error adding customer');
    }
  };

  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editCustomer) return;
    try {
      await customerCommands.update({
        id: editCustomer.id,
        name: editCustomer.name,
        email: editCustomer.email,
        phone: editCustomer.phone,
        address: editCustomer.address,
        place: editCustomer.place,
      });
      setEditCustomer(null);
      void fetchData();
      setSelectedReport(null);
    } catch (error) {
      console.error(error);
      alert('Error updating customer');
    }
  };

  const handleDelete = async (id: number) => {
    const customer = customers.find(c => c.id === id);
    const customerName = customer?.name || `Customer #${id}`;

    try {
      const confirmed = await ask(`Are you sure you want to delete "${customerName}"?\n\nThis action cannot be undone and will also delete all associated invoices.`, {
        title: 'Confirm Delete',
        kind: 'warning',
        okLabel: 'Delete',
        cancelLabel: 'Cancel'
      });

      if (!confirmed) {
        return;
      }

      await customerCommands.delete(id);
      void fetchData();
      setSelectedReport(null);
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Error deleting customer: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  if (loading) return <div>Loading...</div>;

  const filteredCustomers = customers.filter((c) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      c.name.toLowerCase().includes(term) ||
      (c.email ?? '').toLowerCase().includes(term) ||
      (c.phone ?? '').toLowerCase().includes(term) ||
      (c.place ?? '').toLowerCase().includes(term)
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
                <label className="form-label">Place</label>
                <Input
                  value={newCustomer.place}
                  onChange={(e) => setNewCustomer({ ...newCustomer, place: e.target.value })}
                  placeholder="City or Location"
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
              <div className="md:col-span-2">
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
                <label className="form-label">Place</label>
                <Input
                  value={editCustomer.place || ''}
                  onChange={(e) => setEditCustomer({ ...editCustomer, place: e.target.value })}
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
              <div className="md:col-span-2">
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

      <div className="w-full">
        <Card className="table-container p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center font-bold text-black">Customer</TableHead>
                <TableHead className="text-center font-bold text-black">Contact</TableHead>
                <TableHead className="text-center font-bold text-black">Place</TableHead>
                <TableHead className="text-center font-bold text-black">Last Billed</TableHead>
                <TableHead className="text-center font-bold text-black">Invoices</TableHead>
                <TableHead className="text-center font-bold text-black">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(searchTerm ? filteredCustomers : filteredCustomers.slice(0, 10)).map((customer) => (
                <TableRow
                  key={customer.id}
                  className={`hover:bg-sky-50/60 cursor-pointer ${selectedId === customer.id ? 'bg-sky-50' : ''}`}
                  onClick={() => router.push(`/customers/details?id=${customer.id}`)}
                >
                  <TableCell className="font-semibold text-center space-y-1">
                    <div className="text-slate-900 dark:text-slate-100">{customer.name}</div>
                    {customer.address && (
                      <div className="text-xs text-muted-foreground">{customer.address}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-center space-y-1">
                    {customer.email && <div className="text-sm">{customer.email}</div>}
                    {customer.phone && (
                      <div className="text-sm text-muted-foreground">{customer.phone}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm">{customer.place ?? '—'}</TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {customer.last_billed ? new Date(customer.last_billed).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <div
                        className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-medium"
                      >
                        {customer.invoice_count ?? 0}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 lg:px-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditCustomer(customer);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 lg:px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          await handleDelete(customer.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
