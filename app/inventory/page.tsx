'use client';

import type { Product, Supplier } from '@/types';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SearchPill } from '@/components/shared/SearchPill';
import { productCommands, supplierCommands } from '@/lib/tauri';
import { ask } from '@tauri-apps/plugin-dialog';

type NewProductFormState = {
  name: string;
  sku: string;
  price: string;
  selling_price: string;
  stock_quantity: string;
  supplier_id: string;
};

import { useRouter } from 'next/navigation';

export default function Inventory() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<NewProductFormState>({
    name: '',
    sku: '',
    price: '',
    selling_price: '',
    stock_quantity: '',
    supplier_id: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Use Tauri command to get products
      const prodData = await productCommands.getAll();
      setProducts(prodData);

      const suppData = await supplierCommands.getAll();
      setSuppliers(suppData);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await productCommands.create({
        name: newProduct.name,
        sku: newProduct.sku,
        price: parseFloat(newProduct.price),
        selling_price: newProduct.selling_price ? parseFloat(newProduct.selling_price) : null,
        stock_quantity: parseInt(newProduct.stock_quantity, 10),
        supplier_id: newProduct.supplier_id ? Number(newProduct.supplier_id) : null,
      });
      setShowAddForm(false);
      setNewProduct({ name: '', sku: '', price: '', selling_price: '', stock_quantity: '', supplier_id: '' });
      void fetchData();
    } catch (error) {
      console.error('Error creating product:', error);
      alert(`Error saving product: ${error}`);
    }
  };

  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editProduct) return;
    try {
      await productCommands.update({
        id: editProduct.id,
        name: editProduct.name,
        sku: editProduct.sku,
        price: editProduct.price,
        selling_price: editProduct.selling_price,
        stock_quantity: editProduct.stock_quantity,
        supplier_id: editProduct.supplier_id,
      });
      setEditProduct(null);
      void fetchData();
    } catch (error) {
      console.error('Error updating product:', error);
      alert(`Error updating: ${error}`);
    }
  };

  const handleDelete = async (id: number) => {
    const product = products.find(p => p.id === id);
    const productName = product?.name || `Product #${id}`;

    try {
      const confirmed = await ask(`Are you sure you want to delete "${productName}"?\n\nThis action cannot be undone.`, {
        title: 'Confirm Delete',
        kind: 'warning',
        okLabel: 'Delete',
        cancelLabel: 'Cancel'
      });

      if (!confirmed) {
        return;
      }

      await productCommands.delete(id);
      void fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`Delete failed: ${message}`);
    }
  };

  const handleAddMockData = async () => {
    try {
      const result = await productCommands.addMockData();
      alert(result);
      void fetchData();
    } catch (error) {
      console.error('Error adding mock data:', error);
      alert(`Failed to add mock data: ${error}`);
    }
  };

  if (loading) return <div>Loading...</div>;

  const filtered = products.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
  });
  const displayed = searchTerm ? filtered : filtered.slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-5">
          <h1 className="page-title">Inventory</h1>
          <SearchPill
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search products..."
          />
        </div>
        <div className="flex gap-2">
          {products.length === 0 && (
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
              setEditProduct(null);
            }}
          >
            {showAddForm ? 'Cancel' : 'Add Product'}
          </Button>
        </div>
      </div>

      {showAddForm && (
        <Card className="space-y-4 p-5">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Product Name</label>
                <Input
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">SKU</label>
                <Input
                  value={newProduct.sku}
                  onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Actual Price (Purchase Price)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Selling Price</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProduct.selling_price}
                  onChange={(e) => setNewProduct({ ...newProduct, selling_price: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Stock Quantity</label>
                <Input
                  type="number"
                  value={newProduct.stock_quantity}
                  onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Supplier</label>
                <Select
                  value={newProduct.supplier_id}
                  onChange={(e) => setNewProduct({ ...newProduct, supplier_id: e.target.value })}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Button type="submit" className="mt-4">
              Save Product
            </Button>
          </form>
        </Card>
      )}

      {editProduct && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Edit Product</h2>
            <Button variant="ghost" onClick={() => setEditProduct(null)}>
              Close
            </Button>
          </div>
          <form onSubmit={handleUpdate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Product Name</label>
                <Input
                  value={editProduct.name}
                  onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">SKU</label>
                <Input
                  value={editProduct.sku}
                  onChange={(e) => setEditProduct({ ...editProduct, sku: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Actual Price (Purchase Price)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editProduct.price}
                  onChange={(e) =>
                    setEditProduct({ ...editProduct, price: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <label className="form-label">Selling Price</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editProduct.selling_price ?? ''}
                  onChange={(e) =>
                    setEditProduct({ ...editProduct, selling_price: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
              <div>
                <label className="form-label">Stock Quantity</label>
                <Input
                  type="number"
                  value={editProduct.stock_quantity}
                  onChange={(e) =>
                    setEditProduct({ ...editProduct, stock_quantity: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <label className="form-label">Supplier</label>
                <Select
                  value={editProduct.supplier_id ?? ''}
                  onChange={(e) =>
                    setEditProduct({
                      ...editProduct,
                      supplier_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button type="submit">Update Product</Button>
              <Button type="button" variant="ghost" onClick={() => setEditProduct(null)}>
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
              <TableHead className="text-center font-bold text-black">Name</TableHead>
              <TableHead className="text-center font-bold text-black">SKU</TableHead>
              <TableHead className="text-center font-bold text-black">Stock Amount</TableHead>
              <TableHead className="text-center font-bold text-black">Amount Sold</TableHead>
              <TableHead className="text-center font-bold text-black">Stock / Actual Price / Sale Price</TableHead>
              <TableHead className="text-center font-bold text-black">Supplier</TableHead>
              <TableHead className="text-center font-bold text-black">Status</TableHead>
              <TableHead className="text-center font-bold text-black">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((product) => (
              <TableRow
                key={product.id}
                className="hover:bg-sky-50/60 cursor-pointer"
                onClick={() => router.push(`/inventory/details?id=${product.id}`)}
              >
                <TableCell className="font-semibold text-center">{product.name}</TableCell>
                <TableCell className="text-center">{product.sku}</TableCell>
                <TableCell className="text-center">
                  {product.selling_price ? (
                    <span className="font-medium text-slate-700">
                      ₹{((product.initial_stock ?? product.stock_quantity) * product.selling_price).toFixed(0)}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {product.selling_price ? (
                    <span className="font-medium text-slate-700">
                      ₹{Math.max(
                        0,
                        ((product.initial_stock ?? product.stock_quantity) - product.stock_quantity) *
                          product.selling_price
                      ).toFixed(0)}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-3 text-sm">
                    <span className="text-slate-700 font-medium">
                      <span className="text-xs text-slate-400">Stock:</span>{' '}
                      {product.initial_stock ?? product.stock_quantity}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-600">
                      <span className="text-xs text-slate-400">Actual:</span> ₹{product.price.toFixed(0)}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-emerald-600 font-medium">
                      <span className="text-xs text-slate-400">Sale:</span> ₹{product.selling_price ? product.selling_price.toFixed(0) : '-'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {suppliers.find((s) => s.id === product.supplier_id)?.name ?? '-'}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex justify-center">
                      {product.stock_quantity < 10 ? (
                        <Badge className="bg-red-100 text-red-700">Low Stock</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700">In Stock</Badge>
                      )}
                    </div>
                    <div className="text-[11px] leading-none text-slate-500">
                      Current: {product.stock_quantity}
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
                        setEditProduct(product);
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
                        await handleDelete(product.id);
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
  );
}
