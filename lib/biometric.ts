import { invoke } from '@tauri-apps/api/core';
import {
    checkStatus,
    authenticate,
    BiometryType,
    type Status,
} from '@choochmeque/tauri-plugin-biometry-api';
import type { User } from '@/contexts/AuthContext';

// Storage key prefix for biometric token (stored locally, protected by biometric auth at runtime)
const BIOMETRIC_STORAGE_PREFIX = 'biometric_token_';

function getStorageKey(username: string): string {
    return `${BIOMETRIC_STORAGE_PREFIX}${username.toLowerCase()}`;
}

export interface BiometricCapability {
    isAvailable: boolean;
    biometryType: 'none' | 'touchId' | 'faceId' | 'iris' | 'auto';
    error?: string;
    errorCode?: string;
}

/**
 * Check if biometric authentication is available on this device.
 * Uses the native Touch ID / Windows Hello APIs.
 */
export async function checkBiometricCapability(): Promise<BiometricCapability> {
    try {
        const status: Status = await checkStatus();

        const typeMap: Record<BiometryType, BiometricCapability['biometryType']> = {
            [BiometryType.None]: 'none',
            [BiometryType.Auto]: 'auto',
            [BiometryType.TouchID]: 'touchId',
            [BiometryType.FaceID]: 'faceId',
            [BiometryType.Iris]: 'iris',
        };

        return {
            isAvailable: status.isAvailable,
            biometryType: typeMap[status.biometryType] || 'none',
            error: status.error,
            errorCode: status.errorCode,
        };
    } catch (error) {
        console.error('Failed to check biometric status:', error);
        return {
            isAvailable: false,
            biometryType: 'none',
            error: String(error)
        };
    }
}

/**
 * Get human-readable biometric type name
 */
export function getBiometricTypeName(type: BiometricCapability['biometryType']): string {
    switch (type) {
        case 'touchId': return 'Touch ID';
        case 'faceId': return 'Face ID';
        case 'iris': return 'Iris';
        case 'auto': return 'Biometric';
        default: return 'Biometric';
    }
}

/**
 * Enroll biometric for a user (call after password authentication)
 * This will:
 * 1. Prompt for biometric authentication to confirm identity
 * 2. Generate a secure token on the backend
 * 3. Store the token in localStorage keyed by username
 *
 * @param userId The user ID to enable biometric for
 * @param username The username to key the storage by
 * @returns true if enrollment succeeded
 */
export async function enrollBiometric(userId: number, username: string): Promise<boolean> {
    try {
        // First, prompt user to confirm with biometric (this is the real Touch ID prompt)
        await authenticate('Confirm your identity to enable fingerprint login', {
            allowDeviceCredential: false,
            cancelTitle: 'Cancel',
        });

        // Generate token on backend (this also enables biometric in DB)
        const token = await invoke<string>('generate_biometric_token', { userId });

        // Store token locally - security comes from:
        // 1. Biometric auth required before we return the token for verification
        // 2. Token is hashed in database, so raw token alone isn't useful without the app
        // 3. Token is per-device, doesn't transfer
        localStorage.setItem(getStorageKey(username), JSON.stringify({ token, userId }));

        return true;
    } catch (error) {
        console.error('Biometric enrollment failed:', error);
        // Rollback: disable biometric if enrollment failed partway
        try {
            await invoke('disable_biometric', { userId });
        } catch { }
        throw error;
    }
}

let isAuthenticating = false;

/**
 * Authenticate using biometric and return user.
 * This will:
 * 1. Check if biometric token exists locally for the provided username
 * 2. Prompt for biometric authentication (Touch ID / Windows Hello)
 * 3. If successful, verify the token with the backend and return the user
 *
 * @param username The username attempting to login
 * @returns User object if authentication succeeded, null if failed
 */
export async function authenticateWithBiometric(username: string): Promise<User | null> {
    if (isAuthenticating) {
        console.warn('Biometric authentication already in progress');
        return null;
    }

    isAuthenticating = true;

    try {
        // Check if we have a stored token for this user
        const stored = localStorage.getItem(getStorageKey(username));
        if (!stored) {
            console.log(`No biometric token found for user ${username}`);
            // If they don't have a local token, we can't auth them on THIS device
            throw new Error('biometryNotEnrolled');
        }

        const { token } = JSON.parse(stored);

        // Prompt for biometric authentication BEFORE we use the token
        // This is the critical security gate - user must authenticate with Touch ID
        await authenticate('Sign in to Inventory System', {
            allowDeviceCredential: false,
            cancelTitle: 'Use Password',
        });

        // Biometric auth succeeded - now verify token with backend
        const user = await invoke<User>('verify_biometric_token', { token });

        return user;
    } catch (error) {
        console.error('Biometric authentication failed:', error);
        throw error; // Re-throw to handle specific errors in UI
    } finally {
        isAuthenticating = false;
    }
}

/**
 * Disable biometric for a user
 * @param userId The user ID to disable biometric for
 * @param username The username to remove local storage for
 */
export async function disableBiometric(userId: number, username: string): Promise<void> {
    // Remove from local storage
    localStorage.removeItem(getStorageKey(username));

    // Disable in database
    await invoke('disable_biometric', { userId });
}

/**
 * Check if biometric is enabled for a specific user (Backend check)
 * @param userId The user ID to check
 * @returns true if biometric is enabled for this user
 */
export async function isBiometricEnabled(userId: number): Promise<boolean> {
    return invoke<boolean>('get_biometric_status', { userId });
}

/**
 * Check if a specific user has a local biometric enrollment on THIS device
 */
export function hasLocalBiometricEnrollment(username: string): boolean {
    return localStorage.getItem(getStorageKey(username)) !== null;
}

/**
 * Handle biometric authentication errors
 * @param error The error from biometric authentication
 * @returns Human-readable error message
 */
export function getBiometricErrorMessage(error: unknown): string {
    const errorStr = String(error);

    if (errorStr.includes('userCancel')) {
        return 'Authentication cancelled';
    }
    if (errorStr.includes('authenticationFailed')) {
        return 'Fingerprint not recognized. Please try again or use your password.';
    }
    if (errorStr.includes('biometryNotAvailable')) {
        return 'Fingerprint hardware not available on this device';
    }
    if (errorStr.includes('biometryNotEnrolled')) {
        return 'Fingerprint not configured on this device for this user.';
    }
    if (errorStr.includes('biometryLockout')) {
        return 'Too many failed attempts. Please use your password.';
    }
    if (errorStr.includes('passcodeNotSet')) {
        return 'Device passcode required for fingerprint login';
    }
    if (errorStr.includes('itemNotFound')) {
        return 'Biometric data not found. Please re-enable fingerprint login in Settings.';
    }

    return 'Fingerprint authentication failed. Please use your password.';
}

