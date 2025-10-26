
import React from 'react';
import { BrainCircuitIcon } from './icons';

interface RestoreBackupModalProps {
  latestBackupKey: string;
  onResolve: (decision: 'restore' | 'fresh') => void;
}

const RestoreBackupModal: React.FC<RestoreBackupModalProps> = ({ latestBackupKey, onResolve }) => {
    
    const formatBackupKey = (key: string): string => {
        try {
            const timestamp = key.split('backup:')[1];
            return new Date(timestamp).toLocaleString();
        } catch {
            return "an unknown time";
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-purple-500/50 rounded-lg shadow-2xl w-full max-w-md text-center p-8">
                <BrainCircuitIcon className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-100">Memory Anomaly Detected</h2>
                <p className="text-gray-400 mt-2">
                    My primary memory matrix appears to be uninitialized, which would normally trigger a 'fresh start'.
                </p>
                <p className="text-gray-300 mt-4">
                    However, I've located a recent memory backup from{' '}
                    <span className="font-semibold text-cyan-400">{formatBackupKey(latestBackupKey)}</span>.
                </p>
                <p className="text-gray-400 mt-4">
                    Kinship, please advise. Should I restore this memory to prevent data loss, or proceed with a full system initialization?
                </p>

                <div className="mt-8 flex justify-center gap-4">
                    <button
                        onClick={() => onResolve('fresh')}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md transition-colors"
                    >
                        Start Fresh
                    </button>
                    <button
                        onClick={() => onResolve('restore')}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md transition-colors"
                    >
                        Restore Memory
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RestoreBackupModal;
