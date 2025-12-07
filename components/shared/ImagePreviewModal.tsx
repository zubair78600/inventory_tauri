'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Crop, Upload } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { imageCommands } from '@/lib/tauri';
import { ImageCropper } from './ImageCropper';
import { EntityType } from './EntityThumbnail';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface EntityImagePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: number;
  entityType?: EntityType;
  entityName: string;
  onImageUpdate?: (newPath: string) => void;
}

export function EntityImagePreviewModal({
  open,
  onOpenChange,
  entityId,
  entityType = 'product',
  entityName,
  onImageUpdate,
}: EntityImagePreviewModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editImageSrc, setEditImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setImageSrc(null);
      setError(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    const fetchImage = async () => {
      try {
        let path: string | null = null;
        switch (entityType) {
          case 'product':
            path = await imageCommands.getProductImagePath(entityId, false);
            break;
          case 'supplier':
            path = await imageCommands.getSupplierImagePath(entityId, false);
            break;
          case 'customer':
            path = await imageCommands.getCustomerImagePath(entityId, false);
            break;
        }

        if (mounted && path) {
          setImageSrc(convertFileSrc(path) + '?t=' + Date.now());
        } else if (mounted) {
          setError('No image found');
        }
      } catch (err) {
        if (mounted) setError(String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchImage();

    return () => {
      mounted = false;
    };
  }, [open, entityId, entityType]);

  const handleStartEdit = async () => {
    if (entityType !== 'product') return; // Only products supported for now

    setLoading(true);
    try {
      const path = await imageCommands.getOriginalImagePath(entityId);
      if (path) {
        // Fetch as blob to prevent canvas tainting (CORS issues with asset://)
        const assetUrl = convertFileSrc(path);
        const response = await fetch(assetUrl);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        setEditImageSrc(objectUrl);
        setIsEditing(true);
      } else {
        setError("Could not load original image for editing");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCrop = async (blob: Blob) => {
    if (entityType !== 'product') return;

    setLoading(true);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));
      // Saving as jpg for consistency/simplicity, or could detect
      await imageCommands.saveCroppedImage(entityId, bytes, 'jpg');

      // Refresh component
      setIsEditing(false);
      // Clean up object URL if it exists
      if (editImageSrc) {
        URL.revokeObjectURL(editImageSrc);
        setEditImageSrc(null);
      }

      const newPath = await imageCommands.getProductImagePath(entityId, false);
      if (newPath) {
        setImageSrc(convertFileSrc(newPath) + '?t=' + Date.now());
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };


  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));
      const extension = file.name.split('.').pop() || 'jpg';

      let newPath: string | null = null;

      switch (entityType) {
        case 'product':
          newPath = await imageCommands.saveProductImage(entityId, bytes, extension);
          break;
        case 'supplier':
          newPath = await imageCommands.saveSupplierImage(entityId, bytes, extension);
          break;
        case 'customer':
          newPath = await imageCommands.saveCustomerImage(entityId, bytes, extension);
          break;
      }

      if (newPath) {
        setImageSrc(convertFileSrc(newPath) + '?t=' + Date.now());
        if (onImageUpdate) {
          onImageUpdate(newPath);
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden bg-slate-950 border-slate-800 text-white">
        <DialogHeader className="p-4 pb-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="pr-8 truncate text-slate-100">{entityName}</DialogTitle>
            <DialogDescription className="sr-only">
              {isEditing ? `Crop your ${entityType} image` : `Preview full size ${entityType} image`}
            </DialogDescription>
          </div>
          {!isEditing && (
            <div className="flex items-center gap-2 mr-8">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                <Upload className="w-4 h-4 mr-2" />
                {imageSrc ? 'Change Photo' : 'Upload Photo'}
              </Button>
              {imageSrc && entityType === 'product' && (
                <Button size="sm" variant="outline" onClick={handleStartEdit} className="border-slate-700 hover:bg-slate-800 text-slate-300">
                  <Crop className="w-4 h-4 mr-2" /> Crop
                </Button>
              )}
            </div>
          )}
        </DialogHeader>
        <div className="relative flex items-center justify-center min-h-[300px] p-4 bg-slate-950">
          {isEditing && editImageSrc ? (
            <div className="w-full h-[60vh] min-h-[400px]">
              <ImageCropper
                imageSrc={editImageSrc}
                onCancel={() => setIsEditing(false)}
                onSave={handleSaveCrop}
              />
            </div>
          ) : (
            <>
              {loading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading image...</span>
                </div>
              )}
              {error && (
                <div className="text-muted-foreground text-center">
                  <p>Unable to load image</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}
              {!loading && !error && imageSrc && (
                <div className="relative w-full h-[70vh] min-h-[400px] flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc}
                    alt={entityName}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
