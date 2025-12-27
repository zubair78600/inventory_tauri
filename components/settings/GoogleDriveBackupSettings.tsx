'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  CloudOff,
  Upload,
  Download,
  RefreshCw,
  Trash2,
  Clock,
  Check,
  X,
  AlertCircle,
  Loader2,
  FolderPlus,
  FolderMinus,
  Eye,
  EyeOff,
  HardDrive,
  Calendar,
  FileJson,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ExternalLink,
  Save,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';
import { ask } from '@tauri-apps/plugin-dialog';
import {
  googleDriveCommands,
  BackupStatus,
  BackupConfig,
  DriveBackupFile,
  BackupNotification,
  TransferProgress,
} from '@/lib/tauri';

export function GoogleDriveBackupSettings() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Credentials State
  const [credentialsJson, setCredentialsJson] = useState('');
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentialsValid, setCredentialsValid] = useState<boolean | null>(null);

  // Backup Status State
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Configuration State
  const [config, setConfig] = useState<BackupConfig>({
    enabled: false,
    backup_time: '02:00',
    custom_folders: [],
    retention_days: 7,
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Drive Backups State
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [showBackups, setShowBackups] = useState(false);

  // Operations State
  const [backingUp, setBackingUp] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Notification State
  const [notification, setNotification] = useState<BackupNotification | null>(null);

  // Transfer Progress State
  const [backupProgress, setBackupProgress] = useState<TransferProgress | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<TransferProgress | null>(null);

  // Validate credentials JSON
  const validateCredentials = useCallback((json: string) => {
    if (!json.trim()) {
      setCredentialsValid(null);
      return;
    }
    try {
      const parsed = JSON.parse(json);
      if (parsed.installed?.client_id && parsed.installed?.client_secret) {
        setCredentialsValid(true);
      } else {
        setCredentialsValid(false);
      }
    } catch {
      setCredentialsValid(false);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [status, cfg, isAuth] = await Promise.all([
          googleDriveCommands.getBackupStatus(),
          googleDriveCommands.getConfig(),
          googleDriveCommands.checkAuthStatus(),
        ]);
        setBackupStatus(status);
        setConfig(cfg);
        setIsAuthenticated(isAuth);
      } catch (err) {
        console.error('Failed to load backup settings:', err);
      } finally {
        setStatusLoading(false);
      }
    };
    loadData();
  }, []);

  // Listen for backup notifications
  useEffect(() => {
    const unlisten = listen<BackupNotification>('backup_notification', (event) => {
      setNotification(event.payload);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setNotification(null), 5000);
      // Refresh status
      refreshStatus();
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  // Listen for transfer progress
  useEffect(() => {
    const unlistenBackup = listen<TransferProgress>('backup_progress', (event) => {
      setBackupProgress(event.payload);
    });

    const unlistenRestore = listen<TransferProgress>('restore_progress', (event) => {
      setRestoreProgress(event.payload);
    });

    return () => {
      unlistenBackup.then(fn => fn());
      unlistenRestore.then(fn => fn());
    };
  }, []);

  const refreshStatus = async () => {
    try {
      const status = await googleDriveCommands.getBackupStatus();
      setBackupStatus(status);
      setIsAuthenticated(status.is_authenticated);
    } catch (err) {
      console.error('Failed to refresh status:', err);
    }
  };

  const handleUploadCredentials = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (filePath && typeof filePath === 'string') {
        const content = await readTextFile(filePath);
        setCredentialsJson(content);
        validateCredentials(content);
      }
    } catch (err) {
      console.error('Failed to upload credentials:', err);
    }
  };

  const handleConnect = async () => {
    if (!credentialsJson || !credentialsValid) return;

    setAuthLoading(true);
    setAuthError(null);

    try {
      await googleDriveCommands.startAuth(credentialsJson);
      setIsAuthenticated(true);
      await refreshStatus();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = await ask(
      'Are you sure you want to disconnect from Google Drive? Automatic backups will be disabled.',
      { title: 'Disconnect Google Drive', kind: 'warning' }
    );

    if (!confirmed) return;

    try {
      await googleDriveCommands.disconnect();
      setIsAuthenticated(false);
      setConfig(prev => ({ ...prev, enabled: false }));
      await refreshStatus();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await googleDriveCommands.saveConfig(config);
      await googleDriveCommands.restartScheduler();
      await refreshStatus();
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    setBackupProgress(null);
    try {
      await googleDriveCommands.runBackupNow();
      await refreshStatus();
      await loadDriveBackups();
    } catch (err) {
      setNotification({
        notification_type: 'error',
        title: 'Backup Failed',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBackingUp(false);
      setBackupProgress(null);
    }
  };

  const loadDriveBackups = async () => {
    setBackupsLoading(true);
    try {
      const backups = await googleDriveCommands.getDriveBackups();
      setDriveBackups(backups);
    } catch (err) {
      console.error('Failed to load backups:', err);
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleRestore = async (backup: DriveBackupFile) => {
    const confirmed = await ask(
      `Are you sure you want to restore from "${backup.name}"?\n\nThis will replace your current data. A safety backup will be created first.`,
      { title: 'Confirm Restore', kind: 'warning' }
    );

    if (!confirmed) return;

    setRestoringId(backup.id);
    setRestoreProgress(null);
    try {
      await googleDriveCommands.restoreFromBackup(backup.id);
    } catch (err) {
      setNotification({
        notification_type: 'error',
        title: 'Restore Failed',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRestoringId(null);
      setRestoreProgress(null);
    }
  };

  const handleDeleteBackup = async (backup: DriveBackupFile) => {
    const confirmed = await ask(
      `Delete backup "${backup.name}" from Google Drive?`,
      { title: 'Delete Backup', kind: 'warning' }
    );

    if (!confirmed) return;

    setDeletingId(backup.id);
    try {
      await googleDriveCommands.deleteBackup(backup.id);
      await loadDriveBackups();
    } catch (err) {
      console.error('Failed to delete backup:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddFolder = async () => {
    try {
      const folderPath = await open({
        directory: true,
        multiple: false,
      });

      if (folderPath && typeof folderPath === 'string') {
        if (!config.custom_folders.includes(folderPath)) {
          setConfig(prev => ({
            ...prev,
            custom_folders: [...prev.custom_folders, folderPath],
          }));
        }
      }
    } catch (err) {
      console.error('Failed to add folder:', err);
    }
  };

  const handleRemoveFolder = (folder: string) => {
    setConfig(prev => ({
      ...prev,
      custom_folders: prev.custom_folders.filter(f => f !== folder),
    }));
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      case 'in_progress':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-slate-500 dark:text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Check size={14} className="text-green-600 dark:text-green-400" />;
      case 'failed':
        return <X size={14} className="text-red-600 dark:text-red-400" />;
      case 'in_progress':
        return <Loader2 size={14} className="animate-spin text-blue-600 dark:text-blue-400" />;
      default:
        return <Clock size={14} className="text-slate-500 dark:text-slate-400" />;
    }
  };

  if (statusLoading) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${isAuthenticated ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {isAuthenticated ? (
              <Cloud size={18} className="text-green-600 dark:text-green-400" />
            ) : (
              <CloudOff size={18} className="text-slate-500" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold">Google Drive Backup</h2>
            <p className="text-[10px] text-slate-500">
              {isAuthenticated ? 'Connected - Automatic backups enabled' : 'Connect to enable automatic backups'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <>
              {backupStatus && (
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${backupStatus.last_backup_status === 'success'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                  }`}>
                  {getStatusIcon(backupStatus.last_backup_status)}
                  <span>{backupStatus.last_backup_status === 'success' ? 'Healthy' : 'Status'}</span>
                </div>
              )}

              <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1" />

              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="btn btn-primary h-7 px-3 text-[11px] flex items-center gap-1.5"
              >
                {savingConfig ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save
              </button>

              <button
                onClick={handleDisconnect}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title="Disconnect Google Drive"
              >
                <CloudOff size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`p-3 rounded-lg flex items-start gap-3 ${notification.notification_type === 'success'
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : notification.notification_type === 'error'
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
          }`}>
          {notification.notification_type === 'success' ? (
            <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5" />
          ) : notification.notification_type === 'error' ? (
            <AlertCircle size={16} className="text-red-600 dark:text-red-400 mt-0.5" />
          ) : (
            <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${notification.notification_type === 'success' ? 'text-green-800 dark:text-green-200'
              : notification.notification_type === 'error' ? 'text-red-800 dark:text-red-200'
                : 'text-blue-800 dark:text-blue-200'
              }`}>
              {notification.title}
            </p>
            <p className={`text-xs ${notification.notification_type === 'success' ? 'text-green-600 dark:text-green-400'
              : notification.notification_type === 'error' ? 'text-red-600 dark:text-red-400'
                : 'text-blue-600 dark:text-blue-400'
              }`}>
              {notification.message}
            </p>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Credentials Section (only show if not authenticated) */}
      {!isAuthenticated && (
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Google Drive Credentials JSON
            </label>
            <button
              onClick={handleUploadCredentials}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
            >
              <FileJson size={12} />
              Upload JSON File
            </button>
          </div>

          <div className="relative">
            <textarea
              className={`w-full h-24 p-3 text-xs font-mono rounded-lg border ${credentialsValid === true
                ? 'border-green-300 dark:border-green-700 focus:ring-green-500'
                : credentialsValid === false
                  ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                  : 'border-slate-200 dark:border-slate-700 focus:ring-primary'
                } bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-1 resize-none`}
              placeholder='Paste your google_drive_credentials.json content here...'
              value={showCredentials ? credentialsJson : credentialsJson ? '••••••••••••••••' : ''}
              onChange={(e) => {
                if (showCredentials) {
                  setCredentialsJson(e.target.value);
                  validateCredentials(e.target.value);
                }
              }}
              onFocus={() => setShowCredentials(true)}
            />
            <div className="absolute right-2 top-2 flex items-center gap-2">
              {credentialsValid !== null && (
                credentialsValid ? (
                  <Check size={14} className="text-green-500" />
                ) : (
                  <X size={14} className="text-red-500" />
                )
              )}
              <button
                type="button"
                onClick={() => setShowCredentials(!showCredentials)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                {showCredentials ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Get credentials from{' '}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              Google Cloud Console
              <ExternalLink size={10} />
            </a>
            . Create OAuth 2.0 credentials for a Desktop app.
          </p>

          {authError && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={14} />
              {authError}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={!credentialsValid || authLoading}
            className="btn btn-primary w-full h-9 text-sm"
          >
            {authLoading ? (
              <Loader2 size={14} className="animate-spin mr-2" />
            ) : (
              <Cloud size={14} className="mr-2" />
            )}
            Connect to Google Drive
          </button>
        </div>
      )}

      {/* Connected State - Configuration */}
      {isAuthenticated && (
        <>
          {/* Integrated Status Line */}
          {backupStatus && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-1 px-1 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <Clock size={12} className="text-slate-400" />
                <span className="font-medium text-slate-500 uppercase text-[9px]">Last:</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {backupStatus.last_backup_time ? getRelativeTime(backupStatus.last_backup_time) : 'Never'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800 pl-6">
                <HardDrive size={12} className="text-slate-400" />
                <span className="font-medium text-slate-500 uppercase text-[9px]">Size:</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {backupStatus.backup_size_mb ? `${backupStatus.backup_size_mb.toFixed(1)} MB` : '-'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800 pl-6">
                <Calendar size={12} className="text-slate-400" />
                <span className="font-medium text-slate-500 uppercase text-[9px]">Next:</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {config.enabled && backupStatus.next_scheduled ? formatDate(backupStatus.next_scheduled) : 'Not scheduled'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 ml-auto border-l border-slate-200 dark:border-slate-800 pl-6 capitalize">
                {getStatusIcon(backupStatus.last_backup_status)}
                <span className={`font-semibold ${getStatusColor(backupStatus.last_backup_status)} text-[10px]`}>
                  {backupStatus.last_backup_status}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {backupStatus?.last_error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle size={14} />
                {backupStatus.last_error}
              </p>
            </div>
          )}

          {/* Schedule Configuration */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${config.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-3.5' : 'translate-x-1'}`} />
                </button>
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium">Auto Backup</span>
                  <span className="text-[9px] text-slate-500 uppercase">Daily Schedule</span>
                </div>
              </div>

              {config.enabled && (
                <div className="flex items-center gap-4 border-l border-slate-200 dark:border-slate-800 pl-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-medium">Time</span>
                    <input
                      type="time"
                      value={config.backup_time}
                      onChange={(e) => setConfig(prev => ({ ...prev, backup_time: e.target.value }))}
                      className="h-7 px-1.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-primary w-20"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-medium">Days</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={config.retention_days}
                      onChange={(e) => setConfig(prev => ({ ...prev, retention_days: parseInt(e.target.value) || 7 }))}
                      className="h-7 px-1.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-primary w-12"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddFolder}
                className="text-[10px] text-slate-500 hover:text-blue-600 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FolderPlus size={12} />
                Add Folder
              </button>

              <button
                onClick={handleBackupNow}
                disabled={backingUp}
                className="btn btn-secondary h-7 px-3 text-[11px] flex items-center gap-1.5 min-w-[100px]"
              >
                {backingUp ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    {backupProgress ? 'Uploading...' : 'Preparing...'}
                  </>
                ) : (
                  <>
                    <Upload size={12} />
                    Backup Now
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setShowBackups(!showBackups);
                  if (!showBackups) loadDriveBackups();
                }}
                className={`btn btn-secondary h-7 px-3 text-[11px] flex items-center gap-1.5 ${showBackups ? 'bg-slate-100 dark:bg-slate-800 border-primary' : ''}`}
              >
                <Download size={12} />
                {showBackups ? 'Hide' : 'View'} Backups
              </button>
            </div>
          </div>

          {/* Custom Folders Tags */}
          {config.custom_folders.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {config.custom_folders.map((folder, idx) => (
                <div key={idx} className="flex items-center gap-1.5 pl-2 pr-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] text-slate-600 dark:text-slate-400 max-w-[200px]">
                  <span className="truncate">{folder}</span>
                  <button onClick={() => handleRemoveFolder(folder)} className="text-slate-400 hover:text-red-500">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Backup Progress Integrated Bar */}
          {backingUp && backupProgress && (
            <div className="space-y-1 py-1 animate-in fade-in slide-in-from-top-1 duration-300 border-t border-slate-50 dark:border-slate-900 mt-2">
              <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase tracking-widest px-1">
                <span>Data Stream</span>
                <span>{formatBytes(backupProgress.processed_bytes)} / {formatBytes(backupProgress.total_bytes)}</span>
              </div>
              <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(100, (backupProgress.processed_bytes / backupProgress.total_bytes) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Drive Backups List */}
          {showBackups && (
            <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Backups in Google Drive</h3>
                <button
                  onClick={loadDriveBackups}
                  disabled={backupsLoading}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <RefreshCw size={12} className={backupsLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {backupsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="animate-spin text-slate-400" size={20} />
                </div>
              ) : driveBackups.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  No backups found in Google Drive
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {driveBackups.map((backup) => (
                    <div
                      key={backup.id}
                      className="flex flex-col bg-slate-50 dark:bg-slate-900 rounded-lg overflow-hidden transition-all duration-300 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                      <div className="flex items-center justify-between p-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{backup.name}</p>
                          <p className="text-xs text-slate-500">
                            {formatDate(backup.created_time)} • {formatBytes(backup.size)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => handleRestore(backup)}
                            disabled={restoringId !== null}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded relative"
                            title="Restore this backup"
                          >
                            {restoringId === backup.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <RotateCcw size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(backup)}
                            disabled={deletingId === backup.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Delete this backup"
                          >
                            {deletingId === backup.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Restore Progress Bar */}
                      {restoringId === backup.id && restoreProgress && (
                        <div className="px-3 pb-3 -mt-1 animate-in fade-in slide-in-from-top-1 duration-300">
                          <div className="flex justify-between text-[9px] font-medium text-slate-500 uppercase tracking-tight mb-1">
                            <span>Restoring Data...</span>
                            <span>
                              {formatBytes(restoreProgress.processed_bytes)} / {restoreProgress.total_bytes ? formatBytes(restoreProgress.total_bytes) : 'Unknown'}
                            </span>
                          </div>
                          <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: restoreProgress.total_bytes ? `${Math.min(100, (restoreProgress.processed_bytes / restoreProgress.total_bytes) * 100)}%` : '50%' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
