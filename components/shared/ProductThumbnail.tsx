'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { imageCommands } from '@/lib/tauri';
import { cn } from '@/lib/utils';

interface ProductThumbnailProps {
  productId: number;
  imagePath: string | null;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e?: React.MouseEvent) => void;
  className?: string;
  refreshKey?: number; // Optional key to force refresh
}

const sizeMap = {
  sm: 40,
  md: 80,
  lg: 120,
};

export function ProductThumbnail({
  productId,
  imagePath,
  size = 'md',
  onClick,
  className,
  refreshKey = 0,
}: ProductThumbnailProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const pixelSize = sizeMap[size];

  const loadImage = useCallback(async () => {
    if (!imagePath || !productId) {
      setImageSrc(null);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const path = await imageCommands.getProductImagePath(productId, true);
      console.log(`[ProductThumbnail] Product ${productId}, ImagePath:`, path);
      if (path) {
        // Add cache-busting timestamp to force image reload
        const url = convertFileSrc(path) + '?t=' + Date.now();
        console.log(`[ProductThumbnail] Converted URL:`, url);
        setImageSrc(url);
      } else {
        console.log(`[ProductThumbnail] No path returned for product ${productId}`);
        setImageSrc(null);
      }
    } catch (err) {
      console.error(`[ProductThumbnail] Error loading image for product ${productId}:`, err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [productId, imagePath]);

  useEffect(() => {
    loadImage();
  }, [loadImage, refreshKey]);

  const containerStyles = cn(
    'relative flex items-center justify-center rounded-md overflow-hidden bg-muted',
    onClick && 'cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all',
    className
  );

  if (loading) {
    return (
      <div
        className={containerStyles}
        style={{ width: pixelSize, height: pixelSize }}
      >
        <div className="animate-pulse bg-muted-foreground/20 w-full h-full" />
      </div>
    );
  }

  if (!imagePath || error || !imageSrc) {
    return (
      <div
        className={containerStyles}
        style={{ width: pixelSize, height: pixelSize }}
        onClick={onClick}
      >
        <Package
          className="text-muted-foreground/40"
          style={{
            width: pixelSize * 0.5,
            height: pixelSize * 0.5,
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={containerStyles}
      style={{ width: pixelSize, height: pixelSize }}
      onClick={onClick}
    >
      <img
        src={imageSrc}
        alt="Product"
        className="object-cover w-full h-full"
        onError={(e) => {
          console.error(`[ProductThumbnail] Failed to load image: ${imageSrc}`, e);
          setError(true);
        }}
      />
    </div>
  );
}
