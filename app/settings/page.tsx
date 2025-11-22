'use client';

import { useState, useEffect } from 'react';
import { Trash2, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'deleted-data' | 'general'>('deleted-data');
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'deleted-data') {
      void fetchDeletedItems();
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
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage application settings and deleted data</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('deleted-data')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'deleted-data'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Deleted Data
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'general'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            General
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
    </div>
  );
}
