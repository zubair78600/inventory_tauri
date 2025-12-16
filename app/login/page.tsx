'use client';

import { useState, useEffect } from 'react';
import { useAuth, type User } from '@/contexts/AuthContext';
import { invoke } from '@tauri-apps/api/core';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Lock, User as UserIcon, Loader2, Fingerprint } from 'lucide-react';
import {
    checkBiometricCapability,
    authenticateWithBiometric,
    hasLocalBiometricEnrollment,
    getBiometricTypeName,
    getBiometricErrorMessage,
    type BiometricCapability,
} from '@/lib/biometric';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isBiometricLoading, setIsBiometricLoading] = useState(false);
    const { login } = useAuth();

    // Biometric state
    const [biometricCapability, setBiometricCapability] = useState<BiometricCapability | null>(null);
    const [hasBiometricEnrollment, setHasBiometricEnrollment] = useState(false);
    const [biometricChecked, setBiometricChecked] = useState(false);

    // Check biometric availability on mount
    // Check biometric availability on mount
    useEffect(() => {
        const checkBiometric = async () => {
            try {
                // Just check capability, don't check enrollment yet (depends on user)
                const capability = await checkBiometricCapability();
                setBiometricCapability(capability);
            } catch (err) {
                console.error('Failed to check biometric:', err);
            } finally {
                setBiometricChecked(true);
            }
        };

        checkBiometric();
    }, []);

    const handlePasswordSubmit = async (e: React.FormEvent) => {
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

    // Check biometric status when username changes
    useEffect(() => {
        const checkUserBiometric = async () => {
            if (!username.trim()) {
                setHasBiometricEnrollment(false);
                return;
            }

            try {
                // Only check if device supports it
                if (biometricCapability?.isAvailable) {
                    // Check Backend (is enabled in DB?)
                    const enabledInDb = await invoke<boolean>('get_biometric_status_by_username', { username });

                    // Check Frontend (do we have a token on THIS device?)
                    const hasLocalToken = hasLocalBiometricEnrollment(username);

                    setHasBiometricEnrollment(enabledInDb && hasLocalToken);
                }
            } catch (err) {
                console.error('Failed to check user biometric status:', err);
                setHasBiometricEnrollment(false);
            }
        };

        // Debounce check
        const timeoutId = setTimeout(checkUserBiometric, 500);
        return () => clearTimeout(timeoutId);
    }, [username, biometricCapability]);

    const handleBiometricLogin = async () => {
        setError('');
        setIsBiometricLoading(true);

        try {
            const user = await authenticateWithBiometric(username);
            if (user) {
                // SECURITY: Verify the authenticated user matches the entered username
                if (user.username.toLowerCase() !== username.toLowerCase()) {
                    setError('Biometric authentication failed: User mismatch. Please log in with your own credentials.');
                    // Optional: Logout immediately if verify_biometric_token returned a valid session (though here it just returns user struct)
                } else {
                    login(user);
                }
            } else {
                setError('Fingerprint authentication failed. Please use your password.');
            }
        } catch (err) {
            console.error('Biometric login failed:', err);
            setError(getBiometricErrorMessage(err));
        } finally {
            setIsBiometricLoading(false);
        }
    };

    const showBiometricButton =
        biometricChecked &&
        biometricCapability?.isAvailable &&
        hasBiometricEnrollment &&
        username.length > 0;

    const getBiometricButtonLabel = () => {
        if (!biometricCapability) return 'Sign in with Fingerprint';
        return `Sign in with ${getBiometricTypeName(biometricCapability.biometryType)}`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 relative overflow-hidden">
            {/* Animated Background */}
            <AnimatedBackground />

            <Card className="w-full max-w-md p-8 space-y-6 shadow-xl relative z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
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

                {/* Biometric Login Button */}
                {showBiometricButton && (
                    <div className="space-y-4">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full h-14 text-base border-2 hover:border-primary hover:bg-primary/5"
                            onClick={handleBiometricLogin}
                            disabled={isBiometricLoading}
                        >
                            {isBiometricLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <Fingerprint className="mr-2 h-5 w-5" />
                            )}
                            {getBiometricButtonLabel()}
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white dark:bg-slate-800 px-2 text-slate-500">
                                    or use password
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
