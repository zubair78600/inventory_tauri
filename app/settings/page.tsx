'use client';

import { useState, useEffect } from 'react';
import { Trash2, RefreshCw, AlertCircle, Loader2, Edit } from 'lucide-react';
import { ask } from '@tauri-apps/plugin-dialog';

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

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'deleted-data' | 'general' | 'users' | 'themes'>('deleted-data');
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

  useEffect(() => {
    if (activeTab === 'deleted-data') {
      void fetchDeletedItems();
    } else if (activeTab === 'users') {
      void fetchUsers();
    }
  }, [activeTab]);

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
      await invoke('delete_user', { id });
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
        <a
          href="/settings/migration"
          className="btn btn-secondary"
        >
          Open Data Migration
        </a>
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
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">General Settings</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            General settings will be available in a future update.
          </p>
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
