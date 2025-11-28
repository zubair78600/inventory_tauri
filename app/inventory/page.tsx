'use client';

import type { Product, Supplier } from '@/types';
import { useDeferredValue, useEffect, useMemo, useState, useTransition, type FormEvent } from 'react';
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
import { generateInventoryReportPDF } from '@/lib/pdf-generator';
import { ask } from '@tauri-apps/plugin-dialog';
import { useRouter } from 'next/navigation';
import { PDFPreviewDialog } from '@/components/shared/PDFPreviewDialog';

type NewProductFormState = {
  name: string;
  sku: string;
  price: string;
  selling_price: string;
  stock_quantity: string;
  supplier_id: string;
  amount_paid: string;
};

export default function Inventory() {
  const router = useRouter();
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<NewProductFormState>({
    name: '',
    sku: '',
    price: '',
    selling_price: '',
    stock_quantity: '',
    supplier_id: '',
    amount_paid: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [, startTransition] = useTransition();

  // Initial load handled by search effect
  // useEffect(() => {
  //   void fetchData(true);
  // }, []);

  useEffect(() => {
    router.prefetch('/purchase-orders');
  }, [router]);

  const fetchData = async (reset = false, newSearchTerm = searchTerm) => {
    try {
      const currentPage = reset ? 1 : page;
      const [prodData, suppData] = await Promise.all([
        productCommands.getAll(currentPage, pageSize, newSearchTerm),
        // Fetch first 100 suppliers for the dropdown
        supplierCommands.getAll(1, 100),
      ]);

      startTransition(() => {
        if (reset) {
          setProducts(prodData.items);
          setPage(2); // Next page to fetch
        } else {
          setProducts(prev => [...prev, ...prodData.items]);
          setPage(prev => prev + 1);
        }

        setTotalCount(prodData.total_count);
        setHasMore(prodData.items.length === pageSize);
        setSuppliers(suppData.items);
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to fetch data');
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
      await productCommands.create({
        name: newProduct.name,
        sku: newProduct.sku,
        price: parseFloat(newProduct.price),
        selling_price: newProduct.selling_price ? parseFloat(newProduct.selling_price) : null,
        stock_quantity: parseInt(newProduct.stock_quantity, 10),
        supplier_id: newProduct.supplier_id ? Number(newProduct.supplier_id) : null,
        amount_paid: newProduct.amount_paid ? parseFloat(newProduct.amount_paid) : null,
      });
      setNewProduct({
        name: '',
        sku: '',
        price: '',
        selling_price: '',
        stock_quantity: '',
        supplier_id: '',
        amount_paid: '',
      });
      void fetchData(true);
      setShowAddProduct(false);
      alert('Product created successfully!');
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
      void fetchData(true);
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
      void fetchData(true);
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
      void fetchData(true);
    } catch (error) {
      console.error('Error adding mock data:', error);
      alert(`Failed to add mock data: ${error}`);
    }
  };

  const displayedProducts = products;



  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-5 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Inventory ({totalCount})</h1>
        <div className="flex gap-2 items-center">
          <SearchPill
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search products..."
          />
          <div className="flex gap-2">
            {products.length === 0 && (
              <Button variant="outline" onClick={handleAddMockData}>
                Load Sample Data
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                const url = generateInventoryReportPDF(products);
                setPdfUrl(url);
                setPdfFileName(`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);
                setShowPdfPreview(true);
              }}
            >
              Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/purchase-orders')}
            >
              Purchase Orders
            </Button>
            <Button
              variant={showAddProduct ? 'default' : 'outline'}
              onClick={() => setShowAddProduct(!showAddProduct)}
            >
              Add Product
            </Button>
          </div>
        </div>
      </div>

      {/* Add Product Form */}
      {showAddProduct && (
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Add New Product</h2>
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
                <label className="form-label">
                  Amount Paid
                  {newProduct.price && newProduct.stock_quantity && (
                    <span className="ml-2 text-xs text-slate-400">
                      Stock Amount (
                      ₹
                      {(
                        parseFloat(newProduct.price || '0') *
                        parseInt(newProduct.stock_quantity || '0', 10)
                      ).toFixed(0)}
                      )
                    </span>
                  )}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={newProduct.amount_paid}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, amount_paid: e.target.value })
                  }
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

      {/* ... rest of component ... */}



      {/* Edit Product Form */}
      {
        editProduct && (
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
        )
      }

      {/* Products Table - Always Visible */}
      <div className="w-full flex-1 overflow-hidden">
        <Card className="table-container p-0 h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white dark:bg-slate-950 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[50px] text-center font-bold text-black">S.No</TableHead>
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
                {displayedProducts.map((product) => (
                  <TableRow
                    key={product.id}
                    className="hover:bg-sky-50/60 cursor-pointer"
                    onClick={() => router.push(`/inventory/details?id=${product.id}`)}
                  >
                    <TableCell className="text-center font-medium text-slate-500">
                      {(page - 1) * pageSize + displayedProducts.indexOf(product) + 1}
                    </TableCell>
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
    </div >
  );
}
