'use client';

import { useState } from 'react';
import { useAuth, type User } from '@/contexts/AuthContext';
import { invoke } from '@tauri-apps/api/core';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Lock, User as UserIcon, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const user = await invoke<User>('login', {
                input: { username, password },
            });
            login(user);
        } catch (err) {
            console.error('Login failed:', err);
            setError(typeof err === 'string' ? err : 'Invalid username or password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
            <Card className="w-full max-w-md p-8 space-y-6 shadow-xl">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
                        <Lock size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        Welcome Back
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Sign in to your inventory account
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Username
                        </label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                type="text"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="pl-9"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-9"
                                required
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </Button>
                </form>
            </Card>
        </div>
    );
}
