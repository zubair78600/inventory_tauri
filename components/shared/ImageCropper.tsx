'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
// import { Slider } from '@/components/ui/slider'; // Removed
import { Check, X, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageCropperProps {
    imageSrc: string;
    onSave: (blob: Blob) => void;
    onCancel: () => void;
    aspectRatio?: number; // default 1 (square)
}

export function ImageCropper({
    imageSrc,
    onSave,
    onCancel,
    aspectRatio = 1,
}: ImageCropperProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 }); // Natural size
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    // Initialize image sizing
    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });

        // Fit image to cover the container initially
        if (containerRef.current) {
            const { width: cw, height: ch } = containerRef.current.getBoundingClientRect();
            const scaleW = cw / img.naturalWidth;
            const scaleH = ch / img.naturalHeight;
            const initialScale = Math.max(scaleW, scaleH); // Cover

            setScale(initialScale);
            setContainerSize({ width: cw, height: ch });

            // Center
            const scaledW = img.naturalWidth * initialScale;
            const scaledH = img.naturalHeight * initialScale;
            setPosition({
                x: (cw - scaledW) / 2,
                y: (ch - scaledH) / 2
            });
        }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handlePointerUp = () => {
        setIsDragging(false);
    };

    const handleSave = async () => {
        if (!imageRef.current) return;

        // Output dimension (e.g. 800x800 for high quality)
        const outputSize = 800;
        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize / aspectRatio;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // We need to map the visible area in the container to the image source pixels
        // The container is the "viewport"

        // 1. Calculate the relative position of the image inside the container
        // position.x, position.y is the top-left of the image relative to container top-left
        // scale is current render scale

        // We want to draw the portion of the image that overlaps with the container (0,0, cw, ch)
        // The image logic is:
        // displayed_x = position.x
        // displayed_y = position.y
        // displayed_width = naturalWidth * scale
        // displayed_height = naturalHeight * scale

        // In Canvas drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
        // dx, dy, dw, dh is the destination on canvas (0, 0, outputSize, outputSize)
        // We need sx, sy, sw, sh (source rectangle)

        // Relation:
        // container_pixel / scale = source_pixel
        // source_x = (container_x - position.x) / scale

        const sourceX = (0 - position.x) / scale;
        const sourceY = (0 - position.y) / scale;
        const sourceW = containerSize.width / scale;
        const sourceH = containerSize.height / scale;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw
        ctx.drawImage(
            imageRef.current,
            sourceX, sourceY, sourceW, sourceH, // source crop
            0, 0, canvas.width, canvas.height   // dest
        );

        canvas.toBlob((blob) => {
            if (blob) onSave(blob);
        }, 'image/jpeg', 0.9);
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 text-white rounded-lg overflow-hidden">
            <div className="p-4 flex justify-between items-center border-b border-slate-800">
                <h3 className="text-lg font-medium">Edit Image</h3>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={onCancel} className="text-slate-400 hover:text-white">
                        <X className="w-4 h-4 mr-2" /> Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                        <Check className="w-4 h-4 mr-2" /> Save Crop
                    </Button>
                </div>
            </div>

            {/* Cropper Area */}
            <div className="flex-1 relative bg-black flex items-center justify-center p-8 overflow-hidden select-none">
                {/* The viewport mask - fixed size (responsive but maintains aspect ratio) */}
                <div
                    ref={containerRef}
                    className="relative w-full max-w-[500px] aspect-square border-2 border-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] cursor-move touch-none z-10 overflow-hidden"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                >
                    <img
                        ref={imageRef}
                        src={imageSrc}
                        crossOrigin="anonymous"
                        onLoad={onImageLoad}
                        alt="Crop target"
                        className="absolute max-w-none transform-gpu will-change-transform"
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                            transformOrigin: '0 0',
                        }}
                        draggable={false}
                    />

                    {/* Grid Overlay */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                        <div className="border-r border-b border-white/20"></div>
                        <div className="border-r border-b border-white/20"></div>
                        <div className="border-b border-white/20"></div>
                        <div className="border-r border-b border-white/20"></div>
                        <div className="border-r border-b border-white/20"></div>
                        <div className="border-b border-white/20"></div>
                        <div className="border-r border-white/20"></div>
                        <div className="border-r border-white/20"></div>
                        <div></div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-4 justify-center">
                <ZoomOut className="w-5 h-5 text-slate-400" />
                <input
                    type="range"
                    min={0.1}
                    max={3}
                    step={0.01}
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-[200px] accent-white"
                />
                <ZoomIn className="w-5 h-5 text-slate-400" />

                <div className="ml-4 text-xs text-slate-500 flex items-center gap-2">
                    <Move className="w-3 h-3" /> Drag image to position
                </div>
            </div>
        </div>
    );
}
