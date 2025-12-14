import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Mail, MapPin, ChevronDown, ChevronUp, Truck } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SupplierData {
    id?: number;
    name: string;
    contact_info?: string;
    email?: string;
    address?: string;
    state?: string;
    district?: string;
    town?: string;
    total_products?: number;
    total_stock?: number;
    stock_value?: number;
    pending_amount?: number;
    image_path?: string;
}

export function SupplierCard({ data }: { data: SupplierData }) {
    const [showFullDetails, setShowFullDetails] = useState(false);

    if (!data.name) return null;

    return (
        <Card className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-4">
            {/* Header Section with Gradient Background */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                        <Avatar className="h-16 w-16 border-2 border-white dark:border-slate-800 shadow-sm">
                            <AvatarImage src={data.image_path} />
                            <AvatarFallback className="bg-emerald-100 text-emerald-600 font-bold text-xl">
                                {data.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{data.name}</h3>
                            <div className="flex flex-col gap-1 mt-1 text-sm text-slate-600 dark:text-slate-400">
                                {data.contact_info && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-3.5 w-3.5" />
                                        <span>{data.contact_info}</span>
                                    </div>
                                )}
                                {data.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-3.5 w-3.5" />
                                        <span>{data.email}</span>
                                    </div>
                                )}
                                {(data.address || data.town) && (
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span>
                                            {[data.address, data.town, data.district].filter(Boolean).join(", ")}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/60 dark:bg-slate-800/60">
                        <Truck className="h-8 w-8 text-emerald-500" />
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
                <div className="p-4 text-center">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Products</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {data.total_products ?? 0}
                    </div>
                </div>
                <div className="p-4 text-center">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Stock</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {data.total_stock ?? 0}
                    </div>
                </div>
                <div className="p-4 text-center">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Stock Value</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        ₹{data.stock_value?.toLocaleString() ?? '0'}
                    </div>
                </div>
                <div className="p-4 text-center">
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pending Amount</div>
                    <div className="text-lg font-bold text-red-600 dark:text-red-500 mt-0.5">
                        ₹{Math.abs(data.pending_amount ?? 0).toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Expandable Details */}
            <div className="bg-slate-50 dark:bg-slate-950/50">
                <button
                    onClick={() => setShowFullDetails(!showFullDetails)}
                    className="w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                    {showFullDetails ? (
                        <>Hide Details <ChevronUp className="h-3 w-3" /></>
                    ) : (
                        <>Show Full Details <ChevronDown className="h-3 w-3" /></>
                    )}
                </button>
            </div>

            <AnimatePresence>
                {showFullDetails && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 grid gap-4 text-sm bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800">
                            {data.state && (
                                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800 last:border-0">
                                    <span className="text-slate-500">State</span>
                                    <span className="font-medium">{data.state}</span>
                                </div>
                            )}
                            {data.district && (
                                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800 last:border-0">
                                    <span className="text-slate-500">District</span>
                                    <span className="font-medium">{data.district}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
