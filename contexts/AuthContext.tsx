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

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Check for persisted user session
        const storedUser = localStorage.getItem('user_session');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error('Failed to parse stored user session', e);
                localStorage.removeItem('user_session');
            }
        }
        setLoading(false);
    }, []);

    const login = (userData: User) => {
        setUser(userData);
        localStorage.setItem('user_session', JSON.stringify(userData));
        router.push('/');
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user_session');
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
