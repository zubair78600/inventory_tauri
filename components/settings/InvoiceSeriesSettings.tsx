'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '../ui/label';
import { settingsCommands } from '@/lib/tauri';
import { Save, Loader2, RotateCcw, AlertTriangle, Settings, ChevronDown, ChevronUp } from 'lucide-react';

interface InvoiceSeriesConfig {
    prefix: string;
    separator: string;
    padding: number;
    startNumber: number;
    resetRule: 'yearly' | 'monthly' | 'never';
    autoFy: boolean; // Auto Financial Year switch
}

const DEFAULT_CONFIG: InvoiceSeriesConfig = {
    prefix: 'INV',
    separator: '-',
    padding: 4,
    startNumber: 1,
    resetRule: 'yearly',
    autoFy: true,
};

export function InvoiceSeriesSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<InvoiceSeriesConfig>(DEFAULT_CONFIG);
    const [showCustomize, setShowCustomize] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const rawSettings = await settingsCommands.getAll();
            setConfig({
                prefix: rawSettings['invoice_prefix'] || DEFAULT_CONFIG.prefix,
                separator: rawSettings['invoice_separator'] || DEFAULT_CONFIG.separator,
                padding: parseInt(rawSettings['invoice_padding'] || String(DEFAULT_CONFIG.padding), 10),
                startNumber: parseInt(rawSettings['invoice_start_number'] || String(DEFAULT_CONFIG.startNumber), 10),
                resetRule: (rawSettings['invoice_reset_rule'] as any) || DEFAULT_CONFIG.resetRule,
                autoFy: rawSettings['invoice_auto_fy'] !== 'false', // Default to true if not set
            });
        } catch (err) {
            console.error('Failed to load invoice settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await settingsCommands.set('invoice_prefix', config.prefix);
            await settingsCommands.set('invoice_separator', config.separator);
            await settingsCommands.set('invoice_padding', config.padding.toString());
            await settingsCommands.set('invoice_start_number', config.startNumber.toString());
            await settingsCommands.set('invoice_reset_rule', config.resetRule);
            await settingsCommands.set('invoice_auto_fy', String(config.autoFy));

            // Simulate success delay for UX
            await new Promise(r => setTimeout(r, 500));
            alert('Invoice series settings saved successfully!');
        } catch (err) {
            console.error('Failed to save settings:', err);
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const currentFinancialYear = useMemo(() => {
        const today = new Date();
        const month = today.getMonth(); // 0-11
        const year = today.getFullYear();
        const shortYear = year % 100;

        // India FY: April (3) to March
        if (month >= 3) {
            return `${shortYear}-${shortYear + 1}`;
        } else {
            return `${shortYear - 1}-${shortYear}`;
        }
    }, []);

    const generatedPreviews = useMemo(() => {
        const examples = [];
        const fyPart = config.autoFy ? `${config.separator}${currentFinancialYear}` : '';

        for (let i = 0; i < 4; i++) {
            const num = config.startNumber + i;
            const numStr = num.toString().padStart(config.padding, '0');
            examples.push(`${config.prefix}${fyPart}${config.separator}${numStr}`);
        }
        return examples;
    }, [config, currentFinancialYear]);

    // Validation
    const totalLength = generatedPreviews[0].length;
    const isTooLong = totalLength > 16;

    if (loading) {
        return <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-600" /></div>;
    }

    return (
        <div className="">
            <Card className="p-4">
                {/* Header Compact */}
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold">
                            Invoice Series Config
                        </h2>
                        <p className="text-xs text-slate-500">
                            Configure your invoice numbering.
                        </p>
                    </div>
                    {/* Live Preview - Inline Compact */}
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Preview:</span>
                        <div className="font-mono text-sm font-bold text-primary">
                            {generatedPreviews[0]}
                        </div>
                        {isTooLong && (
                            <span className="text-[10px] text-red-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Max 16 chars!
                            </span>
                        )}
                    </div>
                </div>

                {/* SECTION 1: Standard Configuration - Compact Row */}
                <div className="flex flex-wrap gap-4 items-end mb-4 bg-blue-50/30 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-50 dark:border-blue-900/20">
                    <div className="w-[180px]">
                        <Label className="mb-1 block text-xs">Prefix</Label>
                        <div className="flex gap-2 items-center">
                            <Input
                                value={config.prefix}
                                onChange={(e) => setConfig({ ...config, prefix: e.target.value.toUpperCase() })}
                                placeholder="INV"
                                maxLength={6}
                                className="h-8 font-mono uppercase text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 h-8 rounded border w-fit">
                        <input
                            type="checkbox"
                            id="autoFy"
                            checked={config.autoFy}
                            onChange={(e) => setConfig({ ...config, autoFy: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="autoFy" className="cursor-pointer text-xs mb-0">Auto FY ({currentFinancialYear})</Label>
                    </div>

                    <div className="ml-auto flex items-center">
                        <button
                            onClick={() => setShowCustomize(!showCustomize)}
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors h-8"
                        >
                            <Settings className="w-3.5 h-3.5" />
                            {showCustomize ? 'Hide Advanced' : 'Advanced Options'}
                            {showCustomize ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                {/* SECTION 2: Custom Configuration - Compact Grid */}
                {showCustomize && (
                    <div className="grid grid-cols-4 gap-3 animate-in slide-in-from-top-2 fade-in duration-200 mb-4 pt-2 border-t border-dashed">
                        <div>
                            <Label className="mb-1 block text-xs">Separator</Label>
                            <select
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                value={config.separator}
                                onChange={(e) => setConfig({ ...config, separator: e.target.value })}
                            >
                                <option value="-">- (Dash)</option>
                                <option value="/">/ (Slash)</option>
                                <option value="_">_ (Underscore)</option>
                                <option value="">(None)</option>
                            </select>
                        </div>

                        <div>
                            <Label className="mb-1 block text-xs">Padding</Label>
                            <select
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                value={config.padding}
                                onChange={(e) => setConfig({ ...config, padding: parseInt(e.target.value) })}
                            >
                                <option value={1}>1</option>
                                <option value={2}>01</option>
                                <option value={3}>001</option>
                                <option value={4}>0001</option>
                                <option value={5}>00001</option>
                                <option value={6}>000001</option>
                            </select>
                        </div>

                        <div>
                            <Label className="mb-1 block text-xs">Reset</Label>
                            <select
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                value={config.resetRule}
                                onChange={(e) => setConfig({ ...config, resetRule: e.target.value as any })}
                            >
                                <option value="yearly">Yearly</option>
                                <option value="monthly">Monthly</option>
                                <option value="never">Never</option>
                            </select>
                        </div>

                        <div>
                            <Label className="mb-1 block text-xs">Start #</Label>
                            <Input
                                type="number"
                                min={1}
                                value={config.startNumber}
                                onChange={(e) => setConfig({ ...config, startNumber: parseInt(e.target.value) || 1 })}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t">
                    {!showCustomize && (
                        <div className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3" />
                            Changes affect new invoices only.
                        </div>
                    )}
                    <div className={`flex gap-2 ${showCustomize ? 'ml-auto' : ''}`}>
                        <Button variant="ghost" size="sm" onClick={() => setConfig(DEFAULT_CONFIG)} className="h-8 text-xs">
                            Reset
                        </Button>
                        <Button onClick={handleSave} disabled={saving || isTooLong} size="sm" className="bg-sky-600 hover:bg-sky-700 h-8 text-xs">
                            {saving ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Save className="w-3 h-3 mr-1.5" />}
                            Save
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
