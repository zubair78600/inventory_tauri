'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Send,
    Loader2,
    Sparkles,
    RefreshCw,
    X,
    Bot,
    User,
    ArrowRight,
    Search,
    ChevronRight,
    Maximize2,
    Minimize2,
    Minus,
    History,
    Settings,
    BarChart3,
    Table2,
    Download
} from 'lucide-react';
import { CustomerCard } from "./CustomerCard";
import { IdentityCard } from "./IdentityCard";
import { SupplierCard } from "./SupplierCard";
import {
    aiChatApi,
    type ChatMessage,
    type SetupStatus,
    generateMessageId,
    formatTime,
} from '@/lib/ai-chat';
import dynamic from 'next/dynamic';

// Lazy load recharts to avoid SSR issues and improve initial load
const LazyChart = dynamic(() => import('./ResultChart'), {
    ssr: false,
    loading: () => <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">Loading chart...</div>
});

import { cn } from '@/lib/utils';
import { settingsCommands } from '@/lib/tauri';
import { DownloadProgress } from './DownloadProgress';
import { TrainingFeedbackModal } from './TrainingFeedbackModal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';


interface AIChatDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const SUGGESTED_QUESTIONS = [
    "Show today's sales",
    "What products have low stock?",
    "List top 5 customers",
    "Total revenue this month",
];

export function AIChatDialog({ open, onOpenChange }: AIChatDialogProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<SetupStatus | null>(null);
    const [isServerReady, setIsServerReady] = useState(false);
    const [isStartingServer, setIsStartingServer] = useState(false);
    const [showTrainingModal, setShowTrainingModal] = useState(false);
    const [failedQuery, setFailedQuery] = useState<{ question: string; sql: string } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sidecar download state
    const [sidecarDownloaded, setSidecarDownloaded] = useState<boolean | null>(null);
    const [isDownloadingSidecar, setIsDownloadingSidecar] = useState(false);
    const [sidecarProgress, setSidecarProgress] = useState<{ percentage: number; speed_mbps: number } | null>(null);

    // UI state
    type ViewState = 'minimized' | 'normal' | 'maximized';
    const [viewState, setViewState] = useState<ViewState>('normal');
    const [hasOldHistory, setHasOldHistory] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyOffset, setHistoryOffset] = useState(0);
    const [totalHistoryCount, setTotalHistoryCount] = useState(0);
    const [allHistoryMessages, setAllHistoryMessages] = useState<ChatMessage[]>([]);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Chat history folder and monthly file format
    const CHAT_HISTORY_FOLDER = 'AI/chat_history';
    const CHAT_FAILED_FOLDER = 'AI/chat_failed';
    const HISTORY_LOAD_BATCH = 20;

    const getMonthlyFileName = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.json`;
    };

    // Check if old history exists on mount
    useEffect(() => {
        const checkHistory = async () => {
            try {
                const { appDataDir, join } = await import('@tauri-apps/api/path');
                const { exists, readDir } = await import('@tauri-apps/plugin-fs');

                const appDir = await appDataDir();
                const historyFolder = await join(appDir, CHAT_HISTORY_FOLDER);

                if (await exists(historyFolder)) {
                    const files = await readDir(historyFolder);
                    setHasOldHistory(files.length > 0);
                }
            } catch (e) {
                console.error('Failed to check history:', e);
            }
        };
        checkHistory();
    }, []);

    // Load old history when user clicks "Load Previous Conversations"
    const loadOldHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const { appDataDir, join } = await import('@tauri-apps/api/path');
            const { readTextFile, readDir, exists } = await import('@tauri-apps/plugin-fs');

            const appDir = await appDataDir();
            const historyFolder = await join(appDir, CHAT_HISTORY_FOLDER);

            if (await exists(historyFolder)) {
                // If we haven't loaded all history yet, load it first
                if (allHistoryMessages.length === 0) {
                    const files = await readDir(historyFolder);
                    // Sort files by name descending (newest first)
                    const sortedFiles = files
                        .filter(f => f.name?.endsWith('.json'))
                        .sort((a, b) => (b.name || '').localeCompare(a.name || ''));

                    const loadedMessages: ChatMessage[] = [];
                    for (const file of sortedFiles) {
                        if (file.name) {
                            const filePath = await join(historyFolder, file.name);
                            const content = await readTextFile(filePath);
                            const parsed = JSON.parse(content);
                            if (Array.isArray(parsed)) {
                                loadedMessages.push(...parsed);
                            }
                        }
                    }

                    // Sort by timestamp descending (newest first) for pagination
                    loadedMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    setAllHistoryMessages(loadedMessages);
                    setTotalHistoryCount(loadedMessages.length);

                    // Load first batch
                    const firstBatch = loadedMessages.slice(0, HISTORY_LOAD_BATCH);
                    // Sort ascending for display (oldest first within batch)
                    firstBatch.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    setMessages(prev => [...firstBatch, ...prev.filter(m => !firstBatch.find(h => h.id === m.id))]);
                    setHistoryOffset(HISTORY_LOAD_BATCH);
                } else {
                    // Load next batch
                    const nextBatch = allHistoryMessages.slice(historyOffset, historyOffset + HISTORY_LOAD_BATCH);
                    if (nextBatch.length > 0) {
                        // Sort ascending for display
                        nextBatch.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        setMessages(prev => [...nextBatch, ...prev.filter(m => !nextBatch.find(h => h.id === m.id))]);
                        setHistoryOffset(prev => prev + HISTORY_LOAD_BATCH);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load history:', e);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // Save chat history to monthly file when messages change
    useEffect(() => {
        const saveHistory = async () => {
            if (messages.length > 0) {
                try {
                    const { appDataDir, join } = await import('@tauri-apps/api/path');
                    const { writeTextFile, mkdir, exists, readTextFile } = await import('@tauri-apps/plugin-fs');

                    const appDir = await appDataDir();
                    const historyFolder = await join(appDir, CHAT_HISTORY_FOLDER);

                    // Ensure chat_history folder exists
                    if (!(await exists(historyFolder))) {
                        await mkdir(historyFolder, { recursive: true });
                    }

                    const filePath = await join(historyFolder, getMonthlyFileName());

                    // Read existing history to merge with new messages
                    let existingMessages: ChatMessage[] = [];
                    if (await exists(filePath)) {
                        try {
                            const content = await readTextFile(filePath);
                            const parsed = JSON.parse(content);
                            if (Array.isArray(parsed)) {
                                existingMessages = parsed;
                            }
                        } catch {
                            // File might be corrupted, start fresh
                            existingMessages = [];
                        }
                    }

                    // Merge: add new messages, update existing ones by ID
                    const messageMap = new Map<string, ChatMessage>();

                    // Add existing messages first
                    for (const msg of existingMessages) {
                        if (msg.id) {
                            messageMap.set(msg.id, msg);
                        }
                    }

                    // Add/update with current session messages
                    for (const msg of messages) {
                        if (msg.id) {
                            messageMap.set(msg.id, msg);
                        }
                    }

                    // Convert back to array and sort by timestamp
                    const mergedMessages = Array.from(messageMap.values())
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                    await writeTextFile(filePath, JSON.stringify(mergedMessages, null, 2));
                    setHasOldHistory(true);
                } catch (e) {
                    console.error('Failed to save chat history:', e);
                }
            }
        };
        saveHistory();
    }, [messages]);


    // Check sidecar status on open
    useEffect(() => {
        if (open) {
            checkSidecarStatus();
        }
    }, [open]);

    const checkSidecarStatus = async () => {
        try {
            const downloaded = await aiChatApi.checkSidecarDownloaded();
            setSidecarDownloaded(downloaded);
            if (downloaded) {
                // Try to connect to existing server or start it
                const { healthy } = await aiChatApi.healthCheck();
                if (healthy) {
                    await checkServerStatus();
                } else {
                    // Server not running, start it
                    await startServer();
                }
            }
        } catch {
            setSidecarDownloaded(false);
        }
    };

    const handleDownloadSidecar = async () => {
        setIsDownloadingSidecar(true);
        try {
            // Listen for progress events
            const { listen } = await import('@tauri-apps/api/event');
            const unlisten = await listen<{ percentage: number; speed_mbps: number }>('sidecar-download-progress', (event) => {
                setSidecarProgress(event.payload);
            });

            await aiChatApi.downloadSidecar();
            unlisten();

            setSidecarDownloaded(true);
            setSidecarProgress(null);

            // Start the server after download completes
            await startServer();
        } catch (error) {
            console.error('Failed to download sidecar:', error);
        } finally {
            setIsDownloadingSidecar(false);
        }
    };

    // Check server status and focus input
    useEffect(() => {
        if (open && sidecarDownloaded && viewState !== 'minimized') {
            setTimeout(() => inputRef.current?.focus(), 500);
        }
    }, [open, sidecarDownloaded, viewState]);

    // Periodic health check - auto-reconnect if disconnected
    useEffect(() => {
        if (!open || !sidecarDownloaded) return;

        const healthCheckInterval = setInterval(async () => {
            try {
                const { healthy } = await aiChatApi.healthCheck();
                if (healthy && !isServerReady) {
                    // Server came back online
                    setIsServerReady(true);
                    const setupStatus = await aiChatApi.getStatus();
                    setStatus(setupStatus);
                } else if (!healthy && isServerReady) {
                    // Server went offline - try to restart
                    setIsServerReady(false);
                    console.log('Server disconnected, attempting auto-reconnect...');
                    // Don't auto-restart here, just update UI state
                }
            } catch {
                if (isServerReady) {
                    setIsServerReady(false);
                }
            }
        }, 5000); // Check every 5 seconds

        return () => clearInterval(healthCheckInterval);
    }, [open, sidecarDownloaded, isServerReady]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    const checkServerStatus = useCallback(async () => {
        try {
            const { healthy, ready } = await aiChatApi.healthCheck();
            setIsServerReady(healthy);

            if (healthy) {
                // Always get full status from server if it's running
                // This ensures we detect if model exists even if it failed to load (ready=false)
                const setupStatus = await aiChatApi.getStatus();
                setStatus(setupStatus);
            }
        } catch {
            setIsServerReady(false);
        }
    }, []);

    const [backendLogs, setBackendLogs] = useState<string[]>([]);

    useEffect(() => {
        const unlistenOutput = listen('ai-sidecar-output', (event: any) => {
            setBackendLogs(prev => [...prev, `[INFO] ${event.payload}`].slice(-50));
        });
        const unlistenError = listen('ai-sidecar-error', (event: any) => {
            setBackendLogs(prev => [...prev, `[ERROR] ${event.payload}`].slice(-50));
        });

        return () => {
            unlistenOutput.then(f => f());
            unlistenError.then(f => f());
        };
    }, []);

    const startServer = async () => {
        setIsStartingServer(true);
        setBackendLogs([]); // Clear logs on start
        try {
            // Check if server is already running but just needs model init
            const health = await aiChatApi.healthCheck();
            if (health.healthy && !health.ready) {
                console.log('Server running but model not ready - triggering initialization...');
                const initResult = await aiChatApi.initializeModel();
                if (initResult.success) {
                    await checkServerStatus();
                    return;
                } else {
                    console.error('Initialization failed:', initResult.error);
                    // Fallthrough to full restart if init failed
                }
            }

            await aiChatApi.startSidecar();

            // Poll for server readiness (up to 45 seconds - model loading takes ~30s)
            let retries = 0;
            const maxRetries = 45;
            while (retries < maxRetries) {
                try {
                    const { healthy } = await aiChatApi.healthCheck();
                    if (healthy) {
                        break;
                    }
                } catch (e) {
                    // Ignore error and retry
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
                retries++;
            }

            await checkServerStatus();
        } catch (error) {
            const errorMsg = String(error);
            if (errorMsg.includes("Corrupt sidecar") || errorMsg.includes("not downloaded")) {
                alert(errorMsg);
                setSidecarDownloaded(false);
                return;
            }

            // Dev mode fallback - check if server is already running externally
            console.log('Dev mode: checking manual server...');
            const { healthy } = await aiChatApi.healthCheck();
            if (healthy) {
                setIsServerReady(true);
                const setupStatus = await aiChatApi.getStatus();
                setStatus(setupStatus);
            } else {
                alert('AI Server not running.\n\nLogs:\n' + backendLogs.join('\n'));
            }
        } finally {
            setIsStartingServer(false);
        }
    };



    /**
     * Checks if the user's input matches a local pattern (Greetings, Identity).
     * Returns a simulated QueryResult if matched, or null otherwise.
     */
    const checkLocalResponse = async (text: string): Promise<any | null> => {
        const q_clean = text.toLowerCase().replace(/[!?.,]/g, '').trim();

        // --- 1. Identity Check ---
        const identityPatterns = ['who are you', 'what are you', 'who is this', 'introduce yourself', 'tell me about yourself', 'your identity', 'hu who are you', 'who r u', 'hu are you'];
        if (identityPatterns.some(p => q_clean.includes(p))) {
            try {
                // Fetch settings locally
                const settings = await settingsCommands.getAll();
                return {
                    success: true,
                    sql: "IDENTITY:LOCAL_OVERRIDE", // Marker
                    results: [{
                        type: 'identity',
                        company_name: settings['company_name'] || 'Inventory Intelligence',
                        address: settings['company_address'] || '',
                        phone: settings['company_phone'] || '',
                        email: settings['company_email'] || '',
                        message: `I'm the AI assistant for **${settings['company_name'] || 'Inventory Intelligence'}**. I can help you with inventory queries, customer information, sales analytics, and more.`
                    }],
                    sql_extraction_time_ms: 0,
                    execution_time_ms: 0,
                    total_time_ms: 0
                };
            } catch (e) {
                console.error("Failed to fetch settings for identity:", e);
                // Fallback if settings fail
                return {
                    success: true,
                    results: [{
                        type: 'identity',
                        company_name: 'Inventory Intelligence',
                        message: "I'm your AI Inventory Assistant."
                    }],
                    sql: "IDENTITY:FALLBACK",
                    sql_extraction_time_ms: 0, execution_time_ms: 0, total_time_ms: 0
                };
            }
        }

        // --- 2. Greeting Check ---
        const greetingPatterns = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'hola', 'hu'];
        // Check exact match or starts with greeting + space
        if (greetingPatterns.includes(q_clean) || greetingPatterns.some(g => q_clean.startsWith(g + ' '))) {
            return {
                success: true,
                sql: "CONVERSATIONAL:LOCAL",
                results: [{
                    message: "Hello! How can I help you today? You can ask me about products, customers, suppliers, invoices, or sales analytics."
                }],
                sql_extraction_time_ms: 0,
                execution_time_ms: 0,
                total_time_ms: 0
            };
        }

        return null;
    };

    const handleSend = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: generateMessageId(),
            role: 'user',
            content: text.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        setIsLoading(true);

        try {
            // 1. Check Local Response (Frontend Interception)
            const localResponse = await checkLocalResponse(userMessage.content);

            let response;
            if (localResponse) {
                console.log("Using local response:", localResponse);
                response = localResponse;
                // Add a small artificial delay for realism (optional, but feels better)
                await new Promise(r => setTimeout(r, 600));
            } else {
                // 2. Fallback to Backend API
                response = await aiChatApi.query(userMessage.content);
            }

            const assistantMessage: ChatMessage = {
                id: generateMessageId(),
                role: 'assistant',
                content: response.success
                    ? (response.results.length === 1 && response.results[0]?.message !== undefined
                        ? '' // Conversational response - message shown in dedicated section
                        : `Found ${response.results.length} result(s)`)
                    : response.error || 'An error occurred',
                timestamp: new Date(),
                sql: response.sql,
                results: response.results,
                timing: {
                    sqlGen: response.sql_extraction_time_ms,
                    sqlRun: response.execution_time_ms,
                    total: response.total_time_ms,
                },
                error: response.error || undefined,
            };
            setMessages((prev) => [...prev, assistantMessage]);

            // Auto-save failed queries OR 0 results to chat_failed folder
            if (!response.success && response.sql) {
                saveFailedQuery(userMessage.content, response.sql, response.error || undefined);
            } else if (response.success && response.results.length === 0 && response.sql) {
                // Also save queries that returned 0 results for training improvement
                saveFailedQuery(userMessage.content, response.sql, 'Query returned 0 results');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            const errorMessage: ChatMessage = {
                id: generateMessageId(),
                role: 'assistant',
                content: 'Failed to process query. Please try again.',
                timestamp: new Date(),
                error: errorMsg,
            };
            setMessages((prev) => [...prev, errorMessage]);
            // Save failed query
            saveFailedQuery(userMessage.content, '', errorMsg);
        } finally {
            setIsLoading(false);
            // Keep focus on input after sending (only if not minimized)
            if (viewState !== 'minimized') {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    };

    // Save failed query to chat_failed folder
    const saveFailedQuery = async (question: string, sql: string, error?: string) => {
        try {
            const { appDataDir, join } = await import('@tauri-apps/api/path');
            const { writeTextFile, mkdir, exists, readTextFile } = await import('@tauri-apps/plugin-fs');

            const appDir = await appDataDir();
            const failedFolder = await join(appDir, CHAT_FAILED_FOLDER);

            // Ensure chat_failed folder exists
            if (!(await exists(failedFolder))) {
                await mkdir(failedFolder, { recursive: true });
            }

            // Use monthly file format like chat_history
            const fileName = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}.json`;
            const filePath = await join(failedFolder, fileName);

            // Load existing failed queries
            let existingData: Array<{ question: string; sql: string; error?: string; timestamp: string }> = [];
            if (await exists(filePath)) {
                try {
                    const content = await readTextFile(filePath);
                    existingData = JSON.parse(content);
                } catch {
                    existingData = [];
                }
            }

            // Add new failed query
            existingData.push({
                question,
                sql,
                error,
                timestamp: new Date().toISOString()
            });

            await writeTextFile(filePath, JSON.stringify(existingData, null, 2));
        } catch (e) {
            console.error('Failed to save failed query:', e);
        }
    };

    const handleImproveQuery = (question: string, sql: string) => {
        setFailedQuery({ question, sql });
        setShowTrainingModal(true);
        // Save to chat_failed folder
        saveFailedQuery(question, sql);
    };

    // Render Sidecar Download UI if needed
    if (open && sidecarDownloaded === false) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px] border-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl rounded-2xl">
                    <DialogTitle className="flex items-center gap-2 text-xl font-light">
                        <Sparkles className="h-6 w-6 text-sky-500" />
                        Setting up AI Backend
                    </DialogTitle>
                    <DialogDescription className="text-center text-muted-foreground">
                        Configure and download necessary AI components
                    </DialogDescription>
                    <div className="space-y-4 p-6 text-center">
                        {!isDownloadingSidecar && !sidecarProgress && (
                            <>
                                <div className="h-12 w-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <Bot className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">AI Backend Required</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Download the AI backend (~84 MB) to enable chat features.
                                    </p>
                                </div>
                                <button
                                    onClick={handleDownloadSidecar}
                                    className="w-full px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    Download AI Backend
                                </button>
                            </>
                        )}
                        {isDownloadingSidecar && sidecarProgress && (
                            <>
                                <div className="flex items-center gap-3">
                                    <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
                                    <span className="font-medium">Downloading AI Backend...</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                                    <div
                                        className="bg-sky-500 h-3 rounded-full transition-all"
                                        style={{ width: `${sidecarProgress.percentage}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>{sidecarProgress.percentage.toFixed(1)}%</span>
                                    <span>{sidecarProgress.speed_mbps.toFixed(1)} MB/s</span>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // Render Model Download if sidecar ready but model not downloaded
    // OR show error if model exists but is corrupted
    if (open && status && !status.model_downloaded) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className={cn(
                    "border-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl transition-all duration-300",
                    viewState === 'minimized'
                        ? "fixed bottom-6 right-6 w-80 h-auto rounded-xl p-4"
                        : "sm:max-w-[500px] rounded-2xl"
                )}>
                    <div className="flex items-center justify-between mb-4">
                        <DialogTitle className="flex items-center gap-2 text-xl font-light">
                            <Sparkles className="h-6 w-6 text-sky-500" />
                            {viewState === 'minimized' ? "Downloading..." : "Setting up AI Model"}
                        </DialogTitle>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setViewState(viewState === 'minimized' ? 'normal' : 'minimized')}
                                className="h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-slate-600 dark:text-slate-300 hover:text-foreground"
                                title={viewState === 'minimized' ? "Expand" : "Minimize"}
                            >
                                {viewState === 'minimized' ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                            </button>
                            <button
                                onClick={() => onOpenChange(false)}
                                className="h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-slate-600 dark:text-slate-300 hover:text-foreground"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <DialogDescription className="hidden">
                        Downloading and configuring the AI model
                    </DialogDescription>

                    {viewState !== 'minimized' ? (
                        <DownloadProgress onComplete={async () => {
                            // Restart sidecar to load the newly downloaded model
                            try {
                                await aiChatApi.stopSidecar();
                            } catch {
                                // Ignore stop errors
                            }
                            await startServer();
                        }} onCancel={() => onOpenChange(false)} />
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Downloading in background...</span>
                            </div>
                            {/* Minimized progress bar - simplified */}
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                <motion.div
                                    className="h-full bg-sky-500"
                                    initial={{ width: "0%" }}
                                    animate={{ width: "100%" }} // This is a fake animation since we don't have progress props exposed here easily without refactoring DownloadProgress.
                                    transition={{ duration: 60, ease: "linear" }}
                                />
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        );
    }

    // Model exists but failed to initialize - show error with restart option
    if (open && status && status.model_downloaded && !status.ready) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px] border-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl rounded-2xl">
                    <DialogTitle className="flex items-center gap-2 text-xl font-light">
                        <Bot className="h-6 w-6 text-amber-500" />
                        AI Model Initialization
                    </DialogTitle>
                    <DialogDescription className="hidden">
                        AI model initialization status
                    </DialogDescription>
                    <div className="space-y-4 p-6 text-center">
                        {isStartingServer ? (
                            <>
                                <Loader2 className="h-12 w-12 mx-auto animate-spin text-sky-500" />
                                <div>
                                    <h3 className="font-semibold">Initializing AI Model...</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        This may take up to 30 seconds on first load.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="h-12 w-12 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                                    <Bot className="h-6 w-6 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Model Ready to Initialize</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {status.model_valid
                                            ? "Model file found. Click below to start the AI."
                                            : "Model file may be corrupted. Try restarting or re-download."}
                                    </p>
                                    {status.initialization_error && (
                                        <p className="text-xs text-red-500 mt-2 font-mono bg-red-50 dark:bg-red-900/20 rounded p-2">
                                            {status.initialization_error}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <button
                                        onClick={startServer}
                                        className="w-full px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        {status.model_valid ? "Start AI Server" : "Retry Initialization"}
                                    </button>
                                    {!status.model_valid && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    // Force delete and re-download via API
                                                    await aiChatApi.forceRedownload();
                                                    // Update status to show download UI
                                                    setStatus({
                                                        ...status,
                                                        model_downloaded: false,
                                                        model_valid: false
                                                    });
                                                } catch (e) {
                                                    console.error('Failed to force re-download:', e);
                                                }
                                            }}
                                            className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-medium transition-colors text-sm"
                                        >
                                            Re-download Model (~2 GB)
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className={cn(
                        "flex flex-col p-0 gap-0 border-white/20 bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300",
                        viewState === 'maximized'
                            ? "!max-w-[100vw] !w-[100vw] !h-[100vh] !rounded-none"
                            : "sm:max-w-[800px] w-full h-[650px] rounded-[40px]"
                    )}
                    onInteractOutside={(e) => {
                        // Prevent closing when clicking outside if minimized to prevent accidental loss
                        if (viewState === 'minimized') e.preventDefault();
                    }}
                >
                    <DialogDescription className="hidden">
                        AI Chat Interface to interact with inventory data
                    </DialogDescription>
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "px-6 py-4 flex items-center justify-between border-b border-black/5 dark:border-white/5 backdrop-blur-md z-10",
                            viewState === 'minimized'
                                ? "bg-white dark:bg-slate-900"
                                : "bg-white/50 dark:bg-black/20"
                        )}
                    >
                        <div className="flex-1 min-w-0">
                            <DialogTitle className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 flex-shrink-0">
                                    <Bot className="h-5 w-5 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <span className="font-semibold text-lg bg-gradient-to-r from-sky-600 to-indigo-600 dark:from-sky-400 dark:to-indigo-400 bg-clip-text text-transparent truncate block">
                                        Inventory Intelligence
                                    </span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className={`h-1.5 w-1.5 rounded-full ${isServerReady ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`} />
                                        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                                            {isServerReady ? 'Online' : 'Connecting...'}
                                        </span>
                                    </div>
                                </div>
                            </DialogTitle>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                            {/* Download Chats Button */}
                            <button
                                onClick={async () => {
                                    try {
                                        const { save } = await import('@tauri-apps/plugin-dialog');
                                        const { writeTextFile } = await import('@tauri-apps/plugin-fs');

                                        const filePath = await save({
                                            defaultPath: `chat_export_${new Date().toISOString().split('T')[0]}.json`,
                                            filters: [{ name: 'JSON', extensions: ['json'] }]
                                        });

                                        if (filePath) {
                                            const chatData = JSON.stringify(messages, null, 2);
                                            await writeTextFile(filePath, chatData);
                                        }
                                    } catch (error) {
                                        console.error('Failed to save chat:', error);
                                        alert('Failed to save chat: ' + String(error));
                                    }
                                }}
                                className="h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-slate-600 dark:text-slate-300 hover:text-foreground"
                                title="Download Chat History"
                            >
                                <Download className="h-4 w-4" />
                            </button>
                            {/* Toolbar buttons */}
                            <button
                                className="h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-slate-600 dark:text-slate-300 hover:text-foreground"
                                title="Settings"
                            >
                                <Settings className="h-4 w-4" />
                            </button>

                            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

                            {!isServerReady && (
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={startServer}
                                    disabled={isStartingServer}
                                    className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    {isStartingServer ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                    {isStartingServer ? 'Starting...' : 'Reconnect'}
                                </motion.button>
                            )}

                            <button
                                onClick={() => setViewState(viewState === 'maximized' ? 'normal' : 'maximized')}
                                className="h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-slate-600 dark:text-slate-300 hover:text-foreground"
                                title={viewState === 'maximized' ? "Restore" : "Maximize"}
                            >
                                {viewState === 'maximized' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </button>
                            <button
                                onClick={() => onOpenChange(false)}
                                className="h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-slate-600 dark:text-slate-300 hover:text-foreground"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </motion.div>

                    {/* Chat Area - Hidden when minimized */}
                    {viewState !== 'minimized' && (
                        <div className="flex-1 overflow-hidden relative bg-slate-50/50 dark:bg-slate-900/50">
                            <ScrollArea className="h-full px-6 pt-6 pb-4">
                                {/* Load History Button - show when there's history to load */}
                                {(hasOldHistory && historyOffset < totalHistoryCount) || (hasOldHistory && allHistoryMessages.length === 0) ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex justify-center mb-4"
                                    >
                                        <button
                                            onClick={loadOldHistory}
                                            disabled={isLoadingHistory}
                                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2 transition-colors shadow-sm"
                                        >
                                            {isLoadingHistory ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Loading...
                                                </>
                                            ) : (
                                                <>
                                                    <History className="h-4 w-4" />
                                                    {allHistoryMessages.length === 0
                                                        ? 'Load Previous Conversations'
                                                        : `Load ${Math.min(HISTORY_LOAD_BATCH, totalHistoryCount - historyOffset)} more (${totalHistoryCount - historyOffset} remaining)`
                                                    }
                                                </>
                                            )}
                                        </button>
                                    </motion.div>
                                ) : null}
                                {!isServerReady && !isStartingServer ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
                                        <Bot className="h-16 w-16 text-muted-foreground mb-4" />
                                        <h3 className="text-lg font-medium">Server Disconnected</h3>
                                        <p className="text-sm text-muted-foreground mt-2 max-w-md">
                                            The AI sidecar is not responding. Click "Reconnect" in the top right or check your backend logs.
                                        </p>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto"
                                    >
                                        <div className="mb-8 text-center space-y-2">
                                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-sky-500/10 to-indigo-600/10 flex items-center justify-center mx-auto mb-6 ring-1 ring-black/5">
                                                <Sparkles className="h-8 w-8 text-indigo-500" />
                                            </div>
                                            <h2 className="text-2xl font-light text-foreground">
                                                How can I help you today?
                                            </h2>
                                            <p className="text-muted-foreground">
                                                I can analyze your inventory, track sales, and generate reports instantly.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                                            {SUGGESTED_QUESTIONS.map((q, i) => (
                                                <motion.button
                                                    key={i}
                                                    whileHover={{ scale: 1.02, backgroundColor: "rgba(var(--primary), 0.05)" }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => handleSend(q)}
                                                    className="p-4 rounded-xl text-left bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all group"
                                                >
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                        {q}
                                                    </span>
                                                </motion.button>
                                            ))}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="space-y-6 pb-4">
                                        <AnimatePresence initial={false}>
                                            {messages.map((msg) => (
                                                <MessageBubble
                                                    key={msg.id}
                                                    message={msg}
                                                    onImprove={handleImproveQuery}
                                                    isCompact={viewState !== 'maximized'}
                                                />
                                            ))}
                                        </AnimatePresence>

                                        {isLoading && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex justify-start"
                                            >
                                                <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border border-black/5 flex items-center gap-2">
                                                    <div className="flex gap-1">
                                                        {[0, 1, 2].map(i => (
                                                            <motion.div
                                                                key={i}
                                                                className="h-1.5 w-1.5 rounded-full bg-indigo-500"
                                                                animate={{ y: [0, -5, 0] }}
                                                                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground font-medium">Thinking...</span>
                                                </div>
                                            </motion.div>
                                        )}
                                        <div ref={scrollRef} />
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    )}

                    {/* Input Area - Hidden when minimized */}
                    {viewState !== 'minimized' && (
                        <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-black/5 dark:border-white/5 z-20">
                            <div className="relative max-w-3xl mx-auto flex items-center gap-2">
                                <div className="relative flex-1">
                                    <input
                                        ref={inputRef}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                                        placeholder="Type a message..."
                                        disabled={isLoading || !isServerReady}
                                        className="w-full h-12 pl-12 pr-4 rounded-full bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-500/20 text-foreground placeholder:text-muted-foreground/60 shadow-inner transition-all"
                                    />
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        <Search className="h-5 w-5 opacity-50" />
                                    </div>
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleSend(input)}
                                    disabled={!input.trim() || isLoading}
                                    className={cn(
                                        "h-12 w-12 rounded-full flex items-center justify-center shadow-md transition-all",
                                        input.trim()
                                            ? "bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-indigo-500/25"
                                            : "bg-slate-200 dark:bg-slate-700 text-slate-400"
                                    )}
                                >
                                    <ArrowRight className="h-5 w-5" />
                                </motion.button>
                            </div>
                            <div className="text-center mt-2">
                                <p className="text-[10px] text-muted-foreground/60">
                                    AI can make mistakes. Check important info.
                                </p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {failedQuery && (
                <TrainingFeedbackModal
                    open={showTrainingModal}
                    onOpenChange={setShowTrainingModal}
                    question={failedQuery.question}
                    failedSql={failedQuery.sql}
                    onComplete={() => setShowTrainingModal(false)}
                />
            )}
        </>
    );
}

function MessageBubble({ message, onImprove, isCompact = false }: { message: ChatMessage; onImprove: (q: string, s: string) => void; isCompact?: boolean }) {
    const isUser = message.role === 'user';
    // SQL and Chart collapsed, Raw Data open by default
    const [showSql, setShowSql] = useState(false);
    const [showChart, setShowChart] = useState(false);
    const [showRawData, setShowRawData] = useState(true);

    const hasResults = Boolean(message.results && message.results.length > 0);
    // Check if results can be visualized as chart
    const hasChartableData = hasResults && !message.error;

    // Check if this is a card-type result (customer/supplier)
    const firstResult = message.results?.[0] as Record<string, any> | undefined;
    const isCardResult = Boolean(
        message.results &&
        message.results.length === 1 &&
        (firstResult?.name || firstResult?.NAME) &&
        (
            firstResult?.total_products !== undefined || firstResult?.TOTAL_PRODUCTS !== undefined || firstResult?.["TOTAL PRODUCTS"] !== undefined ||
            firstResult?.total_invoices !== undefined || firstResult?.TOTAL_INVOICES !== undefined || firstResult?.["TOTAL INVOICES"] !== undefined ||
            firstResult?.total_spent !== undefined || firstResult?.TOTAL_SPENT !== undefined || firstResult?.["TOTAL SPENT"] !== undefined
        )
    );

    // Check if this is an identity card
    const isIdentityCard = Boolean(
        message.results &&
        message.results.length === 1 &&
        (firstResult?.type === 'identity' || firstResult?.TYPE === 'identity')
    );

    // Check if this is a conversational response (e.g., greetings, identity questions)
    const isConversational = Boolean(
        message.results &&
        message.results.length === 1 &&
        firstResult?.message !== undefined
    );

    const isDataResult = hasResults && !isCardResult && !isConversational && !isIdentityCard;
    // Strict table sizes: 400px minimized, 750px maximized
    const assistantWidthClass = (isDataResult || isIdentityCard)
        ? (isCompact ? "w-[400px] max-w-[400px]" : "w-[750px] max-w-[750px]")
        : (isCompact ? "max-w-[50%] min-w-[200px]" : "max-w-[50%] min-w-[300px]");
    const defaultRowLimit = isCompact ? 50 : 100;
    const rowIncrement = isCompact ? 50 : 100;
    const [rowLimit, setRowLimit] = useState(defaultRowLimit);
    const [isDownloadingCSV, setIsDownloadingCSV] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    useEffect(() => {
        setRowLimit(defaultRowLimit);
    }, [defaultRowLimit, message.id]);

    const totalRows = message.results?.length ?? 0;
    const visibleRows = message.results ? message.results.slice(0, rowLimit) : [];
    const canShowMoreRows = totalRows > rowLimit;
    const canShowLessRows = rowLimit > defaultRowLimit;

    // Normalize data for specialized cards
    const normalizedData = firstResult ? {
        ...firstResult,
        name: firstResult.name || firstResult.NAME,
        phone: firstResult.phone || firstResult["CONTACT INFO"],
        total_spent: firstResult.total_spent || firstResult["TOTAL SPENT"],
        total_invoices: firstResult.total_invoices || firstResult["TOTAL INVOICES"],
        last_billed: firstResult.last_billed || firstResult["LAST BILLED"],
        total_products: firstResult.total_products || firstResult["TOTAL PRODUCTS"] || firstResult["PRODUCTS BOUGHT"] || firstResult["TOTAL ITEMS"],
        total_stock: firstResult.total_stock,
        // Credit fields for customer cards
        credit_given: firstResult.credit_given,
        credit_repaid: firstResult.credit_repaid,
        current_credit: firstResult.current_credit,
    } : null;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
        >
            <div className={cn(
                "min-w-0 overflow-hidden flex gap-3",
                isUser ? 'flex-row-reverse' : 'flex-row',
                // User messages shrink to content, AI messages take ~50% width
                isUser
                    ? "max-w-[70%]"
                    : assistantWidthClass
            )}>
                {/* Avatar */}
                <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1",
                    isUser ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300" : "bg-white dark:bg-slate-800 text-sky-600 border border-black/5"
                )}>
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-5 w-5" />}
                </div>

                <div
                    className={cn(
                        "relative px-5 py-3.5 shadow-sm text-sm min-w-0 rounded-2xl",
                        isUser
                            ? "bg-indigo-600 text-white"
                            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 flex-1"
                    )}>
                    {/* Message content - hide for conversational responses since they show in dedicated section */}
                    {(!isConversational || message.content) && (
                        <p className={cn(
                            "leading-relaxed whitespace-pre-wrap break-words",
                            isUser ? "text-white" : "text-slate-900 dark:text-slate-100"
                        )}>
                            {message.content || (isUser ? "[Message]" : "")}
                        </p>
                    )}

                    {/* Rendering Results */}
                    {isConversational && firstResult?.message && (
                        <div className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                            {String(firstResult.message).split('\n').map((line, i) => (
                                <p key={i} className={cn(
                                    "mb-1",
                                    line.startsWith('•') && "ml-2"
                                )}>
                                    {line.includes('**')
                                        ? line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                                            part.startsWith('**') && part.endsWith('**')
                                                ? <strong key={j}>{part.slice(2, -2)}</strong>
                                                : part
                                        )
                                        : line
                                    }
                                </p>
                            ))}
                        </div>
                    )}

                    {isIdentityCard && (
                        <div className="mt-4">
                            <IdentityCard data={firstResult as any} />
                        </div>
                    )}

                    {isCardResult && (
                        <div className="mt-4">
                            {firstResult?.total_stock !== undefined || firstResult?.TOTAL_STOCK !== undefined ? (
                                <SupplierCard data={firstResult as any} />
                            ) : (
                                <CustomerCard data={firstResult as any} />
                            )}
                        </div>
                    )}

                    {/* Collapsible Sections for non-card, non-conversational, non-identity results */}
                    {!isCardResult && !isConversational && !isIdentityCard && message.results && message.results.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {/* 1. SQL Query - Collapsible */}
                            {message.sql && (
                                <div className="rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
                                    <button
                                        onClick={() => setShowSql(!showSql)}
                                        className="w-full bg-slate-100 dark:bg-slate-900 px-3 py-2 text-[10px] font-mono text-slate-700 dark:text-slate-300 flex justify-between items-center transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <ChevronRight className={cn("h-3 w-3 transition-transform", showSql && "rotate-90")} />
                                            <span>SQL Query</span>
                                        </div>
                                        {message.timing && <span>{formatTime(message.timing.sqlGen)}</span>}
                                    </button>
                                    <AnimatePresence>
                                        {showSql && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="bg-slate-50 dark:bg-slate-950 p-3 border-t border-black/5">
                                                    <code className="text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
                                                        {message.sql}
                                                    </code>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* 2. Raw Data Table - Collapsible */}
                            {(() => {
                                const allKeys = Object.keys(message.results[0]);
                                // Show all columns - table has horizontal scroll for overflow
                                const displayKeys = allKeys;
                                const hasMoreColumns = false;
                                const remainingRows = totalRows - rowLimit;
                                const nextRowCount = Math.min(rowIncrement, remainingRows);

                                return (
                                    <div className="rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
                                        {/* Header row - flex container with toggle and CSV button as siblings */}
                                        <div className="w-full bg-slate-100 dark:bg-slate-900 px-3 py-2 text-[10px] text-slate-700 dark:text-slate-300 flex justify-between items-center">
                                            <button
                                                onClick={() => setShowRawData(!showRawData)}
                                                className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                                            >
                                                <ChevronRight className={cn("h-3 w-3 transition-transform", showRawData && "rotate-90")} />
                                                <Table2 className="h-3 w-3" />
                                                <span>Raw Data</span>
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            setIsDownloadingCSV(true);
                                                            setExportProgress(0);
                                                            const { save } = await import('@tauri-apps/plugin-dialog');
                                                            const { writeTextFile } = await import('@tauri-apps/plugin-fs');

                                                            const filePath = await save({
                                                                defaultPath: `query_results_${new Date().toISOString().split('T')[0]}.csv`,
                                                                filters: [{ name: 'CSV', extensions: ['csv'] }]
                                                            });

                                                            if (filePath && message.results) {
                                                                const headers = Object.keys(message.results[0]);
                                                                let csvLines = [headers.join(',')];
                                                                const total = message.results.length;
                                                                const chunkSize = 2000;
                                                                for (let i = 0; i < total; i += chunkSize) {
                                                                    const chunk = message.results.slice(i, i + chunkSize);
                                                                    const chunkLines = chunk.map(row =>
                                                                        headers.map(h => {
                                                                            const val = (row as any)[h];
                                                                            const str = String(val ?? '');
                                                                            return str.includes(',') || str.includes('"') || str.includes('\n')
                                                                                ? `"${str.replace(/"/g, '""')}"`
                                                                                : str;
                                                                        }).join(',')
                                                                    );
                                                                    csvLines.push(...chunkLines);
                                                                    setExportProgress(Math.round(((i + chunk.length) / total) * 100));
                                                                    await new Promise(resolve => setTimeout(resolve, 0));
                                                                }
                                                                await writeTextFile(filePath, csvLines.join('\n'));
                                                            }
                                                        } catch (error) {
                                                            console.error('Failed to save CSV:', error);
                                                            alert('Failed to save CSV: ' + String(error));
                                                        } finally {
                                                            setIsDownloadingCSV(false);
                                                            setExportProgress(0);
                                                        }
                                                    }}
                                                    disabled={isDownloadingCSV}
                                                    className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50"
                                                    title="Download all data as CSV"
                                                >
                                                    {isDownloadingCSV ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <Download className="h-3 w-3" />
                                                    )}
                                                    <span>
                                                        {isDownloadingCSV
                                                            ? (exportProgress > 0 && exportProgress < 100 ? `${exportProgress}%` : 'Saving...')
                                                            : 'CSV'}
                                                    </span>
                                                </button>
                                                <span className="font-medium">{message.results.length} rows</span>
                                            </div>
                                        </div>
                                        <AnimatePresence>
                                            {showRawData && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="border-t border-black/5">
                                                        <div
                                                            className={cn(
                                                                "chat-table-scroll w-full overflow-x-auto overflow-y-auto",
                                                                isCompact ? "max-h-60" : "max-h-80"
                                                            )}
                                                            style={{ maxWidth: '100%' }}
                                                        >
                                                            <table className={cn(
                                                                "w-full min-w-max table-auto",
                                                                isCompact ? "text-[10px]" : "text-[11px]"
                                                            )}>
                                                                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-black/5 sticky top-0 z-10">
                                                                    <tr>
                                                                        {displayKeys.map((key) => (
                                                                            <th key={key} className={cn(
                                                                                "text-left font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider",
                                                                                isCompact ? "px-2 py-1.5" : "px-3 py-2"
                                                                            )}>
                                                                                {key.replace(/_/g, ' ')}
                                                                            </th>
                                                                        ))}
                                                                        {hasMoreColumns && (
                                                                            <th className="px-1.5 py-1 text-left font-semibold text-muted-foreground">...</th>
                                                                        )}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                                                    {visibleRows.map((row, i) => (
                                                                        <tr key={i} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                                                            {displayKeys.map((key) => (
                                                                                <td
                                                                                    key={key}
                                                                                    className={cn(
                                                                                        "whitespace-nowrap align-top",
                                                                                        isCompact ? "px-2 py-1.5" : "px-3 py-2"
                                                                                    )}
                                                                                    title={String((row as any)[key])}
                                                                                >
                                                                                    {String((row as any)[key] ?? '-')}
                                                                                </td>
                                                                            ))}
                                                                            {hasMoreColumns && (
                                                                                <td className="px-1.5 py-1 text-muted-foreground">...</td>
                                                                            )}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        <div className={cn(
                                                            "bg-slate-50 dark:bg-slate-900 text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t border-black/5",
                                                            isCompact ? "px-3 py-1.5 text-[9px]" : "px-4 py-2 text-[10px]"
                                                        )}>
                                                            <span>
                                                                Showing {visibleRows.length} of {message.results.length} results
                                                                {allKeys.length > 5 && ` (${allKeys.length} columns)`}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                {canShowLessRows && (
                                                                    <button
                                                                        onClick={() => setRowLimit(defaultRowLimit)}
                                                                        className="text-muted-foreground hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                                    >
                                                                        Show less
                                                                    </button>
                                                                )}
                                                                {canShowMoreRows && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => setRowLimit(prev => Math.min(prev + rowIncrement, totalRows))}
                                                                            className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
                                                                        >
                                                                            Show {nextRowCount} more
                                                                        </button>
                                                                        {remainingRows > rowIncrement && (
                                                                            <button
                                                                                onClick={() => setRowLimit(totalRows)}
                                                                                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                                            >
                                                                                Show all
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {message.timing && <span>Exec: {formatTime(message.timing.sqlRun)}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })()}

                            {/* 3. Chart Visualization - Collapsible (Last) */}
                            {hasChartableData && (
                                <div className="rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
                                    <button
                                        onClick={() => setShowChart(!showChart)}
                                        className="w-full bg-indigo-50 dark:bg-indigo-950/50 px-3 py-2 text-[10px] text-indigo-600 dark:text-indigo-400 flex justify-between items-center transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <ChevronRight className={cn("h-3 w-3 transition-transform", showChart && "rotate-90")} />
                                            <BarChart3 className="h-3 w-3" />
                                            <span className="font-medium">Chart</span>
                                        </div>
                                        <span className="text-[9px] opacity-70">Visualization</span>
                                    </button>
                                    <AnimatePresence>
                                        {showChart && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="bg-white dark:bg-slate-900 p-3 border-t border-black/5">
                                                    <LazyChart data={message.results} isCompact={isCompact} />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SQL only (no results) - still show collapsible */}
                    {message.sql && (!message.results || message.results.length === 0) && !message.error && (
                        <div className="mt-3 rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
                            <button
                                onClick={() => setShowSql(!showSql)}
                                className="w-full bg-slate-100 dark:bg-slate-900 px-3 py-2 text-[10px] font-mono text-slate-700 dark:text-slate-300 flex justify-between items-center transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
                            >
                                <div className="flex items-center gap-1.5">
                                    <ChevronRight className={cn("h-3 w-3 transition-transform", showSql && "rotate-90")} />
                                    <span>SQL Query</span>
                                </div>
                                {message.timing && <span>{formatTime(message.timing.sqlGen)}</span>}
                            </button>
                            <AnimatePresence>
                                {showSql && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="bg-slate-50 dark:bg-slate-950 p-3 border-t border-black/5">
                                            <code className="text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
                                                {message.sql}
                                            </code>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Error State */}
                    {message.error && (
                        <div className="mt-3 pt-3 border-t border-red-100 dark:border-red-900/30 flex flex-col gap-2">
                            <span className="text-xs text-red-500 font-medium">{message.error}</span>
                            {message.sql && (
                                <button
                                    onClick={() => onImprove(message.content, message.sql!)}
                                    className="text-[10px] bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-1 rounded inline-flex self-start items-center gap-1 hover:bg-red-100 transition-colors"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    Fix this query
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
