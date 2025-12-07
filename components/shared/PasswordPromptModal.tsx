import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PasswordPromptModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    title?: string;
    description?: string;
}

export function PasswordPromptModal({
    open,
    onOpenChange,
    onSuccess,
    title = 'Security Check',
    description = 'Please enter your password to continue.',
}: PasswordPromptModalProps) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user } = useAuth();

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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-[400px] rounded-lg bg-white p-6 shadow-lg ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-slate-50/10 animate-in zoom-in-95 duration-200">
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
                            id="password-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            autoFocus
                            className="bg-transparent"
                            autoComplete="current-password"
                        />
                        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 mt-6">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
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
        </div>
    );
}
