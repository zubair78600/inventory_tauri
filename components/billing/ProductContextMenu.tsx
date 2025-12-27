import { Eye, ShoppingCart } from "lucide-react";

interface ProductContextMenuProps {
    position: { x: number; y: number } | null;
    onClose: () => void;
    onViewDetails: () => void;
    onAddToCart: () => void;
}

export function ProductContextMenu({ position, onClose, onViewDetails, onAddToCart }: ProductContextMenuProps) {
    if (!position) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
                onContextMenu={(e) => { e.preventDefault(); onClose(); }}
            />
            <div
                className="fixed z-50 min-w-[160px] bg-slate-800 text-white rounded-lg shadow-xl border border-slate-700 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100"
                style={{ top: position.y, left: position.x }}
            >
                <button
                    onClick={() => { onViewDetails(); onClose(); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 transition-colors"
                >
                    <Eye className="w-4 h-4 text-sky-400" />
                    View Details
                </button>
                <div className="h-px bg-slate-700 my-1 mx-2" />
                <button
                    onClick={() => { onAddToCart(); onClose(); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 transition-colors"
                >
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    Add to Cart
                </button>
            </div>
        </>
    );
}
