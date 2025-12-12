'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { aiChatApi, type DownloadProgress as DownloadProgressType } from '@/lib/ai-chat';

interface DownloadProgressProps {
    onComplete: () => void;
    onCancel: () => void;
}

export function DownloadProgress({ onComplete, onCancel }: DownloadProgressProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState<DownloadProgressType | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Poll progress while downloading
    useEffect(() => {
        if (!isDownloading) return;

        const interval = setInterval(async () => {
            const progressData = await aiChatApi.getDownloadProgress();
            if (progressData) {
                setProgress(progressData);

                if (progressData.status === 'complete') {
                    setIsDownloading(false);
                    onComplete();
                } else if (progressData.status === 'error') {
                    setIsDownloading(false);
                    setError('Download failed. Please try again.');
                } else if (progressData.status === 'cancelled') {
                    setIsDownloading(false);
                }
            }
        }, 500); // Poll every 500ms

        return () => clearInterval(interval);
    }, [isDownloading, onComplete]);

    const handleStartDownload = async () => {
        setIsDownloading(true);
        setError(null);
        try {
            await aiChatApi.downloadModel();
        } catch (err) {
            setError('Failed to start download');
            setIsDownloading(false);
        }
    };

    const handleCancel = async () => {
        await aiChatApi.cancelDownload();
        setIsDownloading(false);
        onCancel();
    };

    // Not started yet
    if (!isDownloading && !progress) {
        return (
            <div className="space-y-4 p-6 text-center">
                <Download className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                    <h3 className="font-semibold">AI Model Required</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Download the AI model (~2 GB) to enable chat features.
                    </p>
                </div>
                {error && (
                    <div className="flex items-center justify-center gap-2 text-sm text-red-500">
                        <AlertCircle className="h-4 w-4" />
                        <span>{error}</span>
                    </div>
                )}
                <Button onClick={handleStartDownload} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Download AI Model
                </Button>
            </div>
        );
    }

    // Downloading
    if (isDownloading && progress) {
        return (
            <div className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="font-medium">Downloading AI Model...</span>
                </div>

                <Progress value={progress.percentage} className="h-3" />

                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{progress.downloaded_gb} GB / {progress.total_gb} GB</span>
                    <span>{progress.speed_mbps} MB/s</span>
                </div>
                <div className="text-center text-xs text-muted-foreground">
                    {progress.percentage}% complete
                </div>

                <Button variant="outline" onClick={handleCancel} className="w-full">
                    <X className="mr-2 h-4 w-4" />
                    Cancel Download
                </Button>
            </div>
        );
    }

    // Complete
    if (progress?.status === 'complete') {
        return (
            <div className="space-y-4 p-6 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                <div>
                    <h3 className="font-semibold">Download Complete!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Initializing AI assistant...
                    </p>
                </div>
                <Loader2 className="h-6 w-6 mx-auto animate-spin" />
            </div>
        );
    }

    return null;
}
