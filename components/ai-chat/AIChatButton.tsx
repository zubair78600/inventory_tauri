'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2 } from 'lucide-react';
import { AIChatDialog } from './AIChatDialog';
import { Button } from '@/components/ui/button';
import { aiChatApi } from '@/lib/ai-chat';

// Global state to track if sidecar has been started this session
let sidecarStarted = false;

// LocalStorage key for AI enabled state
const AI_ENABLED_KEY = 'ai_enabled';

function BlinkingBot({ className }: { className?: string }) {
    const [isBlinking, setIsBlinking] = useState(false);

    useEffect(() => {
        const blinkLoop = () => {
            setIsBlinking(true);
            setTimeout(() => {
                setIsBlinking(false);
                // Schedule next blink
                const nextBlink = Math.random() * 3000 + 2000; // 2-5 seconds
                setTimeout(blinkLoop, nextBlink);
            }, 100); // Blink duration
        };

        const timeout = setTimeout(blinkLoop, 2000);
        return () => clearTimeout(timeout);
    }, []);

    // Standard Lucide Bot icon path structure
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {/* Antenna */}
            <path d="M12 8V4H8" />
            {/* Head */}
            <rect width="16" height="12" x="4" y="8" rx="2" />
            {/* Ears */}
            <path d="M2 14h2" />
            <path d="M20 14h2" />

            {/* Eyes - Animated */}
            <motion.path
                d="M9 13h2"
                initial={false}
                animate={{ scaleY: isBlinking ? 0.1 : 1 }}
                style={{ originX: "10px", originY: "13px" }}
            />
            <motion.path
                d="M15 13h2"
                initial={false}
                animate={{ scaleY: isBlinking ? 0.1 : 1 }}
                style={{ originX: "16px", originY: "13px" }}
            />
        </svg>
    );
}


export function AIChatButton() {
    const [open, setOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [aiEnabled, setAiEnabled] = useState<boolean | null>(null); // null = loading
    const startAttempted = useRef(false);

    // Check AI enabled status from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(AI_ENABLED_KEY);
        // Default to false (off) if not set - new installs will have AI off
        setAiEnabled(stored === 'true');
    }, []);

    // Start sidecar on component mount (app startup) - only once per session
    // But ONLY if AI is enabled
    useEffect(() => {
        if (aiEnabled !== true) return; // Don't start if disabled or still loading
        if (startAttempted.current || sidecarStarted) return;
        startAttempted.current = true;

        const initSidecar = async () => {
            try {
                // First check if server is already running
                const { healthy } = await aiChatApi.healthCheck();
                if (healthy) {
                    setIsReady(true);
                    sidecarStarted = true;
                    return;
                }

                // Check if sidecar is downloaded
                const downloaded = await aiChatApi.checkSidecarDownloaded();
                if (!downloaded) {
                    // Will prompt for download when dialog opens
                    return;
                }

                // Start sidecar in background
                setIsStarting(true);
                await aiChatApi.startSidecar();

                // Poll until ready (up to 60 seconds)
                for (let i = 0; i < 60; i++) {
                    await new Promise(r => setTimeout(r, 1000));
                    try {
                        const { healthy } = await aiChatApi.healthCheck();
                        if (healthy) {
                            setIsReady(true);
                            sidecarStarted = true;
                            break;
                        }
                    } catch {
                        // Keep trying
                    }
                }
            } catch (e) {
                console.log('Sidecar init error (will retry when dialog opens):', e);
            } finally {
                setIsStarting(false);
            }
        };

        initSidecar();
    }, [aiEnabled]);

    // Periodic health check to update ready status
    useEffect(() => {
        if (aiEnabled !== true) return; // Don't poll if AI disabled

        const interval = setInterval(async () => {
            try {
                const { healthy } = await aiChatApi.healthCheck();
                setIsReady(healthy);
            } catch {
                setIsReady(false);
            }
        }, 10000); // Check every 10 seconds

        return () => clearInterval(interval);
    }, [aiEnabled]);

    // Don't render anything if AI is disabled or still loading
    if (aiEnabled !== true) {
        return null;
    }

    return (
        <>
            <AnimatePresence>
                {!open && (
                    <motion.div
                        className="fixed bottom-6 right-6 z-50"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        onHoverStart={() => setIsHovered(true)}
                        onHoverEnd={() => setIsHovered(false)}
                    >
                        <Button
                            size="icon"
                            className="h-14 w-14 rounded-full shadow-[0_8px_30px_rgb(14,165,233,0.4)] bg-gradient-to-tr from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white border-0 transition-all duration-300 relative overflow-hidden group"
                            onClick={() => setOpen(true)}
                        >
                            {/* Glow effect */}
                            <div className="absolute inset-0 bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            {/* Icon - show loader while starting */}
                            <motion.div
                                animate={isHovered ? { rotate: [0, -10, 10, -5, 5, 0] } : {}}
                                transition={{ duration: 0.5 }}
                            >
                                {isStarting ? (
                                    <Loader2 className="h-7 w-7 animate-spin" />
                                ) : (
                                    <BlinkingBot className="h-7 w-7 fill-white/10" />
                                )}
                            </motion.div>

                            {/* Status indicator - green dot when ready */}
                            <div className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white transition-colors ${isReady ? 'bg-emerald-400' : isStarting ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'
                                }`} />

                            {/* Sparkles - only show when ready */}
                            {isReady && (
                                <motion.div
                                    className="absolute -top-1 -right-1"
                                    animate={{
                                        opacity: [0, 1, 0],
                                        scale: [0.5, 1.2, 0.5],
                                        rotate: [0, 180]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        repeatDelay: 1
                                    }}
                                >
                                    <Sparkles className="h-4 w-4 text-amber-300 fill-amber-300" />
                                </motion.div>
                            )}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <AIChatDialog open={open} onOpenChange={setOpen} />
        </>
    );
}

