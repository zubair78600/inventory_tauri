'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PasswordPromptModal } from '@/components/shared/PasswordPromptModal';
import { listen } from '@tauri-apps/api/event';
import { AIChatButton } from '@/components/ai-chat';
import {
    hasLocalBiometricEnrollment,
    authenticateWithBiometric,
    getBiometricErrorMessage,
} from '@/lib/biometric';

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { user, loading, logout } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
                e.preventDefault();
                if (user) {
                    logout();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [user, logout]);

    // Listen for settings menu event from Mac menu bar
    useEffect(() => {
        const unlisten = listen('open-settings-menu', () => {
            // Show password prompt instead of navigating directly
            setShowPasswordPrompt(true);
        });

        return () => {
            unlisten.then(fn => fn());
        };
    }, []);

    // If on login page, render immediately without waiting for auth loading
    // This makes the login page appear instantly
    if (pathname === '/login' || pathname === '/login/') {
        return <>{children}</>;
    }

    // Only show loading spinner for authenticated routes
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // If not logged in (and not on login page), AuthContext will redirect, but we render nothing/loading here
    if (!user) {
        // If pathname is null (initial load), show loading
        if (!pathname) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            );
        }
        return null;
    }

    const handlePasswordSuccess = () => {
        // Store timestamp so SettingsPage knows we already authenticated
        sessionStorage.setItem('settings_auth_ts', Date.now().toString());
        router.push('/settings');
    };

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main">
                <Header userEmail={user.username} />
                <div className="page-container">{children}</div>
            </div>

            {/* Password prompt for Settings menu access */}
            <PasswordPromptModal
                open={showPasswordPrompt}
                onOpenChange={setShowPasswordPrompt}
                onSuccess={handlePasswordSuccess}
                title="Settings Access"
                description="Please enter your password to access settings."
                onBiometric={user && hasLocalBiometricEnrollment(user.username) ? async () => {
                    try {
                        const result = await authenticateWithBiometric(user.username);
                        if (result) {
                            handlePasswordSuccess();
                            setShowPasswordPrompt(false);
                        }
                    } catch (err) {
                        console.error('Biometric auth failed:', getBiometricErrorMessage(err));
                    }
                } : undefined}
            />

            {/* AI Chat Button */}
            <AIChatButton />
        </div>
    );
}
