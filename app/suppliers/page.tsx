'use client';

import type { Supplier } from '@/lib/tauri';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SearchPill } from '@/components/shared/SearchPill';
import { LocationSelector } from '@/components/shared/LocationSelector';
import { useLocationDefaults } from '@/hooks/useLocationDefaults';
import { supplierCommands } from '@/lib/tauri';
import { generateSupplierListPDF } from '@/lib/pdf-generator';
import { ask } from '@tauri-apps/plugin-dialog';

import { PDFPreviewDialog } from '@/components/shared/PDFPreviewDialog';

type NewSupplierForm = {
  name: string;
  contact_info: string;
  address: string;
  email: string;
  comments: string;
  state: string;
  district: string;
  town: string;
};

import { useRouter } from 'next/navigation';

export default function Suppliers() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');

  // Location smart defaults
  const { defaults, recordSelection } = useLocationDefaults('suppliers');

  const [newSupplier, setNewSupplier] = useState<NewSupplierForm>({
    name: '',
    contact_info: '',
    address: '',
    email: '',
    comments: '',
    state: defaults?.state || '',
    district: defaults?.district || '',
    town: defaults?.town || '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Initial load handled by search effect
  // useEffect(() => {
  //   void fetchData(true);
  // }, []);

  const fetchData = async (reset = false, newSearchTerm = searchTerm) => {
    try {
      const currentPage = reset ? 1 : page;
      const data = await supplierCommands.getAll(currentPage, pageSize, newSearchTerm);

      if (reset) {
        setSuppliers(data.items);
        setPage(2); // Next page to fetch
      } else {
        setSuppliers(prev => [...prev, ...data.items]);
        setPage(prev => prev + 1);
      }

      setTotalCount(data.total_count);
      setHasMore(data.items.length === pageSize);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      alert('Failed to fetch suppliers');
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSearching(true);
      void fetchData(true, searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadMore = () => {
    void fetchData(false);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await supplierCommands.create({
        name: newSupplier.name,
        contact_info: newSupplier.contact_info || null,
        address: newSupplier.address || null,
        email: newSupplier.email || null,
        comments: newSupplier.comments || null,
        state: newSupplier.state || null,
        district: newSupplier.district || null,
        town: newSupplier.town || null,
      });

      // Record location selection for smart defaults
      if (newSupplier.state && newSupplier.district && newSupplier.town) {
        recordSelection({
          state: newSupplier.state,
          district: newSupplier.district,
          town: newSupplier.town,
        });
      }

      setShowAddForm(false);
      setNewSupplier({ name: '', contact_info: '', address: '', email: '', comments: '', state: defaults?.state || '', district: defaults?.district || '', town: defaults?.town || '' });
      void fetchData(true);
    } catch (error) {
      console.error('Error creating supplier:', error);
      alert(`Error adding supplier: ${error}`);
    }
  };

  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editSupplier) return;
    try {
      await supplierCommands.update({
        id: editSupplier.id,
        name: editSupplier.name,
        contact_info: editSupplier.contact_info,
        address: editSupplier.address,
        email: editSupplier.email,
        comments: editSupplier.comments,
        state: editSupplier.state,
        district: editSupplier.district,
        town: editSupplier.town,
      });
      setEditSupplier(null);
      void fetchData(true);
    } catch (error) {
      console.error('Error updating supplier:', error);
      alert(`Error updating supplier: ${error}`);
    }
  };

  const handleDelete = async (id: number) => {
    const supplier = suppliers.find(s => s.id === id);
    const supplierName = supplier?.name || `Supplier #${id}`;

    try {
      const confirmed = await ask(`Are you sure you want to delete "${supplierName}"?\n\nThis action cannot be undone and will unlink all associated products.`, {
        title: 'Confirm Delete',
        kind: 'warning',
        okLabel: 'Delete',
        cancelLabel: 'Cancel'
      });

      if (!confirmed) {
        return;
      }

      await supplierCommands.delete(id);
      void fetchData(true);
    } catch (error) {
      console.error('Error deleting supplier:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`Error deleting supplier: ${message}`);
    }
  };

  const handleAddMockData = async () => {
    try {
      const result = await supplierCommands.addMockData();
      alert(result);
      void fetchData(true);
    } catch (error) {
      console.error('Error adding mock data:', error);
      alert(`Failed to add mock data: ${error}`);
    }
  };

  if (loading) return <div>Loading...</div>;

  const displayed = suppliers;

  return (
    <div className="space-y-5 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Suppliers ({totalCount})</h1>
        <div className="flex gap-2 items-center">
          <SearchPill
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search suppliers..."
          />
          <div className="flex gap-2">
            {suppliers.length === 0 && (
              <Button variant="outline" onClick={handleAddMockData}>
                Load Sample Data
              </Button>
            )}
            <Button variant="ghost" onClick={() => fetchData(true)}>
              Refresh
            </Button>
            <Button variant="outline" onClick={() => {
              const url = generateSupplierListPDF(suppliers);
              setPdfUrl(url);
              setPdfFileName(`Supplier_List_${new Date().toISOString().split('T')[0]}.pdf`);
              setShowPdfPreview(true);
            }}>
              Export PDF
            </Button>
            <Button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setEditSupplier(null);
                setNewSupplier({ name: '', contact_info: '', email: '', address: '', town: '', district: '', state: '', comments: '' });
              }}
            >
              Add Supplier
            </Button>
          </div>
        </div>
      </div>

      {showAddForm && (
        <Card className="space-y-4 p-5">
          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              {/* Line 1: Name, Ph.No, Email */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Name</label>
                  <Input
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Ph.No</label>
                  <Input
                    value={newSupplier.contact_info}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contact_info: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <Input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                  />
                </div>
              </div>

              {/* Line 2: Address, Comments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Address</label>
                  <Input
                    value={newSupplier.address}
                    onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Comments</label>
                  <Input
                    value={newSupplier.comments}
                    onChange={(e) => setNewSupplier({ ...newSupplier, comments: e.target.value })}
                  />
                </div>
              </div>

              {/* Line 3: State, District, Town */}
              <LocationSelector
                value={{
                  state: newSupplier.state,
                  district: newSupplier.district,
                  town: newSupplier.town,
                }}
                onChange={(location) => setNewSupplier({ ...newSupplier, ...location })}
              />
            </div>
            <Button type="submit" className="mt-4">
              Save Supplier
            </Button>
          </form>
        </Card>
      )}

      {editSupplier && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Edit Supplier</h2>
            <Button variant="ghost" onClick={() => setEditSupplier(null)}>
              Close
            </Button>
          </div>
          <form onSubmit={handleUpdate}>
            <div className="space-y-3">
              {/* Line 1: Name, Ph.No, Email */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Name</label>
                  <Input
                    value={editSupplier.name}
                    onChange={(e) => setEditSupplier({ ...editSupplier, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Ph.No</label>
                  <Input
                    value={editSupplier.contact_info || ''}
                    onChange={(e) =>
                      setEditSupplier({ ...editSupplier, contact_info: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <Input
                    type="email"
                    value={editSupplier.email || ''}
                    onChange={(e) =>
                      setEditSupplier({ ...editSupplier, email: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Line 2: Address, Comments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Address</label>
                  <Input
                    value={editSupplier.address || ''}
                    onChange={(e) =>
                      setEditSupplier({ ...editSupplier, address: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="form-label">Comments</label>
                  <Input
                    value={editSupplier.comments || ''}
                    onChange={(e) =>
                      setEditSupplier({ ...editSupplier, comments: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Line 3: State, District, Town */}
              <LocationSelector
                value={{
                  state: editSupplier.state || '',
                  district: editSupplier.district || '',
                  town: editSupplier.town || '',
                }}
                onChange={(location) => setEditSupplier({ ...editSupplier, ...location })}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <Button type="submit">Update Supplier</Button>
              <Button variant="ghost" type="button" onClick={() => setEditSupplier(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="w-full flex-1 overflow-hidden">
        <Card className="table-container p-0 h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white dark:bg-slate-950 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[50px] text-center font-bold text-black">S.No</TableHead>
                  <TableHead className="text-center font-bold text-black">Name</TableHead>
                  <TableHead className="text-center font-bold text-black">Contact Info</TableHead>
                  <TableHead className="text-center font-bold text-black">Email</TableHead>
                  <TableHead className="text-center font-bold text-black">Address</TableHead>
                  <TableHead className="text-center font-bold text-black">District</TableHead>
                  <TableHead className="text-center font-bold text-black">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((supplier) => (
                  <TableRow
                    key={supplier.id}
                    className="hover:bg-sky-50/60 cursor-pointer"
                    onClick={() => router.push(`/suppliers/details?id=${supplier.id}`)}
                  >
                    <TableCell className="text-center font-medium text-slate-500">
                      {(page - 1) * pageSize + displayed.indexOf(supplier) + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-center">{supplier.name}</TableCell>
                    <TableCell className="text-center">{supplier.contact_info}</TableCell>
                    <TableCell className="text-center">{supplier.email}</TableCell>
                    <TableCell className="text-center">{supplier.address}</TableCell>
                    <TableCell className="text-center">{supplier.district}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditSupplier(supplier);
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
                            await handleDelete(supplier.id);
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
            {hasMore && (
              <div className="px-4 pb-4 pt-2">
                <button
                  onClick={loadMore}
                  className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md transition-colors"
                >
                  Load 50 More
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>
      <PDFPreviewDialog
        open={showPdfPreview}
        onOpenChange={setShowPdfPreview}
        url={pdfUrl}
        fileName={pdfFileName}
      />
    </div>
  );
}
