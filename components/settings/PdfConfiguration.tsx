'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { generateInvoicePDF, clearSettingsCache } from '../../lib/pdf-generator';
import { settingsCommands, imageCommands } from '@/lib/tauri';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { Save, Loader2, RotateCcw, ZoomIn, ZoomOut, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface InvoiceSettings {
    company_name: string;
    company_address: string;
    company_phone: string;
    company_email: string;
    company_comments: string;
    logo_path: string | null;
    logo_width: number;
    logo_x: number;
    logo_y: number;
    header_x: number;
    header_y: number;
    font_size_header: number;
    font_size_body: number;
    header_align: 'left' | 'center' | 'right';
}

// Default settings matching pdf-generator.ts defaults
const DEFAULT_SETTINGS: InvoiceSettings = {
    company_name: 'Inventory System',
    company_address: '123 Business Street, Tech City, 560001',
    company_phone: '+91 98765 43210',
    company_email: 'support@inventorysystem.com',
    company_comments: '',
    logo_path: null,
    logo_width: 30,
    logo_x: 20,
    logo_y: 20,
    header_x: 14, // Left margin - matches where company info appears in actual PDF
    header_y: 50, // Below logo area
    font_size_header: 16,
    font_size_body: 10,
    header_align: 'left',
};

// A4 page dimensions in mm (jsPDF default)
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

export function PdfConfiguration() {
    const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [zoom, setZoom] = useState(2); // pixels per mm

    const [dragging, setDragging] = useState<'logo' | 'header' | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });

    const [picturesDir, setPicturesDir] = useState<string>('');
    const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
    const [logoAspect, setLogoAspect] = useState(1); // height/width ratio

    useEffect(() => {
        loadSettings();
        imageCommands.getPicturesDirectory().then(setPicturesDir).catch(console.error);
    }, []);

    // Load logo as base64
    useEffect(() => {
        const loadLogo = async () => {
            if (settings.logo_path && picturesDir) {
                try {
                    const fullPath = `${picturesDir}/${settings.logo_path}`;
                    const fileData = await readFile(fullPath);
                    const base64 = btoa(
                        fileData.reduce((data, byte) => data + String.fromCharCode(byte), '')
                    );
                    const ext = settings.logo_path.split('.').pop()?.toLowerCase() || 'png';
                    const dataUrl = `data:image/${ext};base64,${base64}`;

                    // Get aspect ratio
                    const img = new Image();
                    img.onload = () => {
                        setLogoAspect(img.height / img.width);
                        setLogoDataUrl(dataUrl);
                    };
                    img.src = dataUrl;
                } catch (err) {
                    console.error('Failed to load logo preview:', err);
                    setLogoDataUrl(null);
                }
            } else {
                setLogoDataUrl(null);
            }
        };
        loadLogo();
    }, [settings.logo_path, picturesDir]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const rawSettings = await settingsCommands.getAll();

            setSettings({
                company_name: rawSettings['invoice_company_name'] || DEFAULT_SETTINGS.company_name,
                company_address: rawSettings['invoice_company_address'] || DEFAULT_SETTINGS.company_address,
                company_phone: rawSettings['invoice_company_phone'] || DEFAULT_SETTINGS.company_phone,
                company_email: rawSettings['invoice_company_email'] || DEFAULT_SETTINGS.company_email,
                company_comments: rawSettings['invoice_company_comments'] || DEFAULT_SETTINGS.company_comments,
                logo_path: rawSettings['invoice_logo_path'] || null,
                logo_width: rawSettings['invoice_logo_width'] !== undefined ? Number(rawSettings['invoice_logo_width']) : DEFAULT_SETTINGS.logo_width,
                logo_x: rawSettings['invoice_logo_x'] !== undefined ? Number(rawSettings['invoice_logo_x']) : DEFAULT_SETTINGS.logo_x,
                logo_y: rawSettings['invoice_logo_y'] !== undefined ? Number(rawSettings['invoice_logo_y']) : DEFAULT_SETTINGS.logo_y,
                header_x: rawSettings['invoice_header_x'] !== undefined ? Number(rawSettings['invoice_header_x']) : DEFAULT_SETTINGS.header_x,
                header_y: rawSettings['invoice_header_y'] !== undefined ? Number(rawSettings['invoice_header_y']) : DEFAULT_SETTINGS.header_y,
                font_size_header: rawSettings['invoice_font_size_header'] !== undefined ? Number(rawSettings['invoice_font_size_header']) : DEFAULT_SETTINGS.font_size_header,
                font_size_body: rawSettings['invoice_font_size_body'] !== undefined ? Number(rawSettings['invoice_font_size_body']) : DEFAULT_SETTINGS.font_size_body,
                header_align: (rawSettings['invoice_header_align'] as any) || DEFAULT_SETTINGS.header_align,
            });
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await settingsCommands.set('invoice_company_name', settings.company_name);
            await settingsCommands.set('invoice_company_address', settings.company_address);
            await settingsCommands.set('invoice_company_phone', settings.company_phone);
            await settingsCommands.set('invoice_company_email', settings.company_email);
            await settingsCommands.set('invoice_company_comments', settings.company_comments);
            if (settings.logo_path) await settingsCommands.set('invoice_logo_path', settings.logo_path);
            await settingsCommands.set('invoice_logo_width', settings.logo_width.toString());
            await settingsCommands.set('invoice_logo_x', settings.logo_x.toString());
            await settingsCommands.set('invoice_logo_y', settings.logo_y.toString());
            await settingsCommands.set('invoice_header_x', settings.header_x.toString());
            await settingsCommands.set('invoice_header_y', settings.header_y.toString());
            await settingsCommands.set('invoice_font_size_header', settings.font_size_header.toString());
            await settingsCommands.set('invoice_font_size_body', settings.font_size_body.toString());
            await settingsCommands.set('invoice_header_align', settings.header_align);

            // Clear the cache so next PDF generation fetches new settings
            clearSettingsCache();

            alert('PDF Settings saved successfully!');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (confirm('Reset to default layout settings?')) {
            setSettings(DEFAULT_SETTINGS);
        }
    };

    const handleDragStart = (e: React.PointerEvent, type: 'logo' | 'header') => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(type);
        setDragStart({ x: e.clientX, y: e.clientY });
        setInitialPos({
            x: type === 'logo' ? settings.logo_x : settings.header_x,
            y: type === 'logo' ? settings.logo_y : settings.header_y
        });
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handleDragMove = (e: React.PointerEvent) => {
        if (!dragging) return;
        e.preventDefault();

        // Convert pixel delta to mm
        const dx = (e.clientX - dragStart.x) / zoom;
        const dy = (e.clientY - dragStart.y) / zoom;

        let newX = Math.round(initialPos.x + dx);
        let newY = Math.round(initialPos.y + dy);

        // Constrain to page bounds
        newX = Math.max(0, Math.min(newX, PAGE_WIDTH - 20));
        newY = Math.max(0, Math.min(newY, PAGE_HEIGHT - 20));

        if (dragging === 'logo') {
            setSettings(s => ({ ...s, logo_x: newX, logo_y: newY }));
        } else {
            setSettings(s => ({ ...s, header_x: newX, header_y: newY }));
        }
    };

    const handleDragEnd = (e: React.PointerEvent) => {
        setDragging(null);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    if (loading) {
        return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-600" /></div>;
    }

    // Calculate positions matching pdf-generator.ts logic exactly
    const logoHeight = settings.logo_width * logoAspect;
    const safeHeaderY = Math.max(settings.header_y, 10);
    // Line Y: only based on header text position, logo is now independent
    const lastTextOffset = settings.company_comments ? 21 : 16;
    const addressEndY = safeHeaderY + lastTextOffset;
    const lineY = addressEndY + 6; // Fixed position - logo doesn't affect this

    // Content starts at lineY + 6 (20px gap)
    const startY = lineY + 6;

    // mm to pixels
    const mm = (val: number) => val * zoom;
    // pt to mm (jsPDF uses pt for fonts, 1pt = 0.352778mm)
    const ptToMm = (pt: number) => pt * 0.352778;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-6 h-[calc(100vh-200px)]">
            {/* Preview Area */}
            <div className="bg-slate-300 dark:bg-slate-800 rounded-lg border overflow-auto relative">
                {/* Zoom Controls */}
                <div className="sticky top-2 left-2 z-20 inline-flex bg-white dark:bg-slate-900 rounded-lg shadow border p-1 gap-1 ml-2 mt-2">
                    <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(z - 0.5, 1))}>
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="px-2 py-1 text-sm font-medium min-w-[50px] text-center">{Math.round(zoom * 50)}%</span>
                    <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(z + 0.5, 4))}>
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                </div>

                {/* A4 Page Preview */}
                <div className="flex justify-center p-6 pt-2">
                    <div
                        className="bg-white shadow-2xl relative"
                        style={{
                            width: mm(PAGE_WIDTH),
                            height: mm(PAGE_HEIGHT),
                            fontFamily: 'Helvetica, Arial, sans-serif',
                        }}
                    >
                        {/* === PAGE BORDER (5mm padding) === */}
                        <div
                            className="absolute pointer-events-none"
                            style={{
                                left: mm(5),
                                top: mm(5),
                                right: mm(5),
                                bottom: mm(5),
                                border: '1px solid rgb(200, 200, 200)',
                            }}
                        />
                        {/* === LOGO === */}
                        <div
                            className="absolute cursor-move border-2 border-transparent hover:border-blue-400 transition-colors"
                            style={{
                                left: mm(settings.logo_x),
                                top: mm(settings.logo_y),
                                width: mm(settings.logo_width),
                                height: logoDataUrl ? mm(logoHeight) : mm(settings.logo_width),
                                touchAction: 'none',
                            }}
                            onPointerDown={(e) => handleDragStart(e, 'logo')}
                            onPointerMove={handleDragMove}
                            onPointerUp={handleDragEnd}
                        >
                            {logoDataUrl ? (
                                <img src={logoDataUrl} alt="Logo" className="w-full h-full object-contain pointer-events-none" />
                            ) : (
                                <div className="w-full h-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                                    Logo
                                </div>
                            )}
                        </div>

                        {/* === INVOICE TITLE (fixed top-right) - REMOVED per user request === */}
                        {/* <div
                            className="absolute"
                            style={{
                                right: mm(14),
                                top: mm(20),
                                fontSize: mm(ptToMm(16)),
                                fontWeight: 'bold',
                                color: '#000',
                            }}
                        >
                            INVOICE
                        </div> */}

                        {/* Company Details (draggable) */}
                        {/* Note: In jsPDF, text Y is baseline position, so we render from safeHeaderY */}
                        <div
                            className="absolute cursor-move border-2 border-transparent hover:border-blue-400 transition-colors"
                            style={{
                                left: mm(settings.header_x),
                                top: mm(safeHeaderY - ptToMm(settings.font_size_header) * 0.8), // Adjust for baseline
                                touchAction: 'none',
                                textAlign: settings.header_align,
                                minWidth: mm(60), // Ensure enough width for alignment to be visible if dragging small box
                                whiteSpace: 'nowrap',
                                transform: settings.header_align === 'center' ? 'translateX(-50%)' : settings.header_align === 'right' ? 'translateX(-100%)' : 'none',
                            }}
                            onPointerDown={(e) => handleDragStart(e, 'header')}
                            onPointerMove={handleDragMove}
                            onPointerUp={handleDragEnd}
                        >
                            {/* Company Name */}
                            <div style={{
                                fontSize: mm(ptToMm(settings.font_size_header)),
                                fontWeight: 'bold',
                                color: 'rgb(40, 40, 40)',
                            }}>
                                {settings.company_name}
                            </div>
                            {/* Company Details - spaced 5mm roughly between baselines.
                                In PDF: startY, startY+6, startY+11, startY+16 => 6mm then 5mm steps.
                            */}
                            <div style={{
                                fontSize: mm(ptToMm(settings.font_size_body)),
                                color: 'rgb(100, 100, 100)',
                                marginTop: mm(2),
                                lineHeight: 1, // Enforce strict line height to match PDF fixed positioning
                            }}>
                                <div>{settings.company_address}</div>
                                <div style={{ marginTop: mm(5 - ptToMm(settings.font_size_body)) }}>Phone: {settings.company_phone}</div>
                                <div style={{ marginTop: mm(5 - ptToMm(settings.font_size_body)) }}>Email: {settings.company_email}</div>
                                {settings.company_comments && <div style={{ marginTop: mm(5 - ptToMm(settings.font_size_body)) }}>{settings.company_comments}</div>}
                            </div>
                        </div>

                        {/* === SEPARATOR LINE === */}
                        <div
                            className="absolute"
                            style={{
                                left: mm(5),
                                right: mm(5),
                                top: mm(lineY),
                                height: 1,
                                backgroundColor: 'rgb(200, 200, 200)',
                            }}
                        />

                        {/* === BILL TO + INVOICE DETAILS === */}
                        <div
                            className="absolute"
                            style={{
                                left: mm(7),
                                right: mm(7),
                                top: mm(startY),
                            }}
                        >
                            <div className="flex justify-between">
                                {/* Bill To - Left */}
                                <div>
                                    <div style={{
                                        fontSize: mm(ptToMm(11)),
                                        fontWeight: 'bold',
                                        color: '#000',
                                        marginBottom: mm(2),
                                    }}>
                                        Bill To:
                                    </div>
                                    <div style={{ fontSize: mm(ptToMm(10)), color: '#000' }}>
                                        <div>Customer Name</div>
                                        <div>Phone Number</div>
                                        <div>email@example.com</div>
                                        <div>Customer Address</div>
                                    </div>
                                </div>

                                {/* Invoice Details - Right */}
                                <div style={{ fontSize: mm(ptToMm(10)), textAlign: 'right', color: '#000' }}>
                                    <div>Invoice #: INV-000001</div>
                                    <div style={{ marginTop: mm(1.5) }}>Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                    <div style={{ marginTop: mm(1.5) }}>Status: Paid</div>
                                </div>
                            </div>

                            {/* === TABLE === */}
                            {/* Gap is reduced to ~6mm (approx 20px) which is lighter visually */}
                            <div style={{ marginTop: mm(6), border: '1px solid rgb(200, 200, 200)' }}>
                                {/* Header */}
                                <div style={{
                                    display: 'flex',
                                    backgroundColor: 'rgb(66, 66, 66)',
                                    color: 'white',
                                    fontSize: mm(ptToMm(9)),
                                    fontWeight: 'bold',
                                    padding: `${mm(1.5)}px ${mm(2)}px`,
                                }}>
                                    <div style={{ flex: 2 }}>Item</div>
                                    <div style={{ flex: 1, textAlign: 'center' }}>SKU</div>
                                    <div style={{ width: '8%', textAlign: 'center' }}>Qty</div>
                                    <div style={{ width: '18%', textAlign: 'center' }}>Price</div>
                                    <div style={{ width: '18%', textAlign: 'center' }}>Total</div>
                                </div>
                                {/* Rows */}
                                {[1, 2, 3].map((i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        fontSize: mm(ptToMm(9)),
                                        padding: `${mm(1.5)}px ${mm(2)}px`,
                                        borderTop: '1px solid rgb(200, 200, 200)',
                                        color: '#000',
                                    }}>
                                        <div style={{ flex: 2 }}>Sample Product {i}</div>
                                        <div style={{ flex: 1, color: '#666', textAlign: 'center' }}>SKU-00{i}</div>
                                        <div style={{ width: '8%', textAlign: 'center' }}>1</div>
                                        <div style={{ width: '18%', textAlign: 'center' }}>Rs. 100.00</div>
                                        <div style={{ width: '18%', textAlign: 'center' }}>Rs. 100.00</div>
                                    </div>
                                ))}
                                {/* Footer Row */}
                                <div style={{
                                    display: 'flex',
                                    fontSize: mm(ptToMm(9)),
                                    padding: `${mm(1.5)}px ${mm(2)}px`,
                                    borderTop: '2px solid rgb(200, 200, 200)',
                                    fontWeight: 'bold',
                                    backgroundColor: '#f0f0f0',
                                    color: '#000',
                                }}>
                                    <div style={{ flex: 2 }}>Total</div>
                                    <div style={{ flex: 1 }}></div>
                                    <div style={{ width: '8%', textAlign: 'center' }}>3</div>
                                    <div style={{ width: '18%', textAlign: 'center' }}></div>
                                    <div style={{ width: '18%', textAlign: 'center' }}>Rs. 300.00</div>
                                </div>
                            </div>

                            {/* Amount in Words */}
                            <div style={{ marginTop: mm(3.5), fontSize: mm(ptToMm(10)), color: '#000' }}>
                                Amount in Words: Three Hundred Rupees Only
                            </div>

                            {/* === TOTALS === */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: mm(5) }}>
                                <div style={{ width: '40%', fontSize: mm(ptToMm(10)) }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: mm(2) }}>
                                        <span>Subtotal:</span>
                                        <span>Rs. 300.00</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: mm(2) }}>
                                        <span>Discount:</span>
                                        <span>-Rs. 0.00</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: mm(2) }}>
                                        <span>Tax:</span>
                                        <span>Rs. 0.00</span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontWeight: 'bold',
                                        fontSize: mm(ptToMm(12)),
                                        marginTop: mm(3),
                                    }}>
                                        <span>Total:</span>
                                        <span>Rs. 300.00</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* === FOOTER === */}
                        <div
                            className="absolute"
                            style={{
                                left: mm(7),
                                right: mm(7),
                                bottom: mm(7),
                                fontSize: mm(ptToMm(8)),
                                color: 'rgb(150, 150, 150)',
                                display: 'flex',
                                justifyContent: 'space-between',
                            }}
                        >
                            <span>Generated on {new Date().toLocaleString()}</span>
                            <span>Page 1 of 1</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Config Panel */}
            <div className="space-y-4 overflow-y-auto pr-2">
                <Card className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="font-semibold">Company Details</h2>
                            <p className="text-xs text-slate-500">These appear on your invoice header.</p>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border">
                            <Button
                                variant={settings.header_align === 'left' ? 'default' : 'ghost'}
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setSettings({ ...settings, header_align: 'left' })}
                                title="Align Left"
                            >
                                <AlignLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={settings.header_align === 'center' ? 'default' : 'ghost'}
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setSettings({ ...settings, header_align: 'center' })}
                                title="Align Center"
                            >
                                <AlignCenter className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={settings.header_align === 'right' ? 'default' : 'ghost'}
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setSettings({ ...settings, header_align: 'right' })}
                                title="Align Right"
                            >
                                <AlignRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Company Name</Label>
                            <Input
                                value={settings.company_name}
                                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Address</Label>
                            <Input
                                value={settings.company_address}
                                onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Phone</Label>
                                <Input
                                    value={settings.company_phone}
                                    onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Email</Label>
                                <Input
                                    value={settings.company_email}
                                    onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs">Comments / Tagline</Label>
                            <Input
                                value={settings.company_comments}
                                onChange={(e) => setSettings({ ...settings, company_comments: e.target.value })}
                                placeholder="e.g. GSTIN, Slogan"
                            />
                        </div>
                    </div>
                </Card>

                <Card className="p-5 space-y-4">
                    <div>
                        <h2 className="font-semibold">Logo Settings</h2>
                        <p className="text-xs text-slate-500">Upload and resize your business logo.</p>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            {logoDataUrl ? (
                                <img src={logoDataUrl} className="w-14 h-14 object-contain border rounded bg-slate-50" />
                            ) : (
                                <div className="w-14 h-14 bg-slate-100 rounded border-2 border-dashed flex items-center justify-center text-slate-400 text-xs">
                                    Logo
                                </div>
                            )}
                            <Button variant="outline" size="sm" onClick={async () => {
                                try {
                                    const { open } = await import('@tauri-apps/plugin-dialog');
                                    const file = await open({
                                        multiple: false,
                                        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
                                    });
                                    if (file && typeof file === 'string') {
                                        const dir = await imageCommands.getPicturesDirectory();
                                        const filename = `company_logo_${Date.now()}.jpg`; // Always save as JPEG

                                        // Read original file
                                        const data = await readFile(file);
                                        const base64 = btoa(
                                            data.reduce((str, byte) => str + String.fromCharCode(byte), '')
                                        );
                                        const ext = file.split('.').pop()?.toLowerCase() || 'png';
                                        const originalDataUrl = `data:image/${ext};base64,${base64}`;

                                        // Load into Image element
                                        const img = new Image();
                                        img.src = originalDataUrl;
                                        await new Promise((resolve, reject) => {
                                            img.onload = resolve;
                                            img.onerror = reject;
                                        });

                                        // Resize to max 400x400
                                        const MAX_SIZE = 400;
                                        let newWidth = img.width;
                                        let newHeight = img.height;

                                        if (img.width > MAX_SIZE || img.height > MAX_SIZE) {
                                            if (img.width > img.height) {
                                                newWidth = MAX_SIZE;
                                                newHeight = Math.round(img.height * (MAX_SIZE / img.width));
                                            } else {
                                                newHeight = MAX_SIZE;
                                                newWidth = Math.round(img.width * (MAX_SIZE / img.height));
                                            }
                                        }

                                        console.log(`Resizing logo from ${img.width}x${img.height} to ${newWidth}x${newHeight}`);

                                        // Draw to canvas with white background (to handle PNG transparency)
                                        const canvas = document.createElement('canvas');
                                        canvas.width = newWidth;
                                        canvas.height = newHeight;
                                        const ctx = canvas.getContext('2d');
                                        if (ctx) {
                                            // Fill with white background first (prevents black on transparent PNGs)
                                            ctx.fillStyle = '#FFFFFF';
                                            ctx.fillRect(0, 0, newWidth, newHeight);
                                            ctx.drawImage(img, 0, 0, newWidth, newHeight);
                                        }

                                        // Convert to JPEG blob at 80% quality
                                        const blob = await new Promise<Blob | null>(resolve =>
                                            canvas.toBlob(resolve, 'image/jpeg', 0.8)
                                        );

                                        if (blob) {
                                            const arrayBuffer = await blob.arrayBuffer();
                                            const compressedData = new Uint8Array(arrayBuffer);
                                            await writeFile(`${dir}/${filename}`, compressedData);
                                            setSettings({ ...settings, logo_path: filename });
                                            // Clear the cache so new logo is used
                                            clearSettingsCache();
                                            alert(`Logo saved! Compressed from ${(data.length / 1024).toFixed(1)} KB to ${(compressedData.length / 1024).toFixed(1)} KB`);
                                        }
                                    }
                                } catch (err) {
                                    console.error("Failed to save logo", err);
                                    alert("Failed to save logo: " + String(err));
                                }
                            }}>
                                Choose Logo
                            </Button>
                            {settings.logo_path && (
                                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setSettings({ ...settings, logo_path: null })}>
                                    Remove
                                </Button>
                            )}
                        </div>

                        <div>
                            <Label className="text-xs">Logo Width: {settings.logo_width}mm</Label>
                            <Slider
                                value={[settings.logo_width]}
                                min={10}
                                max={80}
                                step={1}
                                onValueChange={([val]: any) => setSettings({ ...settings, logo_width: val })}
                                className="mt-2"
                            />
                        </div>
                    </div>
                </Card>

                <Card className="p-5 space-y-4">
                    <div>
                        <h2 className="font-semibold">Font Sizes</h2>
                        <p className="text-xs text-slate-500">Adjust text sizes (in points).</p>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Header Font Size: {settings.font_size_header}pt</Label>
                            <Slider
                                value={[settings.font_size_header]}
                                min={10}
                                max={24}
                                step={1}
                                onValueChange={([val]: any) => setSettings({ ...settings, font_size_header: val })}
                                className="mt-2"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Body Font Size: {settings.font_size_body}pt</Label>
                            <Slider
                                value={[settings.font_size_body]}
                                min={8}
                                max={14}
                                step={1}
                                onValueChange={([val]: any) => setSettings({ ...settings, font_size_body: val })}
                                className="mt-2"
                            />
                        </div>
                    </div>
                </Card>

                <div className="flex gap-3 pt-2">
                    <Button onClick={handleSave} disabled={saving} className="flex-1 bg-sky-600 hover:bg-sky-700">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Changes
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                    </Button>
                </div>
            </div>
        </div>
    );
}
