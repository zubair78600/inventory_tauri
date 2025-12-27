'use client';

import type { Customer } from '@/lib/tauri';
import type { CustomerReport } from '@/lib/tauri';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { SearchPill } from '@/components/shared/SearchPill';
import { LocationSelector } from '@/components/shared/LocationSelector';
import type { LocationValue } from '@/types/location';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { customerCommands, analyticsCommands } from '@/lib/tauri';
import { generateCustomerListPDF } from '@/lib/pdf-generator';
import { ask } from '@tauri-apps/plugin-dialog';
import { PDFPreviewDialog } from '@/components/shared/PDFPreviewDialog';
import { useAuth } from '@/contexts/AuthContext';

type NewCustomerFormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  place: string;
  state: string;
  district: string;
  town: string;
};

export default function Customers() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [selectedReport, setSelectedReport] = useState<CustomerReport | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 50;
  const [newCustomer, setNewCustomer] = useState<NewCustomerFormState>({
    name: '',
    email: '',
    phone: '',
    address: '',
    place: '',
    state: '',
    district: '',
    town: '',
  });
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Infinite query for customers with caching
  const {
    data: customersData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loading,
  } = useInfiniteQuery({
    queryKey: ['customers', debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      return await customerCommands.getAll(pageParam, pageSize, debouncedSearch || undefined);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.flatMap(p => p.items).length;
      if (loadedCount < lastPage.total_count) {
        return allPages.length + 1;
      }
      return undefined;
    },
    placeholderData: keepPreviousData, // Keep showing old data while fetching new search results
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Flatten paginated data
  const customers = useMemo(() => {
    return customersData?.pages.flatMap(page => page.items) ?? [];
  }, [customersData]);

  const totalCount = customersData?.pages[0]?.total_count ?? 0;

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  };

  // Invalidate queries after mutations
  const invalidateCustomers = async () => {
    await queryClient.invalidateQueries({ queryKey: ['customers'], exact: false });
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
        state: newCustomer.state || null,
        district: newCustomer.district || null,
        town: newCustomer.town || null,
      });
      setShowAddForm(false);
      setNewCustomer({ name: '', email: '', phone: '', address: '', place: '', state: '', district: '', town: '' });
      invalidateCustomers();
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
        state: editCustomer.state,
        district: editCustomer.district,
        town: editCustomer.town,
      });
      setEditCustomer(null);
      invalidateCustomers();
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

      await customerCommands.delete(id, user?.username);
      await invalidateCustomers();
      setSelectedReport(null);
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Error deleting customer: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const displayedCustomers = customers;

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)] flex flex-col relative">
      <div className="flex items-center justify-between h-14 min-h-[3.5rem]">
        <div className="flex flex-col items-start gap-0.5">
          <div className="flex items-center gap-[25px]">
            <h1 className="page-title !mb-0">Customers</h1>
            <SearchPill
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search customers..."
              className="w-[260px] mt-1.5"
            />
          </div>
          <p className="text-sm text-muted-foreground">{totalCount} total customers</p>
        </div>

        <div className="flex gap-2 items-center z-20">
          <Button variant="ghost" onClick={invalidateCustomers}>
            Refresh
          </Button>
          <Button variant="outline" onClick={async () => {
            const url = await generateCustomerListPDF(customers);
            setPdfUrl(url);
            setPdfFileName(`Customer_List_${new Date().toISOString().split('T')[0]}.pdf`);
            setShowPdfPreview(true);
          }}>
            Export PDF
          </Button>
          <Button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditCustomer(null);
              setShowAddForm(!showAddForm);
              setEditCustomer(null);
              setNewCustomer({ name: '', email: '', phone: '', address: '', place: '', state: '', district: '', town: '' });
            }}
          >
            {showAddForm ? 'Cancel' : 'Add Customer'}
          </Button>
        </div>
      </div>

      {
        showAddForm && (
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
                <div className="md:col-span-2">
                  <LocationSelector
                    value={{
                      state: newCustomer.state,
                      district: newCustomer.district,
                      town: newCustomer.town,
                    }}
                    onChange={(val: LocationValue) => setNewCustomer({
                      ...newCustomer,
                      state: val.state,
                      district: val.district,
                      town: val.town
                    })}
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
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setNewCustomer({ ...newCustomer, phone: val })
                    }}
                    placeholder="10-digit number"
                    pattern="\d{10}"
                    title="Phone number must be exactly 10 digits"
                    minLength={10}
                    maxLength={10}
                    required
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
        )
      }

      {
        editCustomer && (
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
                <div className="md:col-span-2">
                  <LocationSelector
                    value={{
                      state: editCustomer.state || '',
                      district: editCustomer.district || '',
                      town: editCustomer.town || '',
                    }}
                    onChange={(val: LocationValue) => setEditCustomer({
                      ...editCustomer,
                      state: val.state,
                      district: val.district,
                      town: val.town
                    })}
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
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setEditCustomer({ ...editCustomer, phone: val })
                    }}
                    placeholder="10-digit number"
                    pattern="\d{10}"
                    title="Phone number must be exactly 10 digits"
                    minLength={10}
                    maxLength={10}
                    required
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
        )
      }

      <div className="w-full flex-1 overflow-hidden relative">
        <Card className="table-container p-0 h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white dark:bg-slate-950 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[50px] text-center font-bold !text-black">S.No</TableHead>
                  <TableHead className="text-center font-bold !text-black">Customer</TableHead>
                  <TableHead className="text-center font-bold !text-black">Contact</TableHead>
                  <TableHead className="text-center font-bold !text-black">Place</TableHead>
                  <TableHead className="text-center font-bold !text-black">Last Billed</TableHead>
                  <TableHead className="text-center font-bold !text-black">Invoices</TableHead>
                  <TableHead className="text-center font-bold !text-black">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedCustomers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className={`hover:bg-sky-50/60 cursor-pointer ${selectedId === customer.id ? 'bg-sky-50' : ''}`}
                    onClick={() => router.push(`/customers/details?id=${customer.id}`)}
                  >
                    <TableCell className="text-center font-medium text-slate-500">
                      {displayedCustomers.indexOf(customer) + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-center space-y-1">
                      <div className="text-slate-900 dark:text-slate-100">{customer.name}</div>
                      {customer.address && (
                        <div className="text-xs text-muted-foreground">{customer.address}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center space-y-1">
                      {customer.email && <div className="text-sm text-slate-600 dark:text-slate-400">{customer.email}</div>}
                      {customer.phone && (
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{customer.phone}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                      {customer.town?.trim() || customer.place?.trim() || '—'}
                    </TableCell>
                    <TableCell className="text-center text-sm text-slate-600 dark:text-slate-400">
                      {customer.last_billed ? new Date(customer.last_billed).toLocaleDateString() : '—'}
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
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-2"
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
                          className="text-xs h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
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
            {loading && !displayedCustomers.length && (
              <div className="flex justify-center items-center h-40">
                <div className="text-slate-500">Loading customers...</div>
              </div>
            )}
            {hasNextPage && (
              <div className="px-4 pb-4 pt-2">
                <button
                  onClick={loadMore}
                  disabled={isFetchingNextPage}
                  className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-700 font-medium rounded-md transition-colors"
                >
                  {isFetchingNextPage ? 'Loading...' : 'Load 50 More'}
                </button>
              </div>
            )}
          </div>
          {/* Loading Overlay */}
          {(loading || isFetchingNextPage) && displayedCustomers.length > 0 && (
            <div className="absolute inset-0 bg-white/50 z-20 pointer-events-none flex items-start justify-center pt-20">
              {/* Optional spinner or just allow interaction with opacity */}
            </div>
          )}
        </Card>
      </div >
      <PDFPreviewDialog
        open={showPdfPreview}
        onOpenChange={setShowPdfPreview}
        url={pdfUrl}
        fileName={pdfFileName}
      />
    </div >
  );
}
