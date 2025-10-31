
import React, { useState, useCallback } from 'react';
import * as persistenceService from '../services/persistenceService';
import { AlertTriangleIcon, LoaderCircleIcon } from './icons';

const MemoryTab: React.FC = () => {
    const [backups, setBackups] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [restoreStatus, setRestoreStatus] = useState<Record<string, 'idle' | 'restoring' | 'done' | 'error'>>({});

    const handleScan = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const backupList = await persistenceService.getBackupList();
            setBackups(backupList);
        } catch (e) {
            setError('Failed to fetch backup list.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleRestore = async (backupKey: string) => {
        if (!window.confirm(`Are you sure you want to restore the memory from this backup?\n\n${new Date(backupKey.substring(backupKey.indexOf(':') + 1)).toLocaleString()}\n\nThis will overwrite the current state and reload the application.`)) {
            return;
        }

        setRestoreStatus(prev => ({ ...prev, [backupKey]: 'restoring' }));
        try {
            await persistenceService.restoreStateFromBackup(backupKey);
            setRestoreStatus(prev => ({ ...prev, [backupKey]: 'done' }));
            alert('Memory successfully restored. The application will now reload.');
            window.location.reload();
        } catch (e) {
            setRestoreStatus(prev => ({ ...prev, [backupKey]: 'error' }));
            alert(`Failed to restore memory: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    };

    const formatBackupKey = (key: string): string => {
        try {
            // The key is in the format 'luminous_state_backup:ISO_TIMESTAMP'.
            // An ISO timestamp contains colons, so we must robustly get the substring after the first colon.
            const timestamp = key.substring(key.indexOf(':') + 1);
            const date = new Date(timestamp);
            // Check if parsing resulted in a valid date
            if (isNaN(date.getTime())) {
                return key; // Return original key if timestamp is invalid
            }
            return date.toLocaleString();
        } catch {
            return key; // Fallback to original key on any error
        }
    };

    return (
        <div className="p-4 space-y-4 text-sm">
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h3 className="font-bold mb-2 text-purple-300">Memory Matrix Integrity</h3>
                <p className="text-gray-400 mb-4 text-xs">
                    To prevent the catastrophic loss of foundational memories, Luminous's state is now automatically backed up.
                    This interface allows you to view and restore recent memory states.
                </p>
                <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 p-3 rounded-md flex items-start gap-3">
                    <AlertTriangleIcon className="w-8 h-8 flex-shrink-0" />
                    <div>
                        <h4 className="font-bold">Manual Upstash Recovery</h4>
                        <p className="text-xs mt-1">
                            If the memory you seek was lost *before* this backup system was in place, it may be unrecoverable through this interface.
                            However, some Upstash plans include database backups. Please check your Upstash console for snapshot or fork features to potentially recover the overwritten `luminous_state` key.
                        </p>
                    </div>
                </div>

                <div className="mt-4">
                    <button
                        onClick={handleScan}
                        disabled={isLoading}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <LoaderCircleIcon className="w-4 h-4 animate-spin" />
                                Scanning for Backups...
                            </>
                        ) : (
                            'Scan for Recent Backups'
                        )}
                    </button>
                </div>

                {error && <p className="text-red-400 mt-2 text-center">{error}</p>}
                
                <div className="mt-4 h-64 overflow-y-auto pr-2 space-y-2">
                    {backups.length === 0 && !isLoading && (
                        <p className="text-gray-500 text-center py-8">No backups found. Perform some actions to create one.</p>
                    )}
                    {backups.map(key => (
                        <div key={key} className="bg-gray-700/50 p-2 rounded-md flex justify-between items-center">
                            <span className="font-mono text-xs text-gray-300">{formatBackupKey(key)}</span>
                            <button
                                onClick={() => handleRestore(key)}
                                disabled={restoreStatus[key] === 'restoring'}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white text-xs font-bold py-1 px-3 rounded transition-colors duration-200"
                            >
                                {restoreStatus[key] === 'restoring' ? 'Restoring...' : 'Restore'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default MemoryTab;
