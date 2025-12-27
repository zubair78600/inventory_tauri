import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntityThumbnail } from "@/components/shared/EntityThumbnail";
import { ShoppingCart } from "lucide-react";
import { Product } from "@/types/index";

interface ProductDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    onAddToCart: (product: Product) => void;
}

export function ProductDetailsDialog({ isOpen, onClose, product, onAddToCart }: ProductDetailsDialogProps) {
    if (!product) return null;

    const price = product.selling_price || product.price || 0;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0 sm:rounded-2xl border-0 !bg-white dark:!bg-slate-900">
                <div className="flex flex-col md:flex-row h-full">
                    {/* Left Side - Large Image */}
                    <div className="w-full md:w-1/2 bg-slate-100 dark:bg-slate-800/50 p-6 flex items-center justify-center relative min-h-[300px]">
                        <EntityThumbnail
                            entityId={product.id}
                            entityType="product"
                            imagePath={product.image_path}
                            className="w-full h-full object-contain max-h-[350px] mix-blend-multiply dark:mix-blend-normal rounded-lg shadow-sm"
                            size="lg"
                        />
                        {/* Stock Badge */}
                        <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${product.stock_quantity > 0
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                            {product.stock_quantity > 0 ? `${product.stock_quantity} in Stock` : 'Out of Stock'}
                        </div>
                    </div>

                    {/* Right Side - Details */}
                    <div className="w-full md:w-1/2 p-8 flex flex-col justify-between">
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        {product.category && (
                                            <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                                                {product.category}
                                            </span>
                                        )}
                                        <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                            {product.name}
                                        </DialogTitle>
                                    </div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                        ₹{price.toFixed(0)}
                                    </div>
                                </div>
                                <p className="text-sm text-slate-500 font-mono mt-2">SKU: {product.sku}</p>
                            </div>

                            {product.description ? (
                                <div className="prose prose-sm prose-slate dark:prose-invert">
                                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                        {product.description}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-slate-400 italic text-sm">No description available for this product.</p>
                            )}
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => {
                                    onAddToCart(product);
                                    onClose();
                                }}
                                className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all duration-200"
                            >
                                <ShoppingCart className="w-5 h-5" />
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
