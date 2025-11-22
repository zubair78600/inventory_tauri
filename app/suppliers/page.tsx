'use client';

import type { Supplier } from '@/types';
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
import { supplierCommands } from '@/lib/tauri';
import { ask } from '@tauri-apps/plugin-dialog';

type NewSupplierForm = {
  name: string;
  contact_info: string;
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [newSupplier, setNewSupplier] = useState<NewSupplierForm>({
    name: '',
    contact_info: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await supplierCommands.getAll();
      setSuppliers(data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      alert('Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await supplierCommands.create({
        name: newSupplier.name,
        contact_info: newSupplier.contact_info || null,
      });
      setShowAddForm(false);
      setNewSupplier({ name: '', contact_info: '' });
      void fetchData();
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
      });
      setEditSupplier(null);
      void fetchData();
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
      void fetchData();
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
      void fetchData();
    } catch (error) {
      console.error('Error adding mock data:', error);
      alert(`Failed to add mock data: ${error}`);
    }
  };

  if (loading) return <div>Loading...</div>;

  const filtered = suppliers.filter((s) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      s.name.toLowerCase().includes(term) || (s.contact_info ?? '').toLowerCase().includes(term)
    );
  });
  const displayed = searchTerm ? filtered : filtered.slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-5">
          <h1 className="page-title">Suppliers</h1>
          <SearchPill
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search suppliers..."
          />
        </div>
        <div className="flex gap-2">
          {suppliers.length === 0 && (
            <Button variant="outline" onClick={handleAddMockData}>
              Load Sample Data
            </Button>
          )}
          <Button variant="ghost" onClick={() => fetchData()}>
            Refresh
          </Button>
          <Button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditSupplier(null);
            }}
          >
            {showAddForm ? 'Cancel' : 'Add Supplier'}
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
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Contact Info</label>
                <Input
                  value={newSupplier.contact_info}
                  onChange={(e) => setNewSupplier({ ...newSupplier, contact_info: e.target.value })}
                />
              </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Name</label>
                <Input
                  value={editSupplier.name}
                  onChange={(e) => setEditSupplier({ ...editSupplier, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Contact Info</label>
                <Input
                  value={editSupplier.contact_info || ''}
                  onChange={(e) =>
                    setEditSupplier({ ...editSupplier, contact_info: e.target.value })
                  }
                />
              </div>
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

      <Card className="table-container p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-semibold">{supplier.name}</TableCell>
                <TableCell>{supplier.contact_info}</TableCell>
                <TableCell className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
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
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={async (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      await handleDelete(supplier.id);
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
    </div>
  );
}
