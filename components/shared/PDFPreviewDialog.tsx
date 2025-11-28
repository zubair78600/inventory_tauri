import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

interface PDFPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    url: string | null;
    fileName: string;
}

export function PDFPreviewDialog({ open, onOpenChange, url, fileName }: PDFPreviewDialogProps) {
    if (!url) return null;

    const handleDownload = async () => {
        try {
            if (!url) return;

            // Fetch the blob
            const response = await fetch(url);
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(buffer);

            // Open save dialog
            const filePath = await save({
                defaultPath: fileName,
                filters: [{
                    name: 'PDF',
                    extensions: ['pdf']
                }]
            });

            if (filePath) {
                await writeFile(filePath, uint8Array);
            }
        } catch (error) {
            console.error('Error saving PDF:', error);
            alert('Failed to save PDF');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
                <DialogHeader className="px-4 py-2 border-b flex flex-row items-center justify-between bg-slate-50 dark:bg-slate-900">
                    <div className="flex flex-col gap-1">
                        <DialogTitle className="text-sm font-medium">PDF Preview: {fileName}</DialogTitle>
                        <DialogDescription className="sr-only">
                            Preview of the generated PDF document. Use the download button to save it.
                        </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDownload}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="h-8 w-8 p-0"
                        >
                            <X className="w-4 h-4" />
                            <span className="sr-only">Close</span>
                        </Button>
                    </div>
                </DialogHeader>
                <div className="flex-1 w-full h-full bg-slate-100 dark:bg-slate-950 p-4">
                    <iframe
                        src={url}
                        className="w-full h-full rounded-md border shadow-sm bg-white"
                        title="PDF Preview"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
