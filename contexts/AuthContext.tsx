'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';

export type User = {
    id: number;
    username: string;
    role: string;
    permissions: string; // JSON string
    created_at: string;
};

type AuthContextType = {
    user: User | null;
    loading: boolean;
    login: (user: User) => void;
    logout: () => void;
    hasPermission: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'inventory_user_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    // Restore session from sessionStorage on mount for faster navigation
    useEffect(() => {
        try {
            const savedSession = sessionStorage.getItem(SESSION_KEY);
            if (savedSession) {
                const userData = JSON.parse(savedSession) as User;
                setUser(userData);
            }
        } catch (e) {
            console.error('Failed to restore session:', e);
        }
        setLoading(false);
    }, []);

    const login = (userData: User) => {
        // Save to sessionStorage for faster subsequent loads
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
        } catch (e) {
            console.error('Failed to save session:', e);
        }
        setUser(userData);
        router.push('/');
    };

    const logout = () => {
        // Clear session
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch (e) {
            console.error('Failed to clear session:', e);
        }
        setUser(null);
        router.push('/login');
    };

    const hasPermission = (permission: string): boolean => {
        if (!user) return false;
        if (user.role === 'admin') return true;

        try {
            const perms = JSON.parse(user.permissions) as string[];
            return perms.includes('*') || perms.includes(permission);
        } catch {
            return false;
        }
    };

    // Protect routes
    useEffect(() => {
        if (!loading) {
            const isLoginPage = pathname === '/login' || pathname === '/login/';

            // If not logged in and not on login page (or path is unknown/root), go to login
            if (!user && !isLoginPage) {
                router.push('/login');
            }
            // If logged in and on login page, go to dashboard
            else if (user && isLoginPage) {
                router.push('/');
            }
        }
    }, [user, loading, pathname, router]);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
