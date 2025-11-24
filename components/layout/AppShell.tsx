'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { usePathname } from 'next/navigation';

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { user, loading, logout } = useAuth();
    const pathname = usePathname();

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

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }

    // If on login page, just render children (the login form)
    // Handle potential trailing slash
    if (pathname === '/login' || pathname === '/login/') {
        return <>{children}</>;
    }

    // If not logged in (and not on login page), AuthContext will redirect, but we render nothing/loading here
    if (!user) {
        // If pathname is null (initial load), show loading
        if (!pathname) {
            return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
        }
        return null;
    }

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main">
                <Header userEmail={user.username} />
                <div className="page-container">{children}</div>
            </div>
        </div>
    );
}
