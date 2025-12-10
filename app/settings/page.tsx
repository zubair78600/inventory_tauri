'use client';

import { useState, useEffect } from 'react';
import { Trash2, RefreshCw, AlertCircle, Loader2, Edit, Eye, EyeOff, Save, ExternalLink, Search, CheckCircle, XCircle, Download, Upload, FileJson } from 'lucide-react';
import { ask, save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { settingsCommands, imageCommands, GoogleImageResult } from '@/lib/tauri';

type DeletedItem = {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  deleted_at: string;
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
import {
  checkBiometricCapability,
  enrollBiometric,
  disableBiometric,
  isBiometricEnabled,
  getBiometricTypeName,
  getBiometricErrorMessage,
  type BiometricCapability,
} from '@/lib/biometric';
import { Fingerprint, AlertTriangle } from 'lucide-react';
import { LocationSelector } from '@/components/shared/LocationSelector';
import type { LocationValue } from '@/types/location';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'deleted-data' | 'general' | 'api' | 'users' | 'security' | 'themes'>('deleted-data');
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
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
      void fetchDeletedItems();
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
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Deleted Items</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                View and restore deleted items from the trash
              </p>
            </div>
            <button
              onClick={() => void fetchDeletedItems()}
              className="btn btn-secondary"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
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
          ) : deletedItems.length === 0 ? (
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
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Deleted At
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                    {deletedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getEntityTypeColor(item.entity_type)}`}>
                            {item.entity_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">
                          {item.entity_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                          {formatDate(item.deleted_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => void handleRestore(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                            disabled={!item.can_restore}
                            title={item.restore_notes || 'Restore this item'}
                          >
                            <RefreshCw size={14} />
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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

          {/* Google Image Search API Section */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">General Settings</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              General application settings will appear here.
            </p>
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

              <div className="flex items-center gap-3">
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
                  <span className="text-sm text-green-600 dark:text-green-400">
                    Settings saved successfully!
                  </span>
                )}
              </div>
            </div>

            {/* Backup & Restore Section */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold mb-4">Backup & Restore Settings</h2>
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
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md text-sm border border-blue-100 dark:border-blue-800 flex items-center gap-2">
                  <FileJson size={16} />
                  {importingInfo}
                </div>
              )}
            </div>

            {/* Test API Section */}
            {googleApiKey && googleCxId && (
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-4">Test API - Search Images</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Enter a product name to test if the API is working correctly.
                </p>

                <div className="flex gap-2 max-w-xl">
                  <input
                    type="text"
                    className="form-input flex-1"
                    placeholder="Enter a product name (e.g., Ponds Magic Powder)"
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTestApi()}
                  />
                  <button
                    onClick={() => void handleTestApi()}
                    disabled={testing || !testQuery.trim()}
                    className="btn btn-primary"
                  >
                    {testing ? (
                      <Loader2 size={16} className="animate-spin mr-2" />
                    ) : (
                      <Search size={16} className="mr-2" />
                    )}
                    Search
                  </button>
                </div>

                {testError && (
                  <div className="mt-3 flex items-center gap-2 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800 max-w-xl">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{testError}</span>
                  </div>
                )}

                {/* Test Results Grid */}
                {testResults.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle size={16} className="text-green-600" />
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                        API working! Found {testResults.length} images
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 max-w-2xl">
                      {testResults.map((result, idx) => (
                        <div
                          key={idx}
                          className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        >
                          <img
                            src={result.thumbnail_link}
                            alt={result.title}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                            title={`${result.title}\n${result.display_link}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Setup Instructions */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">How to get API credentials</h3>
              <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
                <li>
                  Go to{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Google Cloud Console <ExternalLink size={12} />
                  </a>{' '}
                  and create a project
                </li>
                <li>Enable the "Custom Search API" for your project</li>
                <li>Create an API Key under Credentials</li>
                <li>
                  Go to{' '}
                  <a
                    href="https://programmablesearchengine.google.com/controlpanel/all"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Programmable Search Engine <ExternalLink size={12} />
                  </a>{' '}
                  and create a search engine
                </li>
                <li>Enable "Image Search" and "Search the entire web" in settings</li>
                <li>Copy the Search Engine ID (cx parameter)</li>
              </ol>
              <p className="mt-4 text-xs text-amber-600 dark:text-amber-500">
                Note: Free tier allows 100 searches per day. For higher usage, billing must be enabled.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">User Management</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Manage users and their access permissions
              </p>
            </div>
            <button
              onClick={() => {
                setEditingUser(null);
                setNewUser({ username: '', password: '', role: 'user', permissions: [] });
                setShowAddUser(true);
              }}
              className="btn btn-primary"
            >
              Add User
            </button>
          </div>

          {showAddUser && (
            <div className="card p-6 border-2 border-primary/10">
              <h3 className="text-lg font-medium mb-4">{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Password {editingUser && <span className="text-xs text-slate-500 font-normal">(Leave blank to keep current)</span>}</label>
                    <input
                      type="password"
                      className="form-input"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required={!editingUser}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {newUser.role === 'user' && (
                  <div>
                    <label className="form-label mb-2">Permissions</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {PERMISSIONS.map((perm) => (
                        <label key={perm.id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-primary focus:ring-primary"
                            checked={newUser.permissions.includes(perm.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewUser({
                                  ...newUser,
                                  permissions: [...newUser.permissions, perm.id],
                                });
                              } else {
                                setNewUser({
                                  ...newUser,
                                  permissions: newUser.permissions.filter((p) => p !== perm.id),
                                });
                              }
                            }}
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {perm.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Permissions</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 font-medium">{user.username}</td>
                    <td className="px-6 py-4 capitalize">
                      <span className={`badge ${user.role === 'admin' ? 'badge-primary bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {user.role === 'admin' ? (
                        <span className="text-slate-400 italic">All Access</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            try {
                              const perms = JSON.parse(user.permissions);
                              return perms.map((p: string) => (
                                <span key={p} className="text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {PERMISSIONS.find(pm => pm.id === p)?.label || p}
                                </span>
                              ));
                            } catch {
                              return <span className="text-red-500">Error parsing permissions</span>;
                            }
                          })()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user.username !== 'Admin' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEditUser(user)}
                            className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                            title="Edit User"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => void handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Fingerprint size={20} />
              Fingerprint Login
            </h2>

            {biometricError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{biometricError}</p>
              </div>
            )}

            {!biometricCapability ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-primary" size={24} />
                <span className="ml-2 text-slate-600 dark:text-slate-400">Checking biometric availability...</span>
              </div>
            ) : !biometricCapability.isAvailable ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-amber-700 dark:text-amber-300 font-medium">
                  Fingerprint authentication is not available on this device
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  {biometricCapability.error || 'Please ensure you have Touch ID or Windows Hello configured in your system settings.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {getBiometricTypeName(biometricCapability.biometryType)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Use fingerprint to sign in quickly without entering your password
                    </p>
                  </div>
                  <button
                    onClick={() => void handleToggleBiometric()}
                    disabled={biometricLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${biometricEnabled ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                      } ${biometricLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${biometricEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>

                {biometricEnabled && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                      <CheckCircle size={16} />
                      Fingerprint login is enabled. You can now sign in using your fingerprint on the login screen.
                    </p>
                  </div>
                )}

                {/* Security Warning about OS-level biometrics */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-start gap-3">
                  <AlertTriangle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={16} />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Important Security Note
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      This feature uses the fingerprints registered to this computer&apos;s System Account.
                      Any fingerprint that can unlock this computer will be able to log in as <strong>{user?.username}</strong>.
                    </p>
                  </div>
                </div>

                {!biometricEnabled && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Enable fingerprint login to quickly sign in without entering your password each time.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Security Info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Security Information</h2>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <p>
                <strong className="text-slate-900 dark:text-slate-100">How it works:</strong> When you enable fingerprint login, a secure token is generated and stored in your system&apos;s secure storage. Your actual fingerprint data never leaves your device.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-slate-100">Per-user setting:</strong> Each user account can independently enable or disable fingerprint login.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-slate-100">Password fallback:</strong> You can always use your password to sign in, even if fingerprint is enabled.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Themes Tab */}
      {activeTab === 'themes' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Appearance</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Theme Preference</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Switch between light and dark mode
              </p>
            </div>
            <ModeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
