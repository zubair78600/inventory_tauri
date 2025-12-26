'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { generateInvoicePDF, clearSettingsCache } from '../../lib/pdf-generator';
import { settingsCommands, imageCommands } from '@/lib/tauri';
import type { Invoice, InvoiceItem, Customer } from '@/lib/tauri';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { Save, Loader2, RotateCcw, ZoomIn, ZoomOut, AlignLeft, AlignCenter, AlignRight, Square, Type, MousePointer2, Trash2, Bold, Italic, ImageIcon, FileText, Pencil } from 'lucide-react';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    page_size: 'a4' | 'a5' | 'custom';
    page_mode: 'full' | 'half';
    page_width: number;
    page_height: number;
}

// Shape types for drawing tools
type DrawingTool = 'select' | 'rectangle' | 'text' | 'image';

interface BaseShape {
    id: string;
    x: number; // in mm
    y: number; // in mm
    width: number; // in mm
    height: number; // in mm
    anchor?: 'page' | 'table';
}

interface RectangleShape extends BaseShape {
    type: 'rectangle';
    borderColor: string;
    borderWidth: number;
    fillColor: string;
    fillOpacity: number;
}

interface TextBoxShape extends BaseShape {
    type: 'text';
    text: string;
    fontSize: number; // in pt
    fontColor: string;
    fontBold: boolean;
    fontItalic: boolean;
    backgroundColor: string;
    backgroundOpacity: number;
}

interface ImageShape extends BaseShape {
    type: 'image';
    imagePath: string; // relative path in pictures-inventory folder
    aspectRatio: number; // original aspect ratio (height/width)
    borderWidth: number;
    borderColor: string;
    opacity: number;
}

type Shape = RectangleShape | TextBoxShape | ImageShape;

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
    page_size: 'a4',
    page_mode: 'full',
    page_width: 210,
    page_height: 297,
};

// A4 page dimensions in mm (jsPDF default)
// Remove consts, use settings directly
// const PAGE_WIDTH = 210;
// const PAGE_HEIGHT = 297;

// Sample invoice data for preview
const SAMPLE_INVOICE: Invoice = {
    id: 1,
    invoice_number: 'INV-100001',
    customer_id: 1,
    total_amount: 140,
    discount_amount: 0,
    tax_amount: 0,
    payment_method: 'Cash',
    created_at: new Date().toISOString(),
    cgst_amount: null,
    fy_year: null,
    gst_rate: null,
    igst_amount: null,
    sgst_amount: null,
    state: null,
    district: null,
    town: null,
};

const SAMPLE_ITEMS: InvoiceItem[] = [
    { id: 1, invoice_id: 1, product_id: 1, product_name: 'Cadbury', product_sku: 'choco_1', quantity: 1, unit_price: 10, discount_amount: 0 },
    { id: 2, invoice_id: 1, product_id: 2, product_name: 'Kitkat', product_sku: 'choco_2', quantity: 1, unit_price: 25, discount_amount: 0 },
    { id: 3, invoice_id: 1, product_id: 3, product_name: 'Mars', product_sku: 'choco_3', quantity: 1, unit_price: 25, discount_amount: 0 },
    { id: 4, invoice_id: 1, product_id: 4, product_name: 'Snickers', product_sku: 'Choco_85', quantity: 1, unit_price: 20, discount_amount: 0 },
    { id: 5, invoice_id: 1, product_id: 5, product_name: 'Milky Bar', product_sku: 'Choc_64', quantity: 1, unit_price: 35, discount_amount: 0 },
    { id: 6, invoice_id: 1, product_id: 6, product_name: 'Kinder Joy', product_sku: 'Chocdo_123', quantity: 1, unit_price: 25, discount_amount: 0 },
];

const SAMPLE_CUSTOMER: Customer = {
    id: 1,
    name: 'Waseem Akram',
    phone: '8121540210',
    email: null,
    address: null,
    place: null,
    state: null,
    district: null,
    town: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    image_path: null,
    last_billed: new Date().toISOString(),
};

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
    const [shapeImageUrls, setShapeImageUrls] = useState<Record<string, string>>({}); // Cache for shape image data URLs

    // Drawing tools state
    const [activeTool, setActiveTool] = useState<DrawingTool>('select');
    const [shapes, setShapes] = useState<Shape[]>([]);
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
    const [currentShape, setCurrentShape] = useState<Shape | null>(null);
    const [resizeHandle, setResizeHandle] = useState<string | null>(null); // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    // Live PDF Preview state
    const [previewMode, setPreviewMode] = useState<'editor' | 'pdf'>('pdf');
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [generatingPreview, setGeneratingPreview] = useState(false);
    const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
                page_size: (rawSettings['invoice_page_size'] as any) || DEFAULT_SETTINGS.page_size,
                page_mode: (rawSettings['invoice_page_mode'] as any) || DEFAULT_SETTINGS.page_mode,
                page_width: rawSettings['invoice_page_width'] !== undefined ? Number(rawSettings['invoice_page_width']) : DEFAULT_SETTINGS.page_width,
                page_height: rawSettings['invoice_page_height'] !== undefined ? Number(rawSettings['invoice_page_height']) : DEFAULT_SETTINGS.page_height,
            });
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setLoading(false);
        }
    };

    // Save current settings to database (used before preview generation)
    const saveSettingsToDb = async () => {
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
        await settingsCommands.set('invoice_page_size', settings.page_size);
        await settingsCommands.set('invoice_page_mode', settings.page_mode);
        await settingsCommands.set('invoice_page_width', settings.page_width.toString());
        await settingsCommands.set('invoice_page_height', settings.page_height.toString());
        // Also save shapes
        await settingsCommands.set('invoice_custom_shapes', JSON.stringify(shapes));
    };

    // Generate PDF preview using the actual PDF generator
    const generatePreviewPdf = useCallback(async () => {
        setGeneratingPreview(true);
        try {
            // First, save current settings to database so PDF generator can read them
            await saveSettingsToDb();

            // Clear settings cache to ensure fresh settings are used
            clearSettingsCache();

            // Generate the actual PDF using the same function that creates final PDFs
            const { url } = await generateInvoicePDF(SAMPLE_INVOICE, SAMPLE_ITEMS, SAMPLE_CUSTOMER);

            // Clean up old URL to prevent memory leaks
            if (pdfPreviewUrl) {
                URL.revokeObjectURL(pdfPreviewUrl);
            }

            setPdfPreviewUrl(url);
        } catch (error) {
            console.error('Failed to generate PDF preview:', error);
        } finally {
            setGeneratingPreview(false);
        }
    }, [pdfPreviewUrl, settings, shapes]);

    // Debounced preview regeneration when settings change
    useEffect(() => {
        if (loading) return;

        // Clear any pending timeout
        if (previewTimeoutRef.current) {
            clearTimeout(previewTimeoutRef.current);
        }

        // Set a debounce delay to avoid regenerating on every keystroke
        previewTimeoutRef.current = setTimeout(() => {
            generatePreviewPdf();
        }, 800); // Increased to 800ms to account for DB save time

        return () => {
            if (previewTimeoutRef.current) {
                clearTimeout(previewTimeoutRef.current);
            }
        };
    }, [settings, loading, shapes]);

    // Clean up PDF URL on unmount
    useEffect(() => {
        return () => {
            if (pdfPreviewUrl) {
                URL.revokeObjectURL(pdfPreviewUrl);
            }
        };
    }, []);

    const handleSave = async () => {
        try {
            setSaving(true);
            await saveSettingsToDb();
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
        newX = Math.max(0, Math.min(newX, getPageWidth() - 20));
        newY = Math.max(0, Math.min(newY, getPageHeight() - 20));

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

    // Load image as data URL for preview
    const loadShapeImage = async (imagePath: string, shapeId: string) => {
        if (!picturesDir || !imagePath) return;
        try {
            const fullPath = `${picturesDir}/${imagePath}`;
            const fileData = await readFile(fullPath);
            const base64 = btoa(fileData.reduce((data, byte) => data + String.fromCharCode(byte), ''));
            const ext = imagePath.split('.').pop()?.toLowerCase() || 'png';
            const dataUrl = `data:image/${ext};base64,${base64}`;
            setShapeImageUrls(prev => ({ ...prev, [shapeId]: dataUrl }));
        } catch (err) {
            console.error('Failed to load shape image:', err);
        }
    };

    // Load shapes from database
    const loadShapes = async () => {
        try {
            const shapesJson = await settingsCommands.get('invoice_custom_shapes');
            if (shapesJson) {
                const loadedShapes: Shape[] = JSON.parse(shapesJson);
                setShapes(loadedShapes);
                // Load images for image shapes
                loadedShapes.forEach(shape => {
                    if (shape.type === 'image' && shape.imagePath) {
                        loadShapeImage(shape.imagePath, shape.id);
                    }
                });
            }
        } catch (err) {
            console.error('Failed to load shapes:', err);
        }
    };

    // Save shapes to database
    const saveShapes = async (newShapes: Shape[]) => {
        try {
            await settingsCommands.set('invoice_custom_shapes', JSON.stringify(newShapes));
        } catch (err) {
            console.error('Failed to save shapes:', err);
        }
    };

    // Handle image file selection for image tool
    const handleImageSelect = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const dataUrl = event.target?.result as string;
                    if (!dataUrl) return;

                    // Get image dimensions
                    const img = new Image();
                    img.src = dataUrl;
                    await new Promise((resolve) => { img.onload = resolve; });

                    const aspectRatio = img.height / img.width;

                    // Save image to pictures-inventory folder
                    const filename = `shape_img_${Date.now()}.jpg`;
                    const dir = picturesDir;

                    // Resize and compress image
                    const MAX_SIZE = 800;
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

                    const canvas = document.createElement('canvas');
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, newWidth, newHeight);
                        ctx.drawImage(img, 0, 0, newWidth, newHeight);
                    }

                    const blob = await new Promise<Blob | null>(resolve =>
                        canvas.toBlob(resolve, 'image/jpeg', 0.85)
                    );

                    if (blob) {
                        const arrayBuffer = await blob.arrayBuffer();
                        const compressedData = new Uint8Array(arrayBuffer);
                        await writeFile(`${dir}/${filename}`, compressedData);

                        // Create new image shape at center of visible area
                        const defaultWidth = 40; // 40mm default width
                        const defaultHeight = defaultWidth * aspectRatio;

                        const newShape: ImageShape = {
                            id: generateId(),
                            type: 'image',
                            x: (getPageWidth() - defaultWidth) / 2,
                            y: (getPageHeight() - defaultHeight) / 2,
                            width: defaultWidth,
                            height: defaultHeight,
                            anchor: 'page',
                            imagePath: filename,
                            aspectRatio: aspectRatio,
                            borderWidth: 0,
                            borderColor: '#000000',
                            opacity: 1,
                        };

                        const newShapes = [...shapes, newShape];
                        setShapes(newShapes);
                        saveShapes(newShapes);
                        setSelectedShapeId(newShape.id);

                        // Cache the data URL for preview
                        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                        setShapeImageUrls(prev => ({ ...prev, [newShape.id]: compressedDataUrl }));
                    }
                };
                reader.readAsDataURL(file);
            } catch (err) {
                console.error('Failed to save image:', err);
                alert('Failed to save image: ' + String(err));
            }
        };
        input.click();
        setActiveTool('select'); // Switch back to select after adding image
    };

    // Load shapes on mount (after picturesDir is set)
    useEffect(() => {
        if (picturesDir) {
            loadShapes();
        }
    }, [picturesDir]);

    // Generate unique ID for shapes
    const generateId = () => `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get mouse position in mm relative to preview
    const getMousePositionMm = (e: React.MouseEvent): { x: number; y: number } => {
        if (!previewRef.current) return { x: 0, y: 0 };
        const rect = previewRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        return { x: Math.max(0, Math.min(x, getPageWidth())), y: Math.max(0, Math.min(y, getPageHeight())) };
    };

    // Drawing event handlers
    const handlePreviewMouseDown = (e: React.MouseEvent) => {
        if (activeTool === 'select' || dragging) return;

        e.preventDefault();
        e.stopPropagation();

        const pos = getMousePositionMm(e);
        setIsDrawing(true);
        setDrawStart(pos);

        if (activeTool === 'rectangle') {
            const newShape: RectangleShape = {
                id: generateId(),
                type: 'rectangle',
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0,
                anchor: 'page',
                borderColor: '#000000',
                borderWidth: 1,
                fillColor: '#ffffff',
                fillOpacity: 0,
            };
            setCurrentShape(newShape);
        } else if (activeTool === 'text') {
            const newShape: TextBoxShape = {
                id: generateId(),
                type: 'text',
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0,
                anchor: 'page',
                text: '',
                fontSize: 10,
                fontColor: '#000000',
                fontBold: false,
                fontItalic: false,
                backgroundColor: '#ffffff',
                backgroundOpacity: 0,
            };
            setCurrentShape(newShape);
        }
    };

    const handlePreviewMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !currentShape) return;

        const pos = getMousePositionMm(e);
        const width = pos.x - drawStart.x;
        const height = pos.y - drawStart.y;

        // Handle negative dimensions (drawing from right to left or bottom to top)
        const newX = width < 0 ? pos.x : drawStart.x;
        const newY = height < 0 ? pos.y : drawStart.y;
        const newWidth = Math.abs(width);
        const newHeight = Math.abs(height);

        setCurrentShape({
            ...currentShape,
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
        });
    };

    const handlePreviewMouseUp = () => {
        if (!isDrawing || !currentShape) return;

        setIsDrawing(false);

        // Only add shape if it has meaningful size (at least 5mm)
        if (currentShape.width >= 5 && currentShape.height >= 5) {
            const newShapes = [...shapes, currentShape];
            setShapes(newShapes);
            saveShapes(newShapes);
            setSelectedShapeId(currentShape.id);

            // If text box, start editing immediately
            if (currentShape.type === 'text') {
                setEditingTextId(currentShape.id);
            }
        }

        setCurrentShape(null);
        setActiveTool('select'); // Switch back to select after drawing
    };

    // Shape selection
    const handleShapeClick = (e: React.MouseEvent, shapeId: string) => {
        e.stopPropagation();
        if (activeTool === 'select') {
            setSelectedShapeId(shapeId);
        }
    };

    // Shape deletion
    const deleteSelectedShape = () => {
        if (!selectedShapeId) return;
        const newShapes = shapes.filter(s => s.id !== selectedShapeId);
        setShapes(newShapes);
        saveShapes(newShapes);
        setSelectedShapeId(null);
        setEditingTextId(null);
    };

    // Shape resize handlers
    const handleResizeStart = (e: React.MouseEvent, handle: string) => {
        e.stopPropagation();
        e.preventDefault();
        setResizeHandle(handle);
        const pos = getMousePositionMm(e);
        setDragStart(pos);
        const shape = shapes.find(s => s.id === selectedShapeId);
        if (shape) {
            setInitialPos({ x: shape.x, y: shape.y });
        }
    };

    const handleResizeMove = (e: React.MouseEvent) => {
        if (!resizeHandle || !selectedShapeId) return;

        const pos = getMousePositionMm(e);
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;

        setShapes(shapes.map(shape => {
            if (shape.id !== selectedShapeId) return shape;

            let { x, y, width, height } = shape;

            // Handle different resize directions
            if (resizeHandle.includes('e')) {
                width = Math.max(5, width + dx);
            }
            if (resizeHandle.includes('w')) {
                const newWidth = Math.max(5, width - dx);
                x = x + (width - newWidth);
                width = newWidth;
            }
            if (resizeHandle.includes('s')) {
                height = Math.max(5, height + dy);
            }
            if (resizeHandle.includes('n')) {
                const newHeight = Math.max(5, height - dy);
                y = y + (height - newHeight);
                height = newHeight;
            }

            return { ...shape, x, y, width, height };
        }));

        setDragStart(pos);
    };

    const handleResizeEnd = () => {
        if (resizeHandle) {
            saveShapes(shapes);
        }
        setResizeHandle(null);
    };

    // Shape move handlers
    const handleShapeMoveStart = (e: React.MouseEvent, shapeId: string) => {
        if (activeTool !== 'select') return;
        e.stopPropagation();
        e.preventDefault();
        setSelectedShapeId(shapeId);
        const pos = getMousePositionMm(e);
        setDragStart(pos);
        const shape = shapes.find(s => s.id === shapeId);
        if (shape) {
            setInitialPos({ x: shape.x, y: shape.y });
        }
    };

    const handleShapeMove = (e: React.MouseEvent) => {
        if (!selectedShapeId || resizeHandle) return;
        if (e.buttons !== 1) return; // Only move if mouse button is held

        const pos = getMousePositionMm(e);
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;

        setShapes(shapes.map(shape => {
            if (shape.id !== selectedShapeId) return shape;
            return {
                ...shape,
                x: Math.max(0, Math.min(initialPos.x + dx, getPageWidth() - shape.width)),
                y: Math.max(0, Math.min(initialPos.y + dy, getPageHeight() - shape.height)),
            };
        }));
    };

    const handleShapeMoveEnd = () => {
        saveShapes(shapes);
    };

    // Update shape properties
    const updateShape = (shapeId: string, updates: Partial<Shape>) => {
        const newShapes = shapes.map(s =>
            s.id === shapeId ? { ...s, ...updates } as Shape : s
        );
        setShapes(newShapes);
        saveShapes(newShapes);
    };

    // Text editing
    const handleTextChange = (shapeId: string, text: string) => {
        updateShape(shapeId, { text });
    };

    // Deselect when clicking on empty area
    const handlePreviewClick = (e: React.MouseEvent) => {
        if (e.target === previewRef.current || (e.target as HTMLElement).closest('[data-preview-content]')) {
            if (activeTool === 'select' && !isDrawing) {
                setSelectedShapeId(null);
                setEditingTextId(null);
            }
        }
    };

    // Get selected shape
    const selectedShape = shapes.find(s => s.id === selectedShapeId);

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

    const mm = (val: number) => val * zoom;
    // pt to mm (jsPDF uses pt for fonts, 1pt = 0.352778mm)
    const ptToMm = (pt: number) => pt * 0.352778;
    const pxToMm = (px: number) => px * 0.264583;
    const borderPx = (px: number) => pxToMm(px) * zoom;

    // Match pdf-generator.ts table layout (autoTable) for accurate shape alignment
    const tableStartY = startY + 27;
    const tableFontSize = 9;
    const tableLineHeight = ptToMm(tableFontSize) * 1.15;
    const tableCellPaddingX = 2;
    const tableCellPaddingY = 1.5;
    const tableRowHeight = tableLineHeight + tableCellPaddingY * 2;
    const tableRowCount = SAMPLE_ITEMS.length + 2; // header + footer
    const tableHeight = tableRowHeight * tableRowCount;
    const totalsStartY = tableStartY + tableHeight + 3.5;

    const getPageWidth = () => {
        if (settings.page_size === 'a5') return 148;
        if (settings.page_size === 'custom') return settings.page_width;
        return 210; // A4
    };

    const getPageHeight = () => {
        let h = 297; // A4
        if (settings.page_size === 'a5') h = 210;
        if (settings.page_size === 'custom') h = settings.page_height;

        if (settings.page_mode === 'half') return h / 2;
        return h;
    };

    const previewWidth = getPageWidth();
    const previewHeight = getPageHeight();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-6 h-[calc(100vh-200px)]">
            {/* Preview Area */}
            <div className="bg-slate-300 dark:bg-slate-800 rounded-lg border overflow-auto relative">
                {/* Toolbar */}
                <div className="sticky top-2 left-2 z-20 flex gap-2 ml-2 mt-2 flex-wrap">
                    {/* Preview Mode Toggle */}
                    <div className="inline-flex bg-white dark:bg-slate-900 rounded-lg shadow border p-1 gap-1">
                        <Button
                            variant={previewMode === 'pdf' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setPreviewMode('pdf')}
                            title="PDF Preview (actual output)"
                            className="gap-1"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="text-xs hidden sm:inline">PDF</span>
                        </Button>
                        <Button
                            variant={previewMode === 'editor' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setPreviewMode('editor')}
                            title="Visual Editor (drag elements)"
                            className="gap-1"
                        >
                            <Pencil className="w-4 h-4" />
                            <span className="text-xs hidden sm:inline">Editor</span>
                        </Button>
                    </div>

                    {/* Generating indicator */}
                    {generatingPreview && (
                        <div className="inline-flex bg-white dark:bg-slate-900 rounded-lg shadow border p-1 px-3 items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                            <span className="text-xs">Updating...</span>
                        </div>
                    )}

                    {/* Zoom Controls - only show in editor mode */}
                    {previewMode === 'editor' && (
                        <div className="inline-flex bg-white dark:bg-slate-900 rounded-lg shadow border p-1 gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(z - 0.5, 1))}>
                                <ZoomOut className="w-4 h-4" />
                            </Button>
                            <span className="px-2 py-1 text-sm font-medium min-w-[50px] text-center">{Math.round(zoom * 50)}%</span>
                            <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(z + 0.5, 4))}>
                                <ZoomIn className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    {/* Drawing Tools - only show in editor mode */}
                    {previewMode === 'editor' && (
                        <div className="inline-flex bg-white dark:bg-slate-900 rounded-lg shadow border p-1 gap-1">
                            <Button
                                variant={activeTool === 'select' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setActiveTool('select')}
                                title="Select Tool (move and resize shapes)"
                            >
                                <MousePointer2 className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={activeTool === 'rectangle' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setActiveTool('rectangle')}
                                title="Rectangle Tool (draw rectangles)"
                            >
                                <Square className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={activeTool === 'text' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setActiveTool('text')}
                                title="Text Box Tool (add text)"
                            >
                                <Type className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={activeTool === 'image' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => {
                                    setActiveTool('image');
                                    handleImageSelect();
                                }}
                                title="Image Tool (add image)"
                            >
                                <ImageIcon className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    {/* Delete selected shape - only show in editor mode */}
                    {previewMode === 'editor' && selectedShapeId && (
                        <div className="inline-flex bg-white dark:bg-slate-900 rounded-lg shadow border p-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={deleteSelectedShape}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                title="Delete selected shape"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* PDF Preview Mode */}
                {previewMode === 'pdf' && (
                    <div className="flex justify-center p-6 pt-2 h-[calc(100%-60px)]">
                        {pdfPreviewUrl ? (
                            <iframe
                                src={pdfPreviewUrl}
                                className="w-full h-full rounded-md border shadow-lg bg-white"
                                title="PDF Preview"
                            />
                        ) : (
                            <div className="flex items-center justify-center w-full h-full">
                                <div className="text-center">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-600 mb-2" />
                                    <p className="text-sm text-slate-500">Generating preview...</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Visual Editor Mode - A4 Page Preview */}
                {previewMode === 'editor' && (
                    <div className="flex justify-center p-6 pt-2">
                        <div
                            ref={previewRef}
                            className="bg-white shadow-2xl relative"
                            style={{
                                width: mm(previewWidth),
                                height: mm(previewHeight),
                                fontFamily: 'Helvetica, Arial, sans-serif',
                                cursor: activeTool === 'rectangle' || activeTool === 'text' ? 'crosshair' : 'default',
                            }}
                            onMouseDown={handlePreviewMouseDown}
                            onMouseMove={(e) => {
                                handlePreviewMouseMove(e);
                                handleResizeMove(e);
                                handleShapeMove(e);
                            }}
                            onMouseUp={() => {
                                handlePreviewMouseUp();
                                handleResizeEnd();
                                handleShapeMoveEnd();
                            }}
                            onMouseLeave={() => {
                                handlePreviewMouseUp();
                                handleResizeEnd();
                            }}
                            onClick={handlePreviewClick}
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

                            {/* === BILL TO + INVOICE DETAILS (fixed to PDF positions) === */}
                            <div
                                className="absolute"
                                style={{
                                    left: mm(7),
                                    top: mm(startY),
                                    fontSize: mm(ptToMm(11)),
                                    fontWeight: 'bold',
                                    color: '#000',
                                }}
                            >
                                Bill To:
                            </div>
                            <div
                                className="absolute"
                                style={{
                                    left: mm(7),
                                    top: mm(startY + 6),
                                    fontSize: mm(ptToMm(10)),
                                    color: '#000',
                                }}
                            >
                                {SAMPLE_CUSTOMER.name}
                            </div>
                            <div
                                className="absolute"
                                style={{
                                    left: mm(7),
                                    top: mm(startY + 11),
                                    fontSize: mm(ptToMm(10)),
                                    color: '#000',
                                }}
                            >
                                {SAMPLE_CUSTOMER.phone}
                            </div>

                            <div
                                className="absolute"
                                style={{
                                    right: mm(7),
                                    top: mm(startY),
                                    fontSize: mm(ptToMm(10)),
                                    textAlign: 'right',
                                    color: '#000',
                                }}
                            >
                                Invoice #: {SAMPLE_INVOICE.invoice_number}
                            </div>
                            <div
                                className="absolute"
                                style={{
                                    right: mm(7),
                                    top: mm(startY + 5),
                                    fontSize: mm(ptToMm(10)),
                                    textAlign: 'right',
                                    color: '#000',
                                }}
                            >
                                Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            <div
                                className="absolute"
                                style={{
                                    right: mm(7),
                                    top: mm(startY + 10),
                                    fontSize: mm(ptToMm(10)),
                                    textAlign: 'right',
                                    color: '#000',
                                }}
                            >
                                Status: Paid
                            </div>

                            {/* === TABLE === */}
                            <div
                                className="absolute"
                                style={{
                                    left: mm(7),
                                    right: mm(7),
                                    top: mm(tableStartY),
                                    border: '1px solid rgb(200, 200, 200)',
                                }}
                            >
                                {/* Header */}
                                <div style={{
                                    display: 'flex',
                                    height: mm(tableRowHeight),
                                    backgroundColor: 'rgb(66, 66, 66)',
                                    color: 'white',
                                    fontSize: mm(ptToMm(tableFontSize)),
                                    fontWeight: 'bold',
                                    padding: `0 ${mm(tableCellPaddingX)}px`,
                                    alignItems: 'center',
                                }}>
                                    <div style={{ flex: 2 }}>Item</div>
                                    <div style={{ flex: 1, textAlign: 'center' }}>SKU</div>
                                    <div style={{ width: '8%', textAlign: 'center' }}>Qty</div>
                                    <div style={{ width: '18%', textAlign: 'center' }}>Price</div>
                                    <div style={{ width: '18%', textAlign: 'center' }}>Total</div>
                                </div>
                                {/* Rows - using SAMPLE_ITEMS */}
                                {SAMPLE_ITEMS.map((item) => (
                                    <div key={item.id} style={{
                                        display: 'flex',
                                        height: mm(tableRowHeight),
                                        fontSize: mm(ptToMm(tableFontSize)),
                                        padding: `0 ${mm(tableCellPaddingX)}px`,
                                        borderTop: '1px solid rgb(200, 200, 200)',
                                        color: '#000',
                                        alignItems: 'center',
                                    }}>
                                        <div style={{ flex: 2 }}>{item.product_name}</div>
                                        <div style={{ flex: 1, color: '#666', textAlign: 'center' }}>{item.product_sku}</div>
                                        <div style={{ width: '8%', textAlign: 'center' }}>{item.quantity}</div>
                                        <div style={{ width: '18%', textAlign: 'right' }}>Rs. {item.unit_price.toFixed(1)}</div>
                                        <div style={{ width: '18%', textAlign: 'right' }}>Rs. {(item.quantity * item.unit_price).toFixed(1)}</div>
                                    </div>
                                ))}
                                {/* Footer Row */}
                                <div style={{
                                    display: 'flex',
                                    height: mm(tableRowHeight),
                                    fontSize: mm(ptToMm(tableFontSize)),
                                    padding: `0 ${mm(tableCellPaddingX)}px`,
                                    borderTop: '2px solid rgb(200, 200, 200)',
                                    fontWeight: 'bold',
                                    backgroundColor: '#f0f0f0',
                                    color: '#000',
                                    alignItems: 'center',
                                }}>
                                    <div style={{ flex: 2 }}>Total</div>
                                    <div style={{ flex: 1 }}></div>
                                    <div style={{ width: '8%', textAlign: 'center' }}>{SAMPLE_ITEMS.reduce((sum, i) => sum + i.quantity, 0)}</div>
                                    <div style={{ width: '18%', textAlign: 'center' }}></div>
                                    <div style={{ width: '18%', textAlign: 'right' }}>Rs. {SAMPLE_INVOICE.total_amount.toFixed(1)}</div>
                                </div>
                            </div>

                            {/* === AMOUNT IN WORDS & TOTALS === */}
                            <div
                                className="absolute"
                                style={{
                                    left: mm(7),
                                    right: mm(7),
                                    top: mm(totalsStartY),
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                }}
                            >
                                {/* Amount in Words */}
                                <div style={{ fontSize: mm(ptToMm(10)), color: '#000', flex: 1, paddingRight: mm(2) }}>
                                    Amount in Words: One Hundred Forty Rupees Only
                                </div>

                                {/* Totals Summary */}
                                <div style={{ width: mm(61), fontSize: mm(ptToMm(10)), paddingRight: mm(2) }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: mm(2) }}>
                                        <span>Subtotal:</span>
                                        <span>Rs. {SAMPLE_INVOICE.total_amount.toFixed(1)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: mm(2) }}>
                                        <span>Discount:</span>
                                        <span>-</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: mm(2) }}>
                                        <span>Tax:</span>
                                        <span>Rs. {(SAMPLE_INVOICE.tax_amount || 0).toFixed(1)}</span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontWeight: 'bold',
                                        fontSize: mm(ptToMm(12)),
                                        marginTop: mm(3),
                                    }}>
                                        <span>Total:</span>
                                        <span>Rs. {SAMPLE_INVOICE.total_amount.toFixed(1)}</span>
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

                            {/* === CUSTOM SHAPES === */}
                            {shapes.map((shape) => (
                                <div
                                    key={shape.id}
                                    className={`absolute ${selectedShapeId === shape.id ? 'ring-2 ring-blue-500' : ''}`}
                                    style={{
                                        left: mm(shape.x),
                                        top: mm(shape.y),
                                        width: mm(shape.width),
                                        height: mm(shape.height),
                                        cursor: activeTool === 'select' ? 'move' : 'default',
                                        boxSizing: 'border-box',
                                        ...(shape.type === 'rectangle' ? {
                                            border: 'none',
                                            outline: shape.borderWidth > 0 ? `${borderPx(shape.borderWidth)}px solid ${shape.borderColor}` : 'none',
                                            outlineOffset: shape.borderWidth > 0 ? `${-borderPx(shape.borderWidth) / 2}px` : '0px',
                                            backgroundColor: shape.fillOpacity > 0 ? shape.fillColor : 'transparent',
                                            opacity: shape.fillOpacity > 0 ? shape.fillOpacity : 1,
                                        } : shape.type === 'text' ? {
                                            backgroundColor: shape.backgroundOpacity > 0 ? shape.backgroundColor : 'transparent',
                                        } : shape.type === 'image' ? {
                                            border: 'none',
                                            outline: shape.borderWidth > 0 ? `${borderPx(shape.borderWidth)}px solid ${shape.borderColor}` : 'none',
                                            outlineOffset: shape.borderWidth > 0 ? `${-borderPx(shape.borderWidth) / 2}px` : '0px',
                                            opacity: shape.opacity,
                                        } : {}),
                                    }}
                                    onClick={(e) => handleShapeClick(e, shape.id)}
                                    onMouseDown={(e) => handleShapeMoveStart(e, shape.id)}
                                >
                                    {/* Text content for text boxes */}
                                    {shape.type === 'text' && (
                                        editingTextId === shape.id ? (
                                            <textarea
                                                autoFocus
                                                className="w-full h-full resize-none border-none outline-none bg-transparent p-1"
                                                style={{
                                                    fontSize: mm(ptToMm(shape.fontSize)),
                                                    color: shape.fontColor,
                                                    fontWeight: shape.fontBold ? 'bold' : 'normal',
                                                    fontStyle: shape.fontItalic ? 'italic' : 'normal',
                                                    lineHeight: 1.2,
                                                }}
                                                value={shape.text}
                                                onChange={(e) => handleTextChange(shape.id, e.target.value)}
                                                onBlur={() => setEditingTextId(null)}
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <div
                                                className="w-full h-full overflow-hidden p-1"
                                                style={{
                                                    fontSize: mm(ptToMm(shape.fontSize)),
                                                    color: shape.fontColor,
                                                    fontWeight: shape.fontBold ? 'bold' : 'normal',
                                                    fontStyle: shape.fontItalic ? 'italic' : 'normal',
                                                    lineHeight: 1.2,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }}
                                                onDoubleClick={() => setEditingTextId(shape.id)}
                                            >
                                                {shape.text || (selectedShapeId === shape.id ? 'Double-click to edit' : '')}
                                            </div>
                                        )
                                    )}

                                    {/* Image content for image shapes */}
                                    {shape.type === 'image' && shapeImageUrls[shape.id] && (
                                        <img
                                            src={shapeImageUrls[shape.id]}
                                            alt="Shape image"
                                            className="w-full h-full object-contain pointer-events-none"
                                            draggable={false}
                                        />
                                    )}

                                    {/* Resize handles for selected shape */}
                                    {selectedShapeId === shape.id && activeTool === 'select' && (
                                        <>
                                            {/* Corner handles */}
                                            <div
                                                className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-nw-resize"
                                                style={{ left: -6, top: -6 }}
                                                onMouseDown={(e) => handleResizeStart(e, 'nw')}
                                            />
                                            <div
                                                className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-ne-resize"
                                                style={{ right: -6, top: -6 }}
                                                onMouseDown={(e) => handleResizeStart(e, 'ne')}
                                            />
                                            <div
                                                className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-sw-resize"
                                                style={{ left: -6, bottom: -6 }}
                                                onMouseDown={(e) => handleResizeStart(e, 'sw')}
                                            />
                                            <div
                                                className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-se-resize"
                                                style={{ right: -6, bottom: -6 }}
                                                onMouseDown={(e) => handleResizeStart(e, 'se')}
                                            />
                                            {/* Edge handles */}
                                            <div
                                                className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-n-resize"
                                                style={{ left: '50%', top: -6, transform: 'translateX(-50%)' }}
                                                onMouseDown={(e) => handleResizeStart(e, 'n')}
                                            />
                                            <div
                                                className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-s-resize"
                                                style={{ left: '50%', bottom: -6, transform: 'translateX(-50%)' }}
                                                onMouseDown={(e) => handleResizeStart(e, 's')}
                                            />
                                            <div
                                                className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-w-resize"
                                                style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }}
                                                onMouseDown={(e) => handleResizeStart(e, 'w')}
                                            />
                                            <div
                                                className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-e-resize"
                                                style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
                                                onMouseDown={(e) => handleResizeStart(e, 'e')}
                                            />
                                        </>
                                    )}
                                </div>
                            ))}

                            {/* Current shape being drawn */}
                            {currentShape && (
                                <div
                                    className="absolute pointer-events-none"
                                    style={{
                                        left: mm(currentShape.x),
                                        top: mm(currentShape.y),
                                        width: mm(currentShape.width),
                                        height: mm(currentShape.height),
                                        border: currentShape.type === 'rectangle' ? '2px solid #3b82f6' : '2px dashed #3b82f6',
                                        backgroundColor: currentShape.type === 'text' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}
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

                    {/* Page Configuration */}
                    <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border space-y-3">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Page Configuration</Label>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs mb-1.5 block">Page Size</Label>
                                <Select
                                    value={settings.page_size}
                                    onValueChange={(v: any) => setSettings({ ...settings, page_size: v })}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="a4">A4 (210 x 297 mm)</SelectItem>
                                        <SelectItem value="a5">A5 (148 x 210 mm)</SelectItem>
                                        <SelectItem value="custom">Custom Size</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs block">Page Mode</Label>
                                <RadioGroup
                                    value={settings.page_mode}
                                    onValueChange={(v: any) => setSettings({ ...settings, page_mode: v })}
                                    className="flex gap-2"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="full" id="pm-full" />
                                        <Label htmlFor="pm-full" className="text-xs font-normal cursor-pointer">Full Page</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="half" id="pm-half" />
                                        <Label htmlFor="pm-half" className="text-xs font-normal cursor-pointer">Half Page</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>

                        {settings.page_size === 'custom' && (
                            <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1">
                                <div>
                                    <Label className="text-xs">Width (mm)</Label>
                                    <Input
                                        type="number"
                                        value={settings.page_width}
                                        onChange={e => setSettings({ ...settings, page_width: Number(e.target.value) })}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Height (mm)</Label>
                                    <Input
                                        type="number"
                                        value={settings.page_height}
                                        onChange={e => setSettings({ ...settings, page_height: Number(e.target.value) })}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>
                        )}
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

                {/* Shape Properties Panel */}
                {selectedShape && (
                    <Card className="p-5 space-y-4 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="font-semibold">
                                    {selectedShape.type === 'rectangle' ? 'Rectangle' : 'Text Box'} Properties
                                </h2>
                                <p className="text-xs text-slate-500">Customize the selected shape.</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={deleteSelectedShape}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {/* Position */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label className="text-xs">X (mm)</Label>
                                    <Input
                                        type="number"
                                        value={Math.round(selectedShape.x)}
                                        onChange={(e) => updateShape(selectedShape.id, { x: Number(e.target.value) })}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Y (mm)</Label>
                                    <Input
                                        type="number"
                                        value={Math.round(selectedShape.y)}
                                        onChange={(e) => updateShape(selectedShape.id, { y: Number(e.target.value) })}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 rounded-md border bg-white/70 p-2 text-xs">
                                <span className="text-slate-600">Attach to items table</span>
                                <label className="flex items-center gap-2 text-slate-700">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={(selectedShape.anchor || 'page') === 'table'}
                                        onChange={(e) => updateShape(selectedShape.id, { anchor: e.target.checked ? 'table' : 'page' })}
                                    />
                                    <span>Move with rows</span>
                                </label>
                            </div>

                            {/* Size */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label className="text-xs">Width (mm)</Label>
                                    <Input
                                        type="number"
                                        value={Math.round(selectedShape.width)}
                                        onChange={(e) => updateShape(selectedShape.id, { width: Math.max(5, Number(e.target.value)) })}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Height (mm)</Label>
                                    <Input
                                        type="number"
                                        value={Math.round(selectedShape.height)}
                                        onChange={(e) => updateShape(selectedShape.id, { height: Math.max(5, Number(e.target.value)) })}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>

                            {/* Rectangle specific properties */}
                            {selectedShape.type === 'rectangle' && (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-xs">Border Color</Label>
                                            <Input
                                                type="color"
                                                value={selectedShape.borderColor}
                                                onChange={(e) => updateShape(selectedShape.id, { borderColor: e.target.value })}
                                                className="h-8 p-1 cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Border Width: {selectedShape.borderWidth}px</Label>
                                            <Slider
                                                value={[selectedShape.borderWidth]}
                                                min={0}
                                                max={5}
                                                step={1}
                                                onValueChange={([val]) => updateShape(selectedShape.id, { borderWidth: val })}
                                                className="mt-2"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-xs">Fill Color</Label>
                                            <Input
                                                type="color"
                                                value={selectedShape.fillColor}
                                                onChange={(e) => updateShape(selectedShape.id, { fillColor: e.target.value })}
                                                className="h-8 p-1 cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Fill Opacity: {Math.round(selectedShape.fillOpacity * 100)}%</Label>
                                            <Slider
                                                value={[selectedShape.fillOpacity * 100]}
                                                min={0}
                                                max={100}
                                                step={10}
                                                onValueChange={([val]) => updateShape(selectedShape.id, { fillOpacity: val / 100 })}
                                                className="mt-2"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Text box specific properties */}
                            {selectedShape.type === 'text' && (
                                <>
                                    <div>
                                        <Label className="text-xs">Text Content</Label>
                                        <textarea
                                            value={selectedShape.text}
                                            onChange={(e) => updateShape(selectedShape.id, { text: e.target.value })}
                                            className="w-full h-20 text-xs p-2 border rounded-md resize-none"
                                            placeholder="Enter your text here..."
                                            style={{
                                                fontWeight: selectedShape.fontBold ? 'bold' : 'normal',
                                                fontStyle: selectedShape.fontItalic ? 'italic' : 'normal',
                                            }}
                                        />
                                    </div>
                                    {/* Font Style Buttons */}
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs">Font Style:</Label>
                                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border">
                                            <Button
                                                variant={selectedShape.fontBold ? 'default' : 'ghost'}
                                                size="sm"
                                                className="h-7 w-7 p-0"
                                                onClick={() => updateShape(selectedShape.id, { fontBold: !selectedShape.fontBold })}
                                                title="Bold"
                                            >
                                                <Bold className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant={selectedShape.fontItalic ? 'default' : 'ghost'}
                                                size="sm"
                                                className="h-7 w-7 p-0"
                                                onClick={() => updateShape(selectedShape.id, { fontItalic: !selectedShape.fontItalic })}
                                                title="Italic"
                                            >
                                                <Italic className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-xs">Font Size: {selectedShape.fontSize}pt</Label>
                                            <Slider
                                                value={[selectedShape.fontSize]}
                                                min={6}
                                                max={24}
                                                step={1}
                                                onValueChange={([val]) => updateShape(selectedShape.id, { fontSize: val })}
                                                className="mt-2"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Font Color</Label>
                                            <Input
                                                type="color"
                                                value={selectedShape.fontColor}
                                                onChange={(e) => updateShape(selectedShape.id, { fontColor: e.target.value })}
                                                className="h-8 p-1 cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-xs">Background Color</Label>
                                            <Input
                                                type="color"
                                                value={selectedShape.backgroundColor}
                                                onChange={(e) => updateShape(selectedShape.id, { backgroundColor: e.target.value })}
                                                className="h-8 p-1 cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Bg Opacity: {Math.round(selectedShape.backgroundOpacity * 100)}%</Label>
                                            <Slider
                                                value={[selectedShape.backgroundOpacity * 100]}
                                                min={0}
                                                max={100}
                                                step={10}
                                                onValueChange={([val]) => updateShape(selectedShape.id, { backgroundOpacity: val / 100 })}
                                                className="mt-2"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Image specific properties */}
                            {selectedShape.type === 'image' && (
                                <>
                                    {/* Image Preview */}
                                    {shapeImageUrls[selectedShape.id] && (
                                        <div className="border rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800">
                                            <img
                                                src={shapeImageUrls[selectedShape.id]}
                                                alt="Shape preview"
                                                className="w-full h-24 object-contain"
                                            />
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-xs">Border Color</Label>
                                            <Input
                                                type="color"
                                                value={selectedShape.borderColor}
                                                onChange={(e) => updateShape(selectedShape.id, { borderColor: e.target.value })}
                                                className="h-8 p-1 cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Border Width: {selectedShape.borderWidth}px</Label>
                                            <Slider
                                                value={[selectedShape.borderWidth]}
                                                min={0}
                                                max={5}
                                                step={1}
                                                onValueChange={([val]) => updateShape(selectedShape.id, { borderWidth: val })}
                                                className="mt-2"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Opacity: {Math.round(selectedShape.opacity * 100)}%</Label>
                                        <Slider
                                            value={[selectedShape.opacity * 100]}
                                            min={10}
                                            max={100}
                                            step={10}
                                            onValueChange={([val]) => updateShape(selectedShape.id, { opacity: val / 100 })}
                                            className="mt-2"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs"
                                            onClick={() => {
                                                // Reset to original aspect ratio
                                                const newHeight = selectedShape.width * selectedShape.aspectRatio;
                                                updateShape(selectedShape.id, { height: newHeight });
                                            }}
                                        >
                                            Reset Aspect Ratio
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </Card>
                )}

                {/* Custom Shapes List */}
                {shapes.length > 0 && (
                    <Card className="p-5 space-y-4">
                        <div>
                            <h2 className="font-semibold">Custom Shapes ({shapes.length})</h2>
                            <p className="text-xs text-slate-500">Click to select, drag to move.</p>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {shapes.map((shape, index) => (
                                <div
                                    key={shape.id}
                                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${selectedShapeId === shape.id
                                        ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300'
                                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                    onClick={() => setSelectedShapeId(shape.id)}
                                >
                                    <div className="flex items-center gap-2">
                                        {shape.type === 'rectangle' ? (
                                            <Square className="w-4 h-4 text-slate-500" />
                                        ) : shape.type === 'text' ? (
                                            <Type className="w-4 h-4 text-slate-500" />
                                        ) : (
                                            <ImageIcon className="w-4 h-4 text-slate-500" />
                                        )}
                                        <span className="text-xs">
                                            {shape.type === 'rectangle'
                                                ? `Rectangle ${index + 1}`
                                                : shape.type === 'text'
                                                    ? (shape.text?.slice(0, 20) || `Text Box ${index + 1}`)
                                                    : `Image ${index + 1}`}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const newShapes = shapes.filter(s => s.id !== shape.id);
                                            setShapes(newShapes);
                                            saveShapes(newShapes);
                                            if (selectedShapeId === shape.id) {
                                                setSelectedShapeId(null);
                                            }
                                        }}
                                        className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

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
