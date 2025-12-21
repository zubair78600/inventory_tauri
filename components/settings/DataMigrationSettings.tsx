import { useState, useRef } from 'react';
import { Download, Upload, AlertCircle, CheckCircle, Loader2, FileText, ChevronDown, Eye, SkipForward, Search } from 'lucide-react';
import { save, open, ask } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

type EntityType = 'customer' | 'inventory' | 'supplier';

interface InsertedItem {
    id: number;
    name: string;
    identifier: string | null;
}

interface DuplicateItem {
    row_index: number;
    name: string;
    identifier: string | null;
}

interface ScanResult {
    total_rows: number;
    duplicate_count: number;
    new_count: number;
    duplicates: DuplicateItem[];
}

interface ImportStats {
    total: number;
    new: number;
    skipped: number;
    errors: number;
    details: string[];
    addedItems: InsertedItem[];
}

type ImportPhase = 'idle' | 'scanning' | 'scan_complete' | 'viewing_duplicates' | 'importing' | 'complete';

const ITEMS_PER_PAGE = 50;

export function DataMigrationSettings() {
    const [exporting, setExporting] = useState<EntityType | null>(null);
    const [importing, setImporting] = useState<EntityType | null>(null);
    const [phase, setPhase] = useState<ImportPhase>('idle');
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [importStats, setImportStats] = useState<ImportStats | null>(null);
    const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
    const [scanProgress, setScanProgress] = useState<{ current: number; total: number; duplicatesFound: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [visibleDuplicatesCount, setVisibleDuplicatesCount] = useState(ITEMS_PER_PAGE);
    const [visibleAddedCount, setVisibleAddedCount] = useState(ITEMS_PER_PAGE);
    const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = async (type: EntityType) => {
        setExporting(type);
        setError(null);
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const csvContent = await invoke<string>('export_csv', { entityType: type });

            const fileName = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
            const filePath = await save({
                defaultPath: fileName,
                filters: [{ name: 'CSV', extensions: ['csv'] }]
            });

            if (filePath) {
                await writeTextFile(filePath, csvContent);
                alert(`Successfully exported ${type} data!`);
            }
        } catch (err) {
            console.error('Export failed:', err);
            setError(`Failed to export ${type}: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setExporting(null);
        }
    };

    const resetState = () => {
        setPhase('idle');
        setScanResult(null);
        setImportStats(null);
        setImportProgress(null);
        setScanProgress(null);
        setError(null);
        setVisibleDuplicatesCount(ITEMS_PER_PAGE);
        setVisibleAddedCount(ITEMS_PER_PAGE);
        setParsedRows([]);
    };

    const handleImportClick = (type: EntityType) => {
        resetState();
        setImporting(type);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const parseCSV = (text: string): { headers: string[], rows: Record<string, string>[] } => {
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length === 0) throw new Error("File is empty");

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
            if (values.length !== headers.length) continue;

            const row: Record<string, string> = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            rows.push(row);
        }

        return { headers, rows };
    };

    const validateHeaders = (headers: string[], type: EntityType) => {
        // Mandatory columns for import
        const required: Record<EntityType, string[]> = {
            customer: ['name', 'phone'],
            inventory: ['name', 'sku', 'price', 'selling_price', 'initial_stock', 'stock_quantity'],
            supplier: ['name', 'contact_info']
        };

        const normalize = (s: string) => s.toLowerCase().replace(/_/g, '').replace(/ /g, '');
        const missing = required[type].filter(req =>
            !headers.some(h => normalize(h) === normalize(req))
        );

        if (missing.length > 0) {
            throw new Error(`Missing required columns: ${missing.join(', ')}`);
        }
        return true;
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !importing) return;

        try {
            setPhase('scanning');
            const text = await file.text();

            const { headers, rows } = parseCSV(text);
            validateHeaders(headers, importing);
            setParsedRows(rows);

            const total = rows.length;
            setScanProgress({ current: 0, total, duplicatesFound: 0 });

            // Scan in batches to show progress
            const { invoke } = await import('@tauri-apps/api/core');
            const SCAN_BATCH_SIZE = 100;
            let allDuplicates: DuplicateItem[] = [];
            let duplicateCount = 0;
            let newCount = 0;

            for (let i = 0; i < total; i += SCAN_BATCH_SIZE) {
                const batch = rows.slice(i, i + SCAN_BATCH_SIZE);

                const batchResult = await invoke<ScanResult>('scan_duplicates', {
                    entityType: importing,
                    data: batch
                });

                duplicateCount += batchResult.duplicate_count;
                newCount += batchResult.new_count;

                // Adjust row_index to be global
                const adjustedDuplicates = batchResult.duplicates.map(d => ({
                    ...d,
                    row_index: d.row_index + i
                }));
                allDuplicates.push(...adjustedDuplicates);

                setScanProgress({
                    current: Math.min(i + batch.length, total),
                    total,
                    duplicatesFound: duplicateCount
                });
            }

            setScanResult({
                total_rows: total,
                duplicate_count: duplicateCount,
                new_count: newCount,
                duplicates: allDuplicates
            });
            setScanProgress(null);
            setPhase('scan_complete');

        } catch (err) {
            console.error('Scan failed:', err);
            setError(err instanceof Error ? err.message : String(err));
            setScanProgress(null);
            setPhase('idle');
        }
    };

    const handleProceedWithImport = async () => {
        if (!importing || parsedRows.length === 0) return;

        setPhase('importing');

        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const BATCH_SIZE = 50;
            let processed = 0;
            let newCount = 0;
            let skippedCount = 0;
            let errorsCount = 0;
            let details: string[] = [];
            let allAddedItems: InsertedItem[] = [];
            const total = parsedRows.length;

            setImportProgress({ current: 0, total });

            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = parsedRows.slice(i, i + BATCH_SIZE);

                const result = await invoke<{
                    processed: number;
                    success: number;
                    errors: string[];
                    duplicate_found: boolean;
                    added_items: InsertedItem[];
                }>(
                    'import_csv_chunk',
                    { entityType: importing, data: batch }
                );

                processed += result.processed;
                newCount += result.success;
                skippedCount += (result.processed - result.success - result.errors.length);
                if (result.errors.length > 0) {
                    errorsCount += result.errors.length;
                    details.push(...result.errors);
                }
                if (result.added_items && result.added_items.length > 0) {
                    allAddedItems.push(...result.added_items);
                }

                setImportProgress({ current: Math.min(processed, total), total });
            }

            setImportStats({
                total,
                new: newCount,
                skipped: scanResult?.duplicate_count || 0,
                errors: errorsCount,
                details,
                addedItems: allAddedItems
            });
            setPhase('complete');
            setImportProgress(null);

        } catch (err) {
            console.error('Import failed:', err);
            setError(err instanceof Error ? err.message : String(err));
            setPhase('idle');
        }
    };

    const visibleDuplicates = scanResult?.duplicates.slice(0, visibleDuplicatesCount) || [];
    const hasMoreDuplicates = scanResult ? visibleDuplicatesCount < scanResult.duplicates.length : false;
    const visibleAddedItems = importStats?.addedItems.slice(0, visibleAddedCount) || [];
    const hasMoreAdded = importStats ? visibleAddedCount < importStats.addedItems.length : false;

    return (
        <div className="card space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Data Management</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Export data to CSV or import new records.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Export Section */}
                <div className="space-y-4">
                    <h3 className="text-md font-medium flex items-center gap-2">
                        <Download size={18} className="text-blue-600" />
                        Export Data
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        {(['customer', 'inventory', 'supplier'] as EntityType[]).map((type) => (
                            <button
                                key={type}
                                onClick={() => handleExport(type)}
                                disabled={exporting !== null || phase !== 'idle'}
                                className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                                        <FileText size={16} />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-medium capitalize">{type}</div>
                                        <div className="text-xs text-slate-500">Export to CSV</div>
                                    </div>
                                </div>
                                {exporting === type ? (
                                    <Loader2 size={18} className="animate-spin text-blue-600" />
                                ) : (
                                    <Download size={18} className="text-slate-400" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Import Section */}
                <div className="space-y-4">
                    <h3 className="text-md font-medium flex items-center gap-2">
                        <Upload size={18} className="text-green-600" />
                        Import Data
                    </h3>
                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => void handleFileChange(e)}
                    />
                    <div className="grid grid-cols-1 gap-3">
                        {(['customer', 'inventory', 'supplier'] as EntityType[]).map((type) => (
                            <button
                                key={type}
                                onClick={() => handleImportClick(type)}
                                disabled={phase !== 'idle'}
                                className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                                        <Upload size={16} />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-medium capitalize">{type}</div>
                                        <div className="text-xs text-slate-500">Import from CSV</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scanning Progress */}
            {phase === 'scanning' && scanProgress && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <Loader2 className="animate-spin text-blue-600" size={20} />
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-blue-900 dark:text-blue-100">Scanning for duplicates...</p>
                                <span className="text-sm text-blue-700 dark:text-blue-300">
                                    {scanProgress.current.toLocaleString()} / {scanProgress.total.toLocaleString()}
                                </span>
                            </div>
                            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${(scanProgress.current / Math.max(scanProgress.total, 1)) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-6 pt-1 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-600 dark:text-slate-400">Duplicates Found:</span>
                            <span className="font-bold text-amber-600">{scanProgress.duplicatesFound.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Scan Complete - Show Summary */}
            {phase === 'scan_complete' && scanResult && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-4">
                    <div className="flex items-start gap-3">
                        <Search className="text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-medium text-amber-900 dark:text-amber-100">Scan Complete</h4>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                Found <strong>{scanResult.duplicate_count.toLocaleString()}</strong> duplicates
                                and <strong>{scanResult.new_count.toLocaleString()}</strong> new items
                                out of <strong>{scanResult.total_rows.toLocaleString()}</strong> rows.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-amber-100 dark:border-amber-900/50">
                            <div className="text-2xl font-bold">{scanResult.total_rows.toLocaleString()}</div>
                            <div className="text-xs text-slate-500">Total Rows</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-amber-100 dark:border-amber-900/50">
                            <div className="text-2xl font-bold text-amber-600">{scanResult.duplicate_count.toLocaleString()}</div>
                            <div className="text-xs text-slate-500">Duplicates</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-amber-100 dark:border-amber-900/50">
                            <div className="text-2xl font-bold text-green-600">{scanResult.new_count.toLocaleString()}</div>
                            <div className="text-xs text-slate-500">New Items</div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        {scanResult.duplicate_count > 0 && (
                            <button
                                onClick={() => setPhase('viewing_duplicates')}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors font-medium"
                            >
                                <Eye size={18} />
                                View Duplicates
                            </button>
                        )}
                        <button
                            onClick={() => handleProceedWithImport()}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                            <SkipForward size={18} />
                            Skip Duplicates & Import
                        </button>
                    </div>
                    <button
                        onClick={resetState}
                        className="w-full py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                        Cancel Import
                    </button>
                </div>
            )}

            {/* Viewing Duplicates */}
            {phase === 'viewing_duplicates' && scanResult && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium">Duplicate Items ({scanResult.duplicate_count.toLocaleString()})</h4>
                        <button
                            onClick={() => setPhase('scan_complete')}
                            className="text-sm text-primary hover:underline"
                        >
                            Back to Summary
                        </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                                <tr>
                                    <th className="text-left p-2 font-medium text-slate-600 dark:text-slate-400">Row</th>
                                    <th className="text-left p-2 font-medium text-slate-600 dark:text-slate-400">Name</th>
                                    <th className="text-left p-2 font-medium text-slate-600 dark:text-slate-400">
                                        {importing === 'inventory' ? 'SKU' : 'Phone/Contact'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {visibleDuplicates.map((item, i) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                        <td className="p-2 text-slate-500">{item.row_index}</td>
                                        <td className="p-2 font-medium">{item.name}</td>
                                        <td className="p-2 text-slate-600 dark:text-slate-400">{item.identifier || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {hasMoreDuplicates && (
                            <div className="p-2 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    onClick={() => setVisibleDuplicatesCount(prev => prev + ITEMS_PER_PAGE)}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-primary hover:bg-slate-50 dark:hover:bg-slate-900 rounded transition-colors"
                                >
                                    <ChevronDown size={16} />
                                    Load More ({(scanResult.duplicate_count - visibleDuplicatesCount).toLocaleString()} remaining)
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => handleProceedWithImport()}
                            className="flex-1 py-2.5 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                            Skip All Duplicates & Import New Only
                        </button>
                    </div>
                </div>
            )}

            {/* Import Progress */}
            {phase === 'importing' && importProgress && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Importing {importing}...</span>
                        <span className="text-sm text-slate-500">{importProgress.current.toLocaleString()} / {importProgress.total.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                        <div
                            className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${(importProgress.current / Math.max(importProgress.total, 1)) * 100}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="text-red-600 dark:text-red-400 mt-0.5" size={18} />
                    <div className="text-sm text-red-700 dark:text-red-300">
                        <p className="font-medium">Error</p>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {/* Import Complete */}
            {phase === 'complete' && importStats && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
                        <h4 className="font-medium text-green-900 dark:text-green-100">Import Complete</h4>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-center">
                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-green-100 dark:border-green-900/50">
                            <div className="text-xl font-bold">{importStats.total.toLocaleString()}</div>
                            <div className="text-xs text-slate-500">Total Rows</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-green-100 dark:border-green-900/50">
                            <div className="text-xl font-bold text-green-600">{importStats.new.toLocaleString()}</div>
                            <div className="text-xs text-slate-500">New Added</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-green-100 dark:border-green-900/50">
                            <div className="text-xl font-bold text-amber-600">{importStats.skipped.toLocaleString()}</div>
                            <div className="text-xs text-slate-500">Skipped</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-green-100 dark:border-green-900/50">
                            <div className={`text-xl font-bold ${importStats.errors > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                {importStats.errors}
                            </div>
                            <div className="text-xs text-slate-500">Errors</div>
                        </div>
                    </div>

                    {importStats.details.length > 0 && (
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Error Details:</p>
                            <div className="max-h-24 overflow-y-auto text-xs bg-white dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800 font-mono text-red-600 space-y-1">
                                {importStats.details.map((msg, i) => (
                                    <div key={i}>{msg}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {importStats.addedItems.length > 0 && (
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Newly Added Items ({importStats.addedItems.length.toLocaleString()}):
                            </p>
                            <div className="max-h-64 overflow-y-auto bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                                        <tr>
                                            <th className="text-left p-2 font-medium text-slate-600 dark:text-slate-400">ID</th>
                                            <th className="text-left p-2 font-medium text-slate-600 dark:text-slate-400">Name</th>
                                            <th className="text-left p-2 font-medium text-slate-600 dark:text-slate-400">
                                                {importing === 'inventory' ? 'SKU' : 'Phone/Contact'}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {visibleAddedItems.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                <td className="p-2 text-slate-500">{item.id}</td>
                                                <td className="p-2 font-medium">{item.name}</td>
                                                <td className="p-2 text-slate-600 dark:text-slate-400">{item.identifier || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {hasMoreAdded && (
                                    <div className="p-2 border-t border-slate-200 dark:border-slate-800">
                                        <button
                                            onClick={() => setVisibleAddedCount(prev => prev + ITEMS_PER_PAGE)}
                                            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-primary hover:bg-slate-50 dark:hover:bg-slate-900 rounded transition-colors"
                                        >
                                            <ChevronDown size={16} />
                                            Load More ({(importStats.addedItems.length - visibleAddedCount).toLocaleString()} remaining)
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={resetState}
                        className="w-full py-2.5 px-4 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
                    >
                        Done
                    </button>
                </div>
            )}
        </div>
    );
}
