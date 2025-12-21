'use client';

import type { Product, Supplier } from '@/types';
import { useEffect, useMemo, useState, useTransition, type FormEvent } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
import { EntityThumbnail } from '@/components/shared/EntityThumbnail';
import { EntityImagePreviewModal } from '@/components/shared/ImagePreviewModal';
import { EntityImageUpload } from '@/components/shared/EntityImageUpload';
import { imageCommands } from '@/lib/tauri';
import { useAuth } from '@/contexts/AuthContext';

type NewProductFormState = {
  name: string;
  sku: string;
  price: string;
  selling_price: string;
  stock_quantity: string;
  supplier_id: string;
  amount_paid: string;
  category: string;
};

export default function Inventory() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<NewProductFormState>({
    name: '',
    sku: '',
    price: '',
    selling_price: '',
    stock_quantity: '',
    supplier_id: '',
    amount_paid: '',
    category: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [isEditNewCategory, setIsEditNewCategory] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 50;

  // Image preview state
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);

  // New Product Image State (Deferred Upload)
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [tempPreviewUrl, setTempPreviewUrl] = useState<string | null>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Auto-calculate Amount Paid when Price or Stock changes
  useEffect(() => {
    const price = parseFloat(newProduct.price);
    const stock = parseInt(newProduct.stock_quantity, 10);

    // Only update if we have valid numbers
    if (!isNaN(price) && !isNaN(stock)) {
      const calculated = (price * stock).toFixed(2);
      // Update only if different to avoid loop (though dependencies handle that)
      if (newProduct.amount_paid !== calculated) {
        setNewProduct(prev => ({ ...prev, amount_paid: calculated }));
      }
    }
  }, [newProduct.price, newProduct.stock_quantity]);

  useEffect(() => {
    router.prefetch('/purchase-orders');
  }, [router]);

  // Fetch suppliers with React Query (cached)
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-dropdown'],
    queryFn: () => supplierCommands.getAll(1, 500),
    staleTime: 60 * 1000, // Cache for 1 minute
  });
  const suppliers = suppliersData?.items ?? [];

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productCommands.getAllCategories(),
    staleTime: 60 * 1000,
  });

  // O(1) supplier lookup using Map instead of O(n) find
  const supplierMap = useMemo(() => {
    return new Map(suppliers.map(s => [s.id, s]));
  }, [suppliers]);

  // Infinite query for products with caching
  const {
    data: productsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loading,
  } = useInfiniteQuery({
    queryKey: ['products', debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      return await productCommands.getAll(pageParam, pageSize, debouncedSearch || undefined);
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
    staleTime: 30 * 1000, // Data fresh for 30 seconds
  });

  // Flatten paginated data
  const products = useMemo(() => {
    return productsData?.pages.flatMap(page => page.items) ?? [];
  }, [productsData]);

  const totalCount = productsData?.pages[0]?.total_count ?? 0;

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  };

  // Invalidate queries after mutations
  const invalidateProducts = () => {
    void queryClient.invalidateQueries({ queryKey: ['products'] });
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const createdProduct = await productCommands.create({
        name: newProduct.name,
        sku: newProduct.sku,
        price: parseFloat(newProduct.price),
        selling_price: newProduct.selling_price ? parseFloat(newProduct.selling_price) : null,
        stock_quantity: parseInt(newProduct.stock_quantity, 10),
        supplier_id: newProduct.supplier_id ? Number(newProduct.supplier_id) : null,
        amount_paid: newProduct.amount_paid ? parseFloat(newProduct.amount_paid) : null,
        category: newProduct.category || null,
      });

      // Handle deferred image upload
      if (pendingImageFile) {
        try {
          const arrayBuffer = await pendingImageFile.arrayBuffer();
          const fileData = Array.from(new Uint8Array(arrayBuffer));
          const extension = pendingImageFile.name.split('.').pop() || 'jpg';
          await imageCommands.saveProductImage(createdProduct.id, fileData, extension);
        } catch (imgErr) {
          console.error("Failed to upload image for new product", imgErr);
          alert("Product created but image upload failed: " + String(imgErr));
        }
      } else if (pendingImageUrl) {
        try {
          await imageCommands.downloadProductImage(createdProduct.id, pendingImageUrl);
        } catch (imgErr) {
          console.error("Failed to download image from URL for new product", imgErr);
          alert("Product created but image download failed: " + String(imgErr));
        }
      }

      setNewProduct({
        name: '',
        sku: '',
        price: '',
        selling_price: '',
        stock_quantity: '',
        supplier_id: '',
        amount_paid: '',
        category: '',
      });
      // Reset image state
      setPendingImageFile(null);
      setPendingImageUrl(null);
      setTempPreviewUrl(null);

      invalidateProducts();
      setShowAddProduct(false);
      // Removed auto-opening of edit form to prevent confusion
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
        category: editProduct.category || null,
      });
      setEditProduct(null);
      invalidateProducts();
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

      await productCommands.delete(id, user?.username);
      invalidateProducts();
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
      invalidateProducts();
    } catch (error) {
      console.error('Error adding mock data:', error);
      alert(`Failed to add mock data: ${error}`);
    }
  };

  const displayedProducts = products;


  if (loading && !displayedProducts.length) return <div>Loading...</div>;

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)] flex flex-col relative">
      <div className="flex items-center justify-between h-14 min-h-[3.5rem] sticky top-0 bg-slate-50 dark:bg-slate-900 z-30 px-1">
        <div className="flex flex-col items-start gap-0.5">
          <div className="flex items-center gap-[25px]">
            <h1 className="page-title !mb-0">Inventory</h1>
            <SearchPill
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search products..."
              className="w-[260px] mt-1.5"
            />
          </div>
          <p className="text-sm text-muted-foreground">{totalCount} total products</p>
        </div>

        <div className="flex gap-2 items-center z-20">
          {products.length === 0 && (
            <Button variant="outline" onClick={handleAddMockData}>
              Load Sample Data
            </Button>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                // Fetch all products for the report
                // Note: This might be heavy if thousands of products.
                const allProducts = await productCommands.getAll(1, 10000); // Hacky all
                const url = await generateInventoryReportPDF(allProducts.items);
                setPdfUrl(url);
                setPdfFileName(`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);
                setShowPdfPreview(true);
              } catch (error) {
                console.error('Error generating inventory report:', error);
                alert('Failed to generate inventory report: ' + String(error));
              }
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
            {showAddProduct ? 'Cancel Add' : 'Add Product'}
          </Button>
        </div>
      </div>

      {/* Add Product Form */}
      {
        showAddProduct && (
          <Card className="space-y-4 p-5 animate-in slide-in-from-top-2 duration-200">
            <h2 className="text-lg font-semibold">Add New Product</h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="form-label">Product Name</label>
                  <Input
                    placeholder="Enter product name"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">SKU</label>
                  <Input
                    placeholder="Enter SKU"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="form-label whitespace-nowrap text-xs">Actual Price (Purchase)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label whitespace-nowrap text-xs">Selling Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newProduct.selling_price}
                    onChange={(e) => setNewProduct({ ...newProduct, selling_price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label whitespace-nowrap text-xs">Stock Quantity</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newProduct.stock_quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label whitespace-nowrap text-xs truncate" title="Amount Paid">
                    Amount Paid {newProduct.amount_paid ? `(${newProduct.amount_paid})` : ''}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newProduct.amount_paid}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, amount_paid: e.target.value })
                    }
                  />
                </div>

                <div className="md:col-span-2">
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
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="form-label">Category</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewCategory(!isNewCategory);
                        setNewProduct({ ...newProduct, category: '' });
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                    >
                      {isNewCategory ? (
                        'Select Existing'
                      ) : (
                        <>
                          <span className="text-sm font-bold">+</span>
                          <span>Add New</span>
                        </>
                      )}
                    </button>
                  </div>
                  {isNewCategory ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter new category name"
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault(); // Prevent form submission
                            setIsNewCategory(false);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="px-3"
                        onClick={() => setIsNewCategory(false)}
                        title="Save Category"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      {/* Show current category even if not in fetched list yet */}
                      {newProduct.category && !categories.includes(newProduct.category) && (
                        <option value={newProduct.category}>{newProduct.category}</option>
                      )}
                      {categories.map((cat: string) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              {/* Product Photo Upload Section for Add Product */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="form-label mb-3">Product Photo (Optional)</label>
                <EntityImageUpload
                  entityId={null}
                  entityType="product"
                  entityName={newProduct.name}
                  imagePath={null}
                  previewUrl={tempPreviewUrl}
                  onFileSelect={(file) => {
                    setPendingImageFile(file);
                    setPendingImageUrl(null);
                    setTempPreviewUrl(URL.createObjectURL(file));
                  }}
                  onImageSelect={(url) => {
                    setPendingImageUrl(url);
                    setPendingImageFile(null);
                    setTempPreviewUrl(url);
                  }}
                  onPreviewClick={() => {
                    // Simply clear selection on preview click if needed, or implement a local preview modal
                    // For now loop back to clearing or show nothing special since it's just a preview
                  }}
                />
              </div>
              <Button type="submit" className="mt-4">
                Add Product
              </Button>
            </form>
          </Card>
        )
      }



      {/* Edit Product Form */}
      {
        editProduct && (
          <Card className="space-y-4 p-5 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Product</h2>
              <Button variant="ghost" onClick={() => setEditProduct(null)}>
                Close
              </Button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="form-label">Product Name</label>
                  <Input
                    value={editProduct.name}
                    onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">SKU</label>
                  <Input
                    value={editProduct.sku}
                    onChange={(e) => setEditProduct({ ...editProduct, sku: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="form-label whitespace-nowrap text-xs">Actual Price (Purchase)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editProduct.price}
                    onChange={(e) =>
                      setEditProduct({ ...editProduct, price: Number(e.target.value) })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="form-label whitespace-nowrap text-xs">Selling Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editProduct.selling_price ?? ''}
                    onChange={(e) =>
                      setEditProduct({ ...editProduct, selling_price: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div>
                  <label className="form-label whitespace-nowrap text-xs">Stock Quantity</label>
                  <Input
                    type="number"
                    min="0"
                    value={editProduct.stock_quantity}
                    onChange={(e) =>
                      setEditProduct({ ...editProduct, stock_quantity: Number(e.target.value) })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="form-label whitespace-nowrap text-xs">Supplier</label>
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
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="form-label">Category</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditNewCategory(!isEditNewCategory);
                        // Don't clear category immediately on edit so they can see what it was, 
                        // but if they switch to "Add New" maybe they want to keep it or clear it.
                        // Let's keep it to allow editing the name easily.
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                    >
                      {isEditNewCategory ? (
                        'Select Existing'
                      ) : (
                        <>
                          <span className="text-sm font-bold">+</span>
                          <span>Add New</span>
                        </>
                      )}
                    </button>
                  </div>
                  {isEditNewCategory ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter new category name"
                        value={editProduct.category || ''}
                        onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value })}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setIsEditNewCategory(false);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="px-3"
                        onClick={() => setIsEditNewCategory(false)}
                        title="Save Category"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={editProduct.category || ''}
                      onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      {/* Show current category even if not in fetched list yet */}
                      {editProduct.category && !categories.includes(editProduct.category) && (
                        <option value={editProduct.category}>{editProduct.category}</option>
                      )}
                      {categories.map((cat: string) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              {/* Product Photo Section */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="form-label mb-3">Product Photo</label>
                <EntityImageUpload
                  entityId={editProduct.id}
                  entityType="product"
                  entityName={editProduct.name}
                  imagePath={editProduct.image_path}
                  onImageChange={(newPath) => {
                    setEditProduct({ ...editProduct, image_path: newPath });
                    invalidateProducts();
                  }}
                />
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
                  <TableHead className="w-[60px] text-center font-bold text-black">Photo</TableHead>
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
                      {displayedProducts.indexOf(product) + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-center">{product.name}</TableCell>
                    <TableCell className="text-center">{product.sku}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium text-slate-700">
                        ₹{product.total_purchased_cost ? product.total_purchased_cost.toFixed(0) : (product.price * (product.initial_stock ?? 0)).toFixed(0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {product.total_sold_amount ? (
                        <span className="font-medium text-slate-700">
                          ₹{product.total_sold_amount.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-3 text-sm">
                        <span className="text-slate-700 font-medium">
                          <span className="text-xs text-slate-400">Stock:</span>{' '}
                          {product.total_purchased_quantity ?? product.stock_quantity}
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
                      {product.supplier_id ? supplierMap.get(product.supplier_id)?.name ?? '-' : '-'}
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
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <EntityThumbnail
                          entityId={product.id}
                          entityType="product"
                          imagePath={product.image_path}
                          size="sm"
                          onClick={(e) => {
                            e?.stopPropagation();
                            if (product.image_path) {
                              setPreviewProduct(product);
                            }
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {loading && !displayedProducts.length && (
              <div className="flex justify-center items-center h-40">
                <div className="text-slate-500">Loading products...</div>
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
          {(loading || isFetchingNextPage) && displayedProducts.length > 0 && (
            <div className="absolute inset-0 bg-white/50 z-20 pointer-events-none flex items-start justify-center pt-20">
              {/* Optional spinner */}
            </div>
          )}
        </Card>
      </div>
      <PDFPreviewDialog
        open={showPdfPreview}
        onOpenChange={setShowPdfPreview}
        url={pdfUrl}
        fileName={pdfFileName}
      />

      {/* Image Preview Modal */}
      {previewProduct && (
        <EntityImagePreviewModal
          open={!!previewProduct}
          onOpenChange={(open) => !open && setPreviewProduct(null)}
          entityId={previewProduct.id}
          entityType="product"
          entityName={previewProduct.name}
        />
      )}
    </div >
  );
}
