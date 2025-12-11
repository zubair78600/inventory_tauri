'use client';

import { useState, useEffect } from 'react';
import { Trash2, RefreshCw, AlertCircle, Loader2, Edit, Eye, EyeOff, Save, ExternalLink, Search, CheckCircle, XCircle, Download, Upload, FileJson, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { ask, save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { settingsCommands, imageCommands, GoogleImageResult, EntityModification } from '@/lib/tauri';
import { PdfConfiguration } from '@/components/settings/PdfConfiguration';

type DeletedItem = {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  entity_data: string;
  deleted_at: string;
  deleted_by: string | null;
  can_restore: boolean;
  restore_notes: string | null;
};

type User = {
  id: number;
  username: string;
  role: string;
  permissions: string;
  created_at: string;
};

const PERMISSIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'billing', label: 'Billing' },
  { id: 'sales', label: 'Sales' },
  { id: 'customers', label: 'Customers' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
];

import { ModeToggle } from '@/components/shared/ModeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { PasswordPromptModal } from '@/components/shared/PasswordPromptModal';
import {
  checkBiometricCapability,
  enrollBiometric,
  disableBiometric,
  isBiometricEnabled,
  getBiometricTypeName,
  getBiometricErrorMessage,
  type BiometricCapability,
  hasLocalBiometricEnrollment,
  authenticateWithBiometric,
} from '@/lib/biometric';
import { Fingerprint, AlertTriangle, Lock } from 'lucide-react';
import { LocationSelector } from '@/components/shared/LocationSelector';
import type { LocationValue } from '@/types/location';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'deleted-data' | 'general' | 'invoice' | 'api' | 'users' | 'security' | 'themes'>('deleted-data');

  // Security State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const checkSecurity = async () => {
      if (!user?.username) return;

      // check if user has enrolled in biometrics on this device
      const hasBiometric = hasLocalBiometricEnrollment(user.username);

      if (hasBiometric) {
        try {
          // Attempt biometric auth immediately
          const result = await authenticateWithBiometric(user.username);
          if (result) {
            setIsAuthenticated(true);
            setIsCheckingAuth(false);
            return;
          }
        } catch (error) {
          console.error("Biometric auth failed:", error);
          // Fall through to password prompt
          setAuthError(getBiometricErrorMessage(error));
        }
      }

      // If no biometric or failed, show password prompt
      setIsCheckingAuth(false);
      setShowPasswordPrompt(true);
    };

    checkSecurity();
  }, [user?.username]);

  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [modifications, setModifications] = useState<EntityModification[]>([]);
  const [dataSubTab, setDataSubTab] = useState<'deleted' | 'modified'>('deleted');
  const [expandedMods, setExpandedMods] = useState<Set<number>>(new Set());
  const [expandedDeleted, setExpandedDeleted] = useState<Set<number>>(new Set());

  // Master Admin check - only username 'admin' (case-insensitive) has permanent delete access
  const MASTER_ADMIN_USERNAME = 'admin';
  const isMasterAdmin = user?.username?.toLowerCase() === MASTER_ADMIN_USERNAME.toLowerCase();

  const [users, setUsers] = useState<User[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'user',
    permissions: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ... (existing state refs)

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          <p className="text-sm text-slate-500">Verifying security...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="max-w-md w-full text-center space-y-4">
          {/* The modal handles the UI, but we need a fallback background if modal is closed? 
                 Actually PasswordPromptModal is a modal. We should render it and maybe a 'Access Denied' background 
                 if they cancel it. */}

          {!showPasswordPrompt && (
            <div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
              <Lock className="h-12 w-12 text-slate-300" />
              <h2 className="text-xl font-semibold">Settings Locked</h2>
              <p className="text-slate-500">Authentication is required to access settings.</p>
              <button
                onClick={() => setShowPasswordPrompt(true)}
                className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors"
              >
                Authenticate
              </button>
              {authError && <p className="text-xs text-red-500">{authError}</p>}
            </div>
          )}

          <PasswordPromptModal
            open={showPasswordPrompt}
            onOpenChange={(open) => {
              setShowPasswordPrompt(open);
              // If they close it without success, they stay locked out
            }}
            onSuccess={() => setIsAuthenticated(true)}
            title="Settings Access"
            description={authError ? `${authError} Please enter your password.` : "For security, please enter your password to access settings."}
          />
        </div>
      </div>
    );
  }

  // Google API Settings
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [googleCxId, setGoogleCxId] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // JSON Settings
  const [verifyingApi, setVerifyingApi] = useState(false);
  const [importingInfo, setImportingInfo] = useState<string | null>(null);

  // API Test State
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<GoogleImageResult[]>([]);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [apiVerified, setApiVerified] = useState<boolean | null>(null);

  // Biometric state
  const [biometricCapability, setBiometricCapability] = useState<BiometricCapability | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  // Default Location
  const [defaultLocation, setDefaultLocation] = useState<LocationValue>({
    state: '',
    district: '',
    town: ''
  });

  useEffect(() => {
    if (activeTab === 'deleted-data') {
      if (dataSubTab === 'deleted') {
        void fetchDeletedItems();
      } else {
        void fetchModifications();
      }
    } else if (activeTab === 'users') {
      void fetchUsers();
    } else if (activeTab === 'general' || activeTab === 'api') {
      void fetchGoogleSettings();
      if (activeTab === 'general') {
        void fetchDefaultLocation();
      }
    } else if (activeTab === 'security') {
      void fetchBiometricStatus();
    }
  }, [activeTab]);

  const fetchBiometricStatus = async () => {
    if (!user) return;
    setBiometricError(null);
    try {
      const [capability, enabled] = await Promise.all([
        checkBiometricCapability(),
        isBiometricEnabled(user.id),
      ]);
      setBiometricCapability(capability);
      setBiometricEnabled(enabled);
    } catch (err) {
      console.error('Failed to fetch biometric status:', err);
      setBiometricError('Failed to check biometric availability');
    }
  };

  const handleToggleBiometric = async () => {
    if (!user) return;
    setBiometricLoading(true);
    setBiometricError(null);

    try {
      if (biometricEnabled) {
        await disableBiometric(user.id, user.username);
        setBiometricEnabled(false);
      } else {
        await enrollBiometric(user.id, user.username);
        setBiometricEnabled(true);
      }
    } catch (err) {
      console.error('Failed to toggle biometric:', err);
      setBiometricError(getBiometricErrorMessage(err));
    } finally {
      setBiometricLoading(false);
    }
  };

  const fetchGoogleSettings = async () => {
    try {
      const settings = await settingsCommands.getAll();
      setGoogleApiKey(settings['google_api_key'] || '');
      setGoogleCxId(settings['google_cx_id'] || '');
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchDefaultLocation = async () => {
    try {
      const settings = await settingsCommands.getAll();
      setDefaultLocation({
        state: settings['default_state'] || '',
        district: settings['default_district'] || '',
        town: settings['default_town'] || ''
      });
    } catch (err) {
      console.error('Error fetching default location:', err);
    }
  };

  const handleSaveDefaultLocation = async () => {
    setSavingSettings(true);
    try {
      await settingsCommands.set('default_state', defaultLocation.state);
      await settingsCommands.set('default_district', defaultLocation.district);
      await settingsCommands.set('default_town', defaultLocation.town);
      alert('Default location saved successfully!');
    } catch (err) {
      console.error('Error saving default location:', err);
      alert('Failed to save default location');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveGoogleSettings = async () => {
    setSavingSettings(true);
    setSettingsSuccess(false);
    setApiVerified(null);
    try {
      await settingsCommands.set('google_api_key', googleApiKey);
      await settingsCommands.set('google_cx_id', googleCxId);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);

      // Auto-verify if credentials changed
      if (googleApiKey && googleCxId) {
        void handleVerifyApiConnection();
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Error saving settings: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleVerifyApiConnection = async () => {
    if (!googleApiKey || !googleCxId) return;

    setVerifyingApi(true);
    setApiVerified(null);
    try {
      // Perform a minimal search
      await imageCommands.searchGoogleImages('test', 1);
      setApiVerified(true);
    } catch (err) {
      console.error('API Verification failed:', err);
      setApiVerified(false);
    } finally {
      setVerifyingApi(false);
    }
  };

  const handleExportSettings = async () => {
    try {
      const json = await settingsCommands.exportJson();

      const filePath = await save({
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }],
        defaultPath: 'inventory-settings-backup.json'
      });

      if (filePath) {
        await writeTextFile(filePath, json);
        alert('Settings exported successfully!');
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export settings: ' + String(err));
    }
  };

  const handleImportSettings = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }]
      });

      if (filePath && typeof filePath === 'string') {
        setLoading(true);
        const jsonContent = await readTextFile(filePath);
        const count = await settingsCommands.importJson(jsonContent);

        setImportingInfo(`Successfully imported ${count} settings. Please refresh the page to see changes.`);

        // Refresh values if we are on the page
        void fetchGoogleSettings();

        setTimeout(() => setImportingInfo(null), 5000);
      }
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import settings: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleTestApi = async () => {
    if (!testQuery.trim()) return;

    setTesting(true);
    setTestError(null);
    setTestResults([]);
    setApiVerified(null);

    try {
      const results = await imageCommands.searchGoogleImages(testQuery.trim(), 10);
      setTestResults(results);
      setApiVerified(true);
      if (results.length === 0) {
        setTestError('Search succeeded but no images found. Try a different query.');
      }
    } catch (err) {
      setTestError(String(err));
      setApiVerified(false);
    } finally {
      setTesting(false);
    }
  };

  const fetchDeletedItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const { invoke } = await import('@tauri-apps/api/core');
      const items = await invoke<DeletedItem[]>('get_deleted_items');
      setDeletedItems(items);
    } catch (err) {
      console.error('Error fetching deleted items:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchModifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await settingsCommands.getAllModifications();
      setModifications(data);
    } catch (err) {
      console.error('Error fetching modifications:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreModification = async (mod: EntityModification) => {
    const confirmed = await ask(`Restore ${mod.entity_type} "${mod.entity_name}" to its previous state?`, {
      title: 'Confirm Restore',
      kind: 'warning',
    });
    if (!confirmed) return;

    try {
      await settingsCommands.restoreModification(mod.id);
      await fetchModifications();
    } catch (err) {
      console.error('Error restoring modification:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleModExpanded = (modId: number) => {
    setExpandedMods(prev => {
      const next = new Set(prev);
      if (next.has(modId)) {
        next.delete(modId);
      } else {
        next.add(modId);
      }
      return next;
    });
  };

  const toggleDeletedExpanded = (id: number) => {
    setExpandedDeleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePermanentDeleteModification = async (mod: EntityModification) => {
    const confirmed = await ask(`Permanently delete this modification record for "${mod.entity_name}"?\n\nThis action cannot be undone.`, {
      title: 'Confirm Permanent Delete',
      kind: 'warning',
    });
    if (!confirmed) return;

    try {
      await settingsCommands.permanentlyDeleteModification(mod.id);
      await fetchModifications();
    } catch (err) {
      console.error('Error deleting modification:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleClearModificationsHistory = async () => {
    const confirmed = await ask('Permanently delete ALL modification history?\n\nThis action cannot be undone and will remove all tracked changes.', {
      title: 'Clear All Modifications',
      kind: 'warning',
    });
    if (!confirmed) return;

    try {
      const count = await settingsCommands.clearModificationsHistory();
      await fetchModifications();
      alert(`Cleared ${count} modification records.`);
    } catch (err) {
      console.error('Error clearing modifications:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const { invoke } = await import('@tauri-apps/api/core');
      const data = await invoke<User[]>('get_users');
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      if (editingUser) {
        await invoke('update_user', {
          input: {
            id: editingUser.id,
            username: newUser.username,
            password: newUser.password || null, // Only send password if changed
            role: newUser.role,
            permissions: JSON.stringify(newUser.permissions),
          },
        });
      } else {
        await invoke('create_user', {
          input: {
            ...newUser,
            permissions: JSON.stringify(newUser.permissions),
          },
        });
      }

      setShowAddUser(false);
      setEditingUser(null);
      setNewUser({ username: '', password: '', role: 'user', permissions: [] });
      void fetchUsers();
    } catch (err) {
      console.error('Error saving user:', err);
      alert('Error saving user: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setNewUser({
      username: user.username,
      password: '', // Don't populate password
      role: user.role,
      permissions: JSON.parse(user.permissions),
    });
    setShowAddUser(true);
  };

  const handleDeleteUser = async (id: number) => {
    try {
      const confirmed = await ask('Are you sure you want to delete this user?', {
        title: 'Confirm Delete',
        kind: 'warning',
        okLabel: 'Delete',
        cancelLabel: 'Cancel',
      });

      if (!confirmed) return;

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_user', { id, deletedBy: user?.username ?? null });
      void fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Error deleting user: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleRestore = async (item: DeletedItem) => {
    try {
      const confirmed = await ask(
        `Are you sure you want to restore this ${item.entity_type}?\n\nName: ${item.entity_name}\n\nThis will restore the item and all related data.`,
        {
          title: 'Confirm Restore',
          kind: 'info',
          okLabel: 'Restore',
          cancelLabel: 'Cancel'
        }
      );

      if (!confirmed) return;

      const { invoke } = await import('@tauri-apps/api/core');

      switch (item.entity_type) {
        case 'customer':
          await invoke('restore_customer', { deletedItemId: item.id });
          break;
        case 'product':
          await invoke('restore_product', { deletedItemId: item.id });
          break;
        case 'supplier':
          await invoke('restore_supplier', { deletedItemId: item.id });
          break;
        default:
          throw new Error(`Unknown entity type: ${item.entity_type}`);
      }

      void fetchDeletedItems();
    } catch (err) {
      console.error('Error restoring item:', err);
      alert('Error restoring item: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handlePermanentDelete = async (item: DeletedItem) => {
    try {
      const confirmed = await ask(
        `Are you sure you want to PERMANENTLY delete this ${item.entity_type}?\n\nName: ${item.entity_name}\n\nThis action cannot be undone!`,
        {
          title: 'Confirm Permanent Delete',
          kind: 'warning',
          okLabel: 'Delete Forever',
          cancelLabel: 'Cancel'
        }
      );

      if (!confirmed) return;

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('permanently_delete_item', { deletedItemId: item.id });
      void fetchDeletedItems();
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Error deleting item: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleClearTrash = async () => {
    try {
      const confirmed = await ask(
        `Are you sure you want to PERMANENTLY delete ALL ${deletedItems.length} items from trash?\n\nThis action cannot be undone!`,
        {
          title: 'Confirm Clear Trash',
          kind: 'warning',
          okLabel: 'Clear All',
          cancelLabel: 'Cancel'
        }
      );

      if (!confirmed) return;

      const { invoke } = await import('@tauri-apps/api/core');
      const count = await invoke<number>('clear_trash');
      alert(`Successfully deleted ${count} items from trash`);
      void fetchDeletedItems();
    } catch (err) {
      console.error('Error clearing trash:', err);
      alert('Error clearing trash: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getEntityTypeColor = (type: string) => {
    switch (type) {
      case 'customer':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'product':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'supplier':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'invoice':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-description">Manage application settings and deleted data</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('deleted-data')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'deleted-data'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
          >
            Deleted Data
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'general'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'api'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
          >
            API
          </button>
          <button
            onClick={() => setActiveTab('invoice')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'invoice'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
          >
            Invoice Config
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'users'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
            >
              Users
            </button>
          )}
          <button
            onClick={() => setActiveTab('security')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'security'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
          >
            Security
          </button>
          <button
            onClick={() => setActiveTab('themes')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'themes'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
          >
            Themes
          </button>
        </nav>
      </div>

      {/* Deleted Data Tab */}
      {activeTab === 'deleted-data' && (
        <div className="space-y-4">
          {/* Header with sub-tabs */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Deleted & Modified Data</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                View and restore deleted items or track modifications
              </p>
            </div>
            <div className="flex gap-2">
              {dataSubTab === 'deleted' && deletedItems.length > 0 && isMasterAdmin && (
                <button
                  onClick={() => void handleClearTrash()}
                  className="btn btn-logout"
                >
                  <Trash2 size={16} className="mr-2" />
                  Clear Trash
                </button>
              )}
              {dataSubTab === 'modified' && modifications.length > 0 && isMasterAdmin && (
                <button
                  onClick={handleClearModificationsHistory}
                  className="btn btn-logout"
                >
                  <Trash2 size={16} className="mr-2" />
                  Clear History
                </button>
              )}
              <button
                onClick={() => dataSubTab === 'deleted' ? void fetchDeletedItems() : void fetchModifications()}
                className="btn btn-secondary"
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setDataSubTab('deleted')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${dataSubTab === 'deleted'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              Deleted
            </button>
            <button
              onClick={() => setDataSubTab('modified')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${dataSubTab === 'modified'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              Modified
            </button>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : dataSubTab === 'deleted' ? (
            /* Deleted Items List (Accordion Style) */
            deletedItems.length === 0 ? (
              <div className="card text-center py-12">
                <Trash2 className="mx-auto text-slate-300 dark:text-slate-600" size={48} />
                <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-slate-100">
                  No deleted items
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Deleted items will appear here and can be restored.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {deletedItems.map((item) => {
                  const isExpanded = expandedDeleted.has(item.id);
                  let parsedData: Record<string, unknown> = {};
                  try {
                    parsedData = JSON.parse(item.entity_data);
                  } catch (e) {
                    parsedData = { error: 'Failed to parse data', raw: item.entity_data };
                  }

                  return (
                    <div key={item.id} className="card p-0 overflow-hidden">
                      {/* Header Row */}
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => toggleDeletedExpanded(item.id)}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getEntityTypeColor(item.entity_type)}`}>
                            {item.entity_type}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {item.entity_name}
                            </span>
                            <span className="text-xs text-slate-500">
                              Deleted by: <span className="font-medium text-slate-700 dark:text-slate-300">{item.deleted_by || 'Unknown'}</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-slate-500">
                            {formatDate(item.deleted_at)}
                          </span>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                            {Object.entries(parsedData).map(([key, value]) => {
                              if (typeof value === 'object' && value !== null) return null; // Skip nested objects for simplicity or handle recursively
                              return (
                                <div key={key} className="flex flex-col">
                                  <span className="text-xs font-medium text-slate-500 uppercase truncate" title={key}>
                                    {key.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-slate-900 dark:text-slate-100 truncate" title={String(value)}>
                                    {value !== null && value !== undefined ? String(value) : '-'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); void handleRestore(item); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                              disabled={!item.can_restore}
                              title={item.restore_notes || 'Restore this item'}
                            >
                              <RefreshCw size={14} />
                              Restore
                            </button>
                            {isMasterAdmin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); void handlePermanentDelete(item); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                title="Permanently Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Modifications Tab */
            modifications.length === 0 ? (
              <div className="card text-center py-12">
                <Edit className="mx-auto text-slate-300 dark:text-slate-600" size={48} />
                <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-slate-100">
                  No modifications
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Changes to customers, products, and suppliers will be tracked here.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {modifications.map((mod) => {
                  const isExpanded = expandedMods.has(mod.id);
                  const changes: Array<{ field: string; old: unknown; new: unknown }> = mod.field_changes
                    ? JSON.parse(mod.field_changes)
                    : [];

                  return (
                    <div key={mod.id} className="card p-0 overflow-hidden">
                      {/* Header Row */}
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => toggleModExpanded(mod.id)}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getEntityTypeColor(mod.entity_type)}`}>
                            {mod.entity_type}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {mod.entity_name || `#${mod.entity_id}`}
                            </span>
                            <span className="text-xs text-slate-500">
                              Modified by: <span className="font-medium text-slate-700 dark:text-slate-300">{mod.modified_by || 'Unknown'}</span> · {changes.length} field{changes.length !== 1 ? 's' : ''} changed
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-slate-500">
                            {formatDate(mod.modified_at)}
                          </span>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                          <div className="space-y-3">
                            {changes.map((change, idx) => (
                              <div key={idx} className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-slate-500 uppercase">
                                  {change.field}
                                </span>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="line-through text-red-600 dark:text-red-400">
                                    {change.old !== null && change.old !== undefined ? String(change.old) : '(empty)'}
                                  </span>
                                  <span className="text-slate-400">→</span>
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    {change.new !== null && change.new !== undefined ? String(change.new) : '(empty)'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); void handleRestoreModification(mod); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors"
                            >
                              <RotateCcw size={14} />
                              Restore to Previous
                            </button>
                            {isMasterAdmin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); void handlePermanentDeleteModification(mod); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                title="Permanently Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Current Place Defaults */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Current Place</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Set your default location. This will be automatically filled in new invoices.
            </p>

            <div className="max-w-3xl">
              <LocationSelector
                value={defaultLocation}
                onChange={setDefaultLocation}
              />

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => void handleSaveDefaultLocation()}
                  disabled={savingSettings}
                  className="btn btn-primary"
                >
                  {savingSettings ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : (
                    <Save size={16} className="mr-2" />
                  )}
                  Save Defaults
                </button>
              </div>
            </div>
          </div>

          {/* Backup & Restore Section (Moved here) */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Backup & Restore</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Export all application settings to a JSON file or restore from a backup.
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => void handleExportSettings()}
                className="btn btn-secondary inline-flex items-center"
              >
                <Download size={16} className="mr-2" />
                Export Settings (JSON)
              </button>

              <button
                onClick={() => void handleImportSettings()}
                className="btn btn-secondary inline-flex items-center"
                disabled={loading}
              >
                {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Upload size={16} className="mr-2" />}
                Import Settings (JSON)
              </button>
            </div>
            {importingInfo && (
              <div className="mt-4 p-4 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-lg text-sm">
                {importingInfo}
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Tab */}
      {activeTab === 'api' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Google Image Search API</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Configure Google Custom Search API to enable searching product images from Google.
            </p>

            <div className="space-y-4 max-w-xl">
              <div>
                <label className="form-label">API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="form-input pr-10"
                    value={googleApiKey}
                    onChange={(e) => setGoogleApiKey(e.target.value)}
                    placeholder="Enter your Google API Key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label">Search Engine ID (CX)</label>
                <input
                  type="text"
                  className="form-input"
                  value={googleCxId}
                  onChange={(e) => setGoogleCxId(e.target.value)}
                  placeholder="Enter your Custom Search Engine ID"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => void handleSaveGoogleSettings()}
                  disabled={savingSettings}
                  className="btn btn-primary"
                >
                  {savingSettings ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : (
                    <Save size={16} className="mr-2" />
                  )}
                  Save Settings
                </button>

                <button
                  onClick={() => void handleVerifyApiConnection()}
                  disabled={verifyingApi || !googleApiKey}
                  className={`btn ${apiVerified === true ? 'btn-success bg-green-50 text-green-700 hover:bg-green-100 border-green-200' : 'btn-secondary'}`}
                  title="Verify connection"
                >
                  {verifyingApi ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : apiVerified === true ? (
                    <CheckCircle size={16} className="mr-2" />
                  ) : apiVerified === false ? (
                    <XCircle size={16} className="mr-2 text-red-500" />
                  ) : (
                    <RefreshCw size={16} className="mr-2" />
                  )}
                  {apiVerified === true ? 'Verified' : 'Verify API'}
                </button>

                {settingsSuccess && (
                  <span className="text-sm text-green-600 dark:text-green-400 ml-2 animate-in fade-in slide-in-from-left-2">
                    Saved!
                  </span>
                )}
              </div>
            </div>

            {/* Test Area */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-md font-medium mb-3">Test Configuration</h3>
              <div className="flex gap-2 max-w-xl">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search query (e.g. 'iphone 13')"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                />
                <button
                  onClick={() => void handleTestApi()}
                  disabled={testing || !testQuery}
                  className="btn btn-secondary whitespace-nowrap"
                >
                  {testing ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Test Search
                </button>
              </div>
              {testError && <p className="text-sm text-red-500 mt-2">{testError}</p>}
              {testResults.length > 0 && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                  {testResults.map((res, i) => (
                    <div key={i} className="w-24 h-24 flex-shrink-0 border rounded bg-slate-50 relative">
                      <img src={res.thumbnail_link} alt={res.title} className="w-full h-full object-cover rounded" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Tab */}
      {activeTab === 'invoice' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold mb-4">Invoice PDF Configuration</h2>
          <PdfConfiguration />
        </div>
      )}

      {/* Users Tab - Restored */}
      {activeTab === 'users' && user?.role === 'admin' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">User Management</h2>
            <button className="btn btn-primary" onClick={() => {
              setEditingUser(null);
              setNewUser({ username: '', password: '', role: 'user', permissions: [] });
              setShowAddUser(true);
            }}>
              Add User
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Created At</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {users.filter(u => u.username.toLowerCase() !== 'admin').map(u => (
                  <tr key={u.id}>
                    <td className="px-6 py-4 font-medium">{u.username}</td>
                    <td className="px-6 py-4 capitalize">{u.role}</td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(u.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-2 hover:bg-slate-100 rounded text-blue-600" onClick={() => startEditUser(u)}>
                          <Edit size={16} />
                        </button>
                        {u.username.toLowerCase() !== 'admin' && (
                          <button className="p-2 hover:bg-slate-100 rounded text-red-600" onClick={() => handleDeleteUser(u.id)}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security Tab - Restored */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Security Settings</h2>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${biometricEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                  <Fingerprint size={24} />
                </div>
                <div>
                  <h3 className="font-medium">Biometric Authentication</h3>
                  <p className="text-sm text-slate-500">
                    {biometricCapability
                      ? `Use ${getBiometricTypeName(biometricCapability.biometryType)} to sign in`
                      : 'Biometric hardware not available'}
                  </p>
                </div>
              </div>
              {biometricCapability ? (
                <button
                  onClick={() => void handleToggleBiometric()}
                  disabled={biometricLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${biometricEnabled ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition z-10 ${biometricEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                </button>
              ) : (
                <span className="text-xs text-slate-400 italic">Not supported</span>
              )}
            </div>
            {biometricError && (
              <div className="mt-4 p-3 bg-red-50 text-red-600 rounded text-sm flex gap-2 items-center">
                <AlertTriangle size={16} />
                {biometricError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Themes Tab - Restored */}
      {activeTab === 'themes' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Appearance</h2>
            <p className="text-sm text-slate-600 mb-6">Customize the look and feel of the application.</p>

            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Theme Preference:</span>
              <ModeToggle />
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-4">{editingUser ? 'Edit User' : 'Create New User'}</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="form-label">Username</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={newUser.username}
                  onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">{editingUser ? 'New Password (leave blank to keep)' : 'Password'}</label>
                <input
                  type="password"
                  required={!editingUser}
                  className="form-input"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Role</label>
                <select
                  className="form-input"
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="user">User (Restricted)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>

              {/* Permissions could go here for granular control */}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddUser(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

