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

type NewProductFormState = {
  name: string;
  sku: string;
  price: string;
  stock_quantity: string;
  supplier_id: string;
};

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<NewProductFormState>({
    name: '',
    sku: '',
    price: '',
    stock_quantity: '',
    supplier_id: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [prodRes, suppRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/suppliers'),
      ]);
      const prodData = (await prodRes.json()) as Product[];
      const suppData = (await suppRes.json()) as Supplier[];
      setProducts(prodData);
      setSuppliers(suppData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProduct,
          price: parseFloat(newProduct.price),
          stock_quantity: parseInt(newProduct.stock_quantity, 10),
          supplier_id: newProduct.supplier_id ? Number(newProduct.supplier_id) : null,
        }),
      });
      if (res.ok) {
        setShowAddForm(false);
        setNewProduct({ name: '', sku: '', price: '', stock_quantity: '', supplier_id: '' });
        void fetchData();
      } else {
        alert('Error saving product');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editProduct) return;
    try {
      const res = await fetch(`/api/products/${editProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editProduct.name,
          sku: editProduct.sku,
          price: editProduct.price,
          stock_quantity: editProduct.stock_quantity,
          supplier_id: editProduct.supplier_id,
        }),
      });
      if (res.ok) {
        setEditProduct(null);
        void fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Error updating');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        void fetchData();
      } else {
        alert('Delete failed');
      }
    } catch (error) {
      console.error(error);
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
                <label className="form-label">Price</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  required
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
                <label className="form-label">Price</label>
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
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-semibold">{product.sku}</TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>₹{product.price.toFixed(2)}</TableCell>
                <TableCell>{product.stock_quantity}</TableCell>
                <TableCell>
                  {suppliers.find((s) => s.id === product.supplier_id)?.name ?? '-'}
                </TableCell>
                <TableCell>
                  {product.stock_quantity < 10 ? (
                    <Badge className="bg-red-100 text-red-700">Low Stock</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700">In Stock</Badge>
                  )}
                </TableCell>
                <TableCell className="space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditProduct(product)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>
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
