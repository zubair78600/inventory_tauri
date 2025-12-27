'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, Truck, Users } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { imageCommands } from '@/lib/tauri';
import { cn } from '@/lib/utils';

export type EntityType = 'product' | 'supplier' | 'customer';

interface EntityThumbnailProps {
  entityId: number;
  entityType?: EntityType;
  imagePath: string | null;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e?: React.MouseEvent) => void;
  className?: string;
  refreshKey?: number;
  showPlaceholderBorder?: boolean;
}

const sizeMap = {
  sm: 40,
  md: 80,
  lg: 120,
};

export function EntityThumbnail({
  entityId,
  entityType = 'product',
  imagePath,
  size = 'md',
  onClick,
  className,
  refreshKey = 0,
  showPlaceholderBorder = false,
}: EntityThumbnailProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const pixelSize = sizeMap[size];

  const loadImage = useCallback(async () => {
    if (!imagePath || !entityId) {
      setImageSrc(null);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      let path: string | null = null;

      const useThumbnail = size !== 'lg';

      switch (entityType) {
        case 'product':
          path = await imageCommands.getProductImagePath(entityId, useThumbnail);
          break;
        case 'supplier':
          path = await imageCommands.getSupplierImagePath(entityId, useThumbnail);
          break;
        case 'customer':
          path = await imageCommands.getCustomerImagePath(entityId, useThumbnail);
          break;
      }

      // console.log(`[EntityThumbnail] ${entityType} ${entityId}, ImagePath:`, path);
      if (path) {
        const url = convertFileSrc(path) + '?t=' + Date.now();
        setImageSrc(url);
      } else {
        setImageSrc(null);
      }
    } catch (err) {
      console.error(`[EntityThumbnail] Error loading image for ${entityType} ${entityId}:`, err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [entityId, imagePath, entityType, size]);

  useEffect(() => {
    loadImage();
  }, [loadImage, refreshKey]);

  const containerStyles = cn(
    'relative flex items-center justify-center rounded-md overflow-hidden bg-muted transition-all',
    (!imagePath && showPlaceholderBorder) && 'border-2 border-slate-400 dark:border-slate-600',
    onClick && 'cursor-pointer hover:ring-2 hover:ring-primary/50',
    className
  );

  const getPlaceholderIcon = () => {
    const iconSize = pixelSize * 0.5;
    const style = { width: iconSize, height: iconSize };
    const iconClass = "text-muted-foreground/40";

    switch (entityType) {
      case 'supplier': return <Truck className={iconClass} style={style} />;
      case 'customer': return <Users className={iconClass} style={style} />;
      default: return <Package className={iconClass} style={style} />;
    }
  };

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
        {getPlaceholderIcon()}
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
        alt={`${entityType} thumbnail`}
        className="object-cover w-full h-full"
        onError={(e) => {
          console.error(`[EntityThumbnail] Failed to load image: ${imageSrc}`, e);
          setError(true);
        }}
      />
    </div>
  );
}
