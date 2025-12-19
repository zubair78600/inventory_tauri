import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Phone, Mail, MapPin, Home, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CustomerData {
    id?: number;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    state?: string;
    district?: string;
    town?: string;
    total_spent?: number;
    total_invoices?: number;
    total_products?: number;
    last_billed?: string;
    current_credit?: number;
    credit_given?: number;
    credit_repaid?: number;
    image_path?: string;
}

export function CustomerCard({ data }: { data: CustomerData }) {
    const [showFullDetails, setShowFullDetails] = useState(false);

    // Initial validation - if we don't have at least a name, don't render this specific card
    if (!data.name) return null;

    return (
        <Card className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Header Section with Gradient Background */}
            <div className="bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/30 dark:to-indigo-950/30 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                        <Avatar className="h-16 w-16 border-2 border-white dark:border-slate-800 shadow-sm">
                            <AvatarImage src={data.image_path} />
                            <AvatarFallback className="bg-sky-100 text-sky-600 font-bold text-xl">
                                {data.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{data.name}</h3>
                            <div className="flex flex-col gap-1 mt-1 text-sm text-slate-600 dark:text-slate-400">
                                {data.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-3.5 w-3.5" />
                                        <span>{data.phone}</span>
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
                </div>
            </div>

            {/* Stats Grid - Responsive: 2 cols on small, 4 on larger */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
                <div className="p-3 sm:p-4 text-center">
                    <div className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide">Total Spent</div>
                    <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                        ₹{data.total_spent?.toLocaleString() ?? '0'}
                    </div>
                </div>
                <div className="p-3 sm:p-4 text-center">
                    <div className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide">Invoices</div>
                    <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {data.total_invoices ?? 0}
                    </div>
                </div>
                <div className="p-3 sm:p-4 text-center">
                    <div className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide">Last Billed</div>
                    <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                        {data.last_billed ? new Date(data.last_billed).toLocaleDateString() : 'Never'}
                    </div>
                </div>
                <div className="p-3 sm:p-4 text-center">
                    <div className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide">Current Credit</div>
                    {data.credit_given !== undefined ? (
                        <div className="mt-1 space-y-0.5 text-[10px] sm:text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Given:</span>
                                <span className="font-bold text-amber-500">₹{data.credit_given?.toLocaleString() ?? '0'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Repaid:</span>
                                <span className="font-bold text-emerald-500">₹{data.credit_repaid?.toLocaleString() ?? '0'}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-0.5">
                                <span className="text-slate-600 font-medium">Pending:</span>
                                <span className="font-bold text-slate-900 dark:text-slate-100">₹{Math.max(0, (data.credit_given ?? 0) - (data.credit_repaid ?? 0)).toLocaleString()}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-500 mt-0.5">
                            ₹{data.current_credit?.toLocaleString() ?? '0'}
                        </div>
                    )}
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
                            {data.last_billed && (
                                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800 last:border-0">
                                    <span className="text-slate-500">Last Billed</span>
                                    <span className="font-medium">{new Date(data.last_billed).toLocaleDateString()}</span>
                                </div>
                            )}
                            {data.total_products !== undefined && (
                                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800 last:border-0">
                                    <span className="text-slate-500">Total Products Bought</span>
                                    <span className="font-medium">{data.total_products} items</span>
                                </div>
                            )}
                            {data.state && (
                                <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800 last:border-0">
                                    <span className="text-slate-500">State</span>
                                    <span className="font-medium">{data.state}</span>
                                </div>
                            )}
                            {/* Add more fields here as needed */}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
