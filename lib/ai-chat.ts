import { invoke } from '@tauri-apps/api/core';

const AI_SERVER_URL = 'http://127.0.0.1:8765';

export interface QueryResponse {
    sql: string;
    results: Record<string, unknown>[];
    sql_extraction_time_ms: number;
    execution_time_ms: number;
    total_time_ms: number;
    success: boolean;
    error: string | null;
}

export interface SetupStatus {
    model_downloaded: boolean;
    model_valid: boolean;  // True if model file is valid/loadable
    vectordb_initialized: boolean;
    training_data_loaded: boolean;
    ready: boolean;
    initialization_error?: string;  // Error message if model failed to init
}

export interface DownloadProgress {
    status: 'downloading' | 'complete' | 'error' | 'cancelled';
    downloaded_bytes: number;
    total_bytes: number;
    downloaded_gb: number;
    total_gb: number;
    percentage: number;
    speed_mbps: number;
}

export interface SidecarDownloadProgress {
    downloaded_bytes: number;
    total_bytes: number;
    percentage: number;
    speed_mbps: number;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    sql?: string;
    results?: Record<string, unknown>[];
    timing?: {
        sqlGen: number;
        sqlRun: number;
        total: number;
    };
    error?: string;
}

export const aiChatApi = {
    /**
     * Start the AI sidecar server
     */
    startSidecar: async (): Promise<void> => {
        await invoke('start_ai_sidecar');
    },

    /**
     * Stop the AI sidecar server
     */
    stopSidecar: async (): Promise<void> => {
        await invoke('stop_ai_sidecar');
    },

    /**
     * Check if the sidecar is running
     */
    checkSidecarStatus: async (): Promise<boolean> => {
        return await invoke('check_ai_sidecar_status');
    },

    /**
     * Check if the sidecar binary is downloaded
     */
    checkSidecarDownloaded: async (): Promise<boolean> => {
        return await invoke('check_sidecar_downloaded');
    },

    /**
     * Download the AI sidecar binary (emits 'sidecar-download-progress' events)
     */
    downloadSidecar: async (): Promise<void> => {
        await invoke('download_ai_sidecar');
    },

    /**
     * Get the current setup status
     */
    getStatus: async (): Promise<SetupStatus> => {
        const response = await fetch(`${AI_SERVER_URL}/status`);
        if (!response.ok) {
            throw new Error('Failed to get status');
        }
        return response.json();
    },

    /**
     * Query the AI with a natural language question
     */
    query: async (question: string): Promise<QueryResponse> => {
        const response = await fetch(`${AI_SERVER_URL}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question }),
        });
        if (!response.ok) {
            throw new Error('Query failed');
        }
        return response.json();
    },

    /**
     * Start model download (non-blocking)
     */
    downloadModel: async (): Promise<void> => {
        const response = await fetch(`${AI_SERVER_URL}/download-model`, { method: 'POST' });
        if (!response.ok) {
            throw new Error('Failed to start download');
        }
    },

    /**
     * Poll download progress
     */
    getDownloadProgress: async (): Promise<DownloadProgress | null> => {
        try {
            const response = await fetch(`${AI_SERVER_URL}/download-progress`);
            if (response.ok) {
                return response.json();
            }
            return null;
        } catch {
            return null;
        }
    },

    /**
     * Cancel ongoing download
     */
    cancelDownload: async (): Promise<void> => {
        await fetch(`${AI_SERVER_URL}/cancel-download`, { method: 'POST' });
    },

    /**
     * Force delete model and start fresh download (user explicitly requested)
     */
    forceRedownload: async (): Promise<void> => {
        const response = await fetch(`${AI_SERVER_URL}/force-redownload`, { method: 'POST' });
        if (!response.ok) {
            throw new Error('Failed to start re-download');
        }
    },

    /**
     * Train the AI with new data
     */
    train: async (type: 'ddl' | 'documentation' | 'question_sql', content: string, question?: string): Promise<void> => {
        const response = await fetch(`${AI_SERVER_URL}/train`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ training_type: type, content, question }),
        });
        if (!response.ok) {
            throw new Error('Training failed');
        }
    },

    /**
     * Check if the AI server is healthy
     */
    /**
     * Check if the AI server is healthy and ready
     */
    healthCheck: async (): Promise<{ healthy: boolean; ready: boolean }> => {
        try {
            const response = await fetch(`${AI_SERVER_URL}/health`);
            if (response.ok) {
                const data = await response.json();
                return { healthy: true, ready: data.ready };
            }
            return { healthy: false, ready: false };
        } catch {
            return { healthy: false, ready: false };
        }
    },
};

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format milliseconds to a readable string
 */
export function formatTime(ms: number): string {
    if (ms < 1000) {
        return `${Math.round(ms)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
}
