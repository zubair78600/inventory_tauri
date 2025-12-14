import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Fingerprint } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PasswordPromptModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    title?: string;
    description?: string;
    onBiometric?: () => void;
}

export function PasswordPromptModal({
    open,
    onOpenChange,
    onSuccess,
    title = 'Security Check',
    description = 'Please enter your password to continue.',
    onBiometric,
}: PasswordPromptModalProps) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        setError('');

        try {
            // Re-use login command to verify password
            // If it succeeds, it returns the user object, meaning password is correct
            await invoke('login', {
                input: {
                    username: user.username,
                    password: password,
                },
            });

            onSuccess();
            onOpenChange(false);
            setPassword('');
        } catch (err) {
            console.error('Password verification failed:', err);
            setError('Incorrect password');
        } finally {
            setLoading(false);
        }
    };

    // Focus input when modal opens
    useEffect(() => {
        if (open) {
            // Small delay to ensure the modal is rendered
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [open]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (open && e.key === 'Escape') {
                onOpenChange(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [open, onOpenChange]);

    if (!open) return null;

    // Use portal to render at document.body level, above all other content
    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
                // Close when clicking backdrop, but not the modal content
                if (e.target === e.currentTarget) {
                    onOpenChange(false);
                }
            }}
        >
            <div
                className="w-full max-w-[400px] rounded-lg bg-white p-6 shadow-lg ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-slate-50/10 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col space-y-2 text-center sm:text-left mb-4">
                    <h2 className="text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50">{title}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-slate-200" htmlFor="password-input">
                            Password
                        </label>
                        <Input
                            ref={inputRef}
                            id="password-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="bg-transparent"
                            autoComplete="current-password"
                        />
                        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 mt-6">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        {onBiometric && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onBiometric}
                                className="gap-2"
                            >
                                <Fingerprint className="h-4 w-4" />
                                Use Touch ID
                            </Button>
                        )}
                        <Button type="submit" disabled={loading || !password}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                'Confirm'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
