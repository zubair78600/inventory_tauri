import { useState, useEffect } from 'react';
import { X, Search, GripVertical, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Product } from '@/types';
import { productCommands } from '@/lib/tauri';
import { EntityThumbnail } from '@/components/shared/EntityThumbnail';
import { Reorder } from 'framer-motion';

interface QuickAddSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentIds: number[];
    onSave: (newIds: number[]) => void;
}

export function QuickAddSettingsModal({ isOpen, onClose, currentIds, onSave }: QuickAddSettingsModalProps) {
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);

    // Search & Suggestions State
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    // Top Selling State
    const [viewMode, setViewMode] = useState<'search' | 'top-selling'>('search');
    const [topSellingPage, setTopSellingPage] = useState(1);
    const [topSellingProducts, setTopSellingProducts] = useState<Product[]>([]);
    const [hasMoreTopSelling, setHasMoreTopSelling] = useState(true);

    // Fetch full product objects for the current IDs on mount
    useEffect(() => {
        if (isOpen) {
            void fetchCurrentProducts();
            // Resets
            setSearchQuery('');
            setSearchResults([]);
            setViewMode('search');
            setTopSellingPage(1);
            setTopSellingProducts([]);
        }
    }, [isOpen, currentIds]);

    const fetchCurrentProducts = async () => {
        setLoading(true);
        try {
            const products = await productCommands.getByIds(currentIds);
            setSelectedProducts(products);
        } catch (err) {
            console.error('Failed to load selected products', err);
        } finally {
            setLoading(false);
        }
    };

    // Search logic
    useEffect(() => {
        if (searchQuery.trim().length === 0) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const res = await productCommands.getAll(1, 10, searchQuery);
                setSearchResults(res.items);
            } catch (err) {
                console.error(err);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchTopSelling = async (page: number) => {
        try {
            const limit = 20;
            const newProducts = await productCommands.getTopSelling(limit, page);

            if (page === 1) {
                setTopSellingProducts(newProducts);
            } else {
                setTopSellingProducts(prev => [...prev, ...newProducts]);
            }

            setHasMoreTopSelling(newProducts.length === limit);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSwitchToTopSelling = () => {
        setViewMode('top-selling');
        setSearchQuery('');
        setTopSellingPage(1);
        void fetchTopSelling(1);
    };

    const handleLoadMoreTopSelling = () => {
        const nextPage = topSellingPage + 1;
        setTopSellingPage(nextPage);
        void fetchTopSelling(nextPage);
    };

    const handleBackToSearch = () => {
        setViewMode('search');
    };

    const handleAdd = (product: Product) => {
        if (selectedProducts.find(p => p.id === product.id)) return;
        setSelectedProducts([...selectedProducts, product]);
        // Don't clear search query to allow adding multiple
    };

    const handleRemove = (id: number) => {
        setSelectedProducts(selectedProducts.filter(p => p.id !== id));
    };

    const handleSave = async () => {
        const ids = selectedProducts.map(p => p.id);
        onSave(ids);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-xl font-bold">Customize Quick Add List</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-6">
                    {/* Top Section: Search or Top Selling Header */}
                    <div className="space-y-3">
                        {viewMode === 'search' ? (
                            <div className="flex items-center justify-between gap-4">
                                <div className="relative group w-[30%]">
                                    {!searchQuery && (
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none group-focus-within:hidden transition-opacity" />
                                    )}
                                    <input
                                        className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg py-2 text-sm shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-primary/50 transition-all ${searchQuery ? 'pl-3' : 'pl-10'}`}
                                        placeholder="Search products..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <button
                                    onClick={handleSwitchToTopSelling}
                                    className="text-sm font-medium text-primary hover:text-primary/80 hover:underline flex items-center gap-1"
                                >
                                    Browse Top Selling Products <ArrowRight size={14} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <h3 className="font-semibold text-lg">Top Selling Products</h3>
                                <button
                                    onClick={handleBackToSearch}
                                    className="text-sm text-slate-500 hover:text-slate-800"
                                >
                                    Back to Search
                                </button>
                            </div>
                        )}

                        {/* Results Area */}
                        {(viewMode === 'top-selling' || searchResults.length > 0) && (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm max-h-56 overflow-y-auto">
                                {(viewMode === 'top-selling' ? topSellingProducts : searchResults).map((p, index) => {
                                    const isSelected = selectedProducts.some(sp => sp.id === p.id);
                                    return (
                                        <button
                                            key={p.id}
                                            className="flex items-center w-full px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-left border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors disabled:opacity-50"
                                            onClick={() => handleAdd(p)}
                                            disabled={isSelected}
                                        >
                                            {viewMode === 'top-selling' && (
                                                <span className="w-6 text-center text-xs font-bold text-slate-400 mr-2">#{index + 1}</span>
                                            )}

                                            <EntityThumbnail entityId={p.id} entityType="product" imagePath={p.image_path} size="sm" className="mr-3" />

                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate text-sm text-slate-900 dark:text-slate-100">
                                                    {p.name}
                                                    {/* Show sold count in bracket for search results too, as requested */}
                                                    {viewMode === 'search' && p.total_sold !== undefined && p.total_sold !== null && (
                                                        <span className="ml-2 text-xs text-slate-400 font-normal">(Sold: {p.total_sold})</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                    <span>SKU: {p.sku}</span>
                                                    {/* Show badge for top selling view, or if significant sales */}
                                                    {viewMode === 'top-selling' && (
                                                        <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                                                            Sold: {p.total_sold ?? 0}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {isSelected ? (
                                                <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">Added</span>
                                            ) : (
                                                <div className="h-7 w-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600">
                                                    <Plus size={14} />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}

                                {viewMode === 'top-selling' && hasMoreTopSelling && (
                                    <button
                                        onClick={handleLoadMoreTopSelling}
                                        className="w-full py-2 text-sm text-center text-primary font-medium hover:bg-slate-50 transition-colors"
                                    >
                                        Load More Results...
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300">
                            Your Selection ({selectedProducts.length})
                        </h3>
                    </div>

                    {/* Draggable Selection List */}
                    <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl p-1 bg-slate-50/50">
                        {loading ? (
                            <div className="p-8 text-center text-slate-500">Loading...</div>
                        ) : selectedProducts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                <Search size={32} className="opacity-20" />
                                <p>No products selected</p>
                                <button onClick={handleSwitchToTopSelling} className="text-primary text-sm hover:underline">
                                    Browse Top Sellers
                                </button>
                            </div>
                        ) : (
                            <Reorder.Group
                                axis="y"
                                values={selectedProducts}
                                onReorder={setSelectedProducts}
                                className="space-y-1"
                                layoutScroll
                            >
                                {selectedProducts.map((p, index) => (
                                    <Reorder.Item
                                        key={p.id}
                                        value={p}
                                        className="flex items-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm group cursor-grab active:cursor-grabbing hover:border-primary/30 transition-colors"
                                        whileDrag={{ scale: 1.02, boxShadow: "0 8px 20px rgba(0,0,0,0.1)", zIndex: 10 }}
                                    >
                                        <div className="mr-3 text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing p-1 transition-colors">
                                            <GripVertical size={20} />
                                        </div>
                                        <span className="w-6 flex-none text-center font-mono text-slate-400 text-sm mr-2 select-none">
                                            {index + 1}
                                        </span>
                                        <EntityThumbnail entityId={p.id} entityType="product" imagePath={p.image_path} size="sm" className="mr-3 pointer-events-none" />
                                        <div className="flex-1 min-w-0 select-none">
                                            <div className="font-medium truncate text-sm text-slate-900">{p.name}</div>
                                            <div className="text-xs text-slate-500">STOCK: {p.stock_quantity}</div>
                                        </div>
                                        <button
                                            onClick={() => handleRemove(p.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ml-2 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            title="Remove"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </Reorder.Item>
                                ))}
                            </Reorder.Group>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-3 bg-slate-50/50 rounded-b-xl">
                    <button onClick={onClose} className="btn btn-ghost">Cancel</button>
                    <button onClick={handleSave} className="btn btn-primary px-8">Save List</button>
                </div>
            </div>
        </div>
    );
}
