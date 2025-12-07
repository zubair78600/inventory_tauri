'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Search,
  Trash2,
  Loader2,
  AlertCircle,
  ExternalLink,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ProductThumbnail } from './ProductThumbnail';
import { imageCommands, settingsCommands, GoogleImageResult } from '@/lib/tauri';
import { cn } from '@/lib/utils';

interface ProductImageUploadProps {
  productId: number | null; // null for new products (will upload after creation)
  productName: string;
  imagePath: string | null;
  onImageChange?: (newPath: string | null) => void;
  className?: string;
  // New props for deferred upload (Add Product mode)
  onFileSelect?: (file: File) => void;
  onImageSelect?: (url: string) => void; // For Google Image URL
  previewUrl?: string | null; // To show preview before saved
  onPreviewClick?: () => void;
}

export function ProductImageUpload({
  productId,
  productName,
  imagePath,
  onImageChange,
  className,
  onFileSelect,
  onImageSelect,
  previewUrl,
  onPreviewClick
}: ProductImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localImagePath, setLocalImagePath] = useState(imagePath);
  const [uploading, setUploading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(productName || '');
  const [searchResults, setSearchResults] = useState<GoogleImageResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasGoogleApi, setHasGoogleApi] = useState<boolean | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check if Google API is configured
  useEffect(() => {
    settingsCommands.get('google_api_key').then((key) => {
      setHasGoogleApi(!!key);
    });
  }, []);

  // Sync with prop changes
  useEffect(() => {
    setLocalImagePath(imagePath);
  }, [imagePath]);

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Deferred mode: Pass file to parent
    if (onFileSelect) {
      onFileSelect(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (!productId) return;

    setError(null);
    setUploading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileData = Array.from(new Uint8Array(arrayBuffer));
      const extension = file.name.split('.').pop() || 'jpg';

      const newPath = await imageCommands.saveProductImage(productId, fileData, extension);
      setLocalImagePath(newPath);
      setRefreshKey(k => k + 1); // Force thumbnail refresh
      onImageChange?.(newPath);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle Google image search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setError(null);
    setSearching(true);
    setSearchResults([]);

    try {
      const results = await imageCommands.searchGoogleImages(searchQuery.trim(), 10);
      setSearchResults(results);
      if (results.length === 0) {
        setError('No images found. Try a different search term.');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSearching(false);
    }
  };

  // Handle selecting an image from search results
  const handleSelectImage = async (result: GoogleImageResult) => {
    // Deferred mode: Pass URL to parent
    if (onImageSelect) {
      onImageSelect(result.link);
      setSearchOpen(false);
      setSearchResults([]);
      return;
    }

    if (!productId) return;

    setError(null);
    setDownloadingUrl(result.link);

    try {
      const newPath = await imageCommands.downloadProductImage(productId, result.link);
      setLocalImagePath(newPath);
      setRefreshKey(k => k + 1); // Force thumbnail refresh
      onImageChange?.(newPath);
      setSearchOpen(false);
      setSearchResults([]);
    } catch (err) {
      setError(`Failed to download: ${err}`);
    } finally {
      setDownloadingUrl(null);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    // If in deferred mode with preview, just clear it
    if (previewUrl && onImageSelect) {
      onImageSelect(''); // clear
      return;
    }

    if (!productId) return;

    setError(null);

    try {
      await imageCommands.deleteProductImage(productId);
      setLocalImagePath(null);
      setRefreshKey(k => k + 1); // Force thumbnail refresh
      onImageChange?.(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const isDisabled = !productId && !onFileSelect; // Enabled if productId exists or if callback provided

  return (
    <div className={cn('space-y-3', className)}>
      {/* Current thumbnail and action buttons */}
      <div className="flex items-start gap-4">
        {previewUrl ? (
          <div
            className="relative flex items-center justify-center rounded-md overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all border border-slate-200"
            style={{ width: 80, height: 80 }}
            onClick={onPreviewClick}
          >
            <img src={previewUrl} alt="Preview" className="object-cover w-full h-full" />
          </div>
        ) : (
          <ProductThumbnail
            productId={productId || 0}
            imagePath={localImagePath}
            size="lg"
            refreshKey={refreshKey}
            onClick={onPreviewClick}
          />
        )}
        <div className="flex flex-col gap-2">
          {/* Upload button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDisabled || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload Photo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.webp"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Search Google button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDisabled || hasGoogleApi === false}
            onClick={() => {
              setSearchQuery(productName || '');
              setSearchResults([]);
              setError(null);
              setSearchOpen(true);
            }}
          >
            <Search className="h-4 w-4 mr-2" />
            Search Google
          </Button>

          {/* Delete button (only show if image exists) */}
          {localImagePath && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isDisabled}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Warnings */}
      {isDisabled && (
        <p className="text-xs text-muted-foreground">
          Save the product first to upload an image.
        </p>
      )}
      {hasGoogleApi === false && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Google Image Search not configured. Add API key in Settings.
        </p>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Google Image Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Search Google Images</DialogTitle>
          </DialogHeader>

          {/* Search input */}
          <div className="flex gap-2">
            <Input
              placeholder="Search for product images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Error in dialog */}
          {error && (
            <div className="flex items-center gap-2 p-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Results grid */}
          <div className="flex-1 overflow-y-auto min-h-[200px]">
            {searching ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
                {searchResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'relative group border rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all',
                      downloadingUrl === result.link && 'ring-2 ring-primary'
                    )}
                    onClick={() => handleSelectImage(result)}
                  >
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      <img
                        src={result.thumbnail_link}
                        alt={result.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {downloadingUrl === result.link && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white truncate">{result.display_link}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {searchQuery ? 'No results. Try searching.' : 'Enter a search term to find images.'}
              </div>
            )}
          </div>

          <DialogFooter className="text-xs text-muted-foreground">
            Results from Google Custom Search API
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
