'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, X } from 'lucide-react';
import { AIChatDialog } from './AIChatDialog';
import { Button } from '@/components/ui/button';

export function AIChatButton() {
    const [open, setOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

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

                            {/* Icon animation */}
                            <motion.div
                                animate={isHovered ? { rotate: [0, -10, 10, -5, 5, 0] } : {}}
                                transition={{ duration: 0.5 }}
                            >
                                <Bot className="h-7 w-7 fill-white/10" />
                            </motion.div>

                            {/* Sparkles */}
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
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <AIChatDialog open={open} onOpenChange={setOpen} />
        </>
    );
}
