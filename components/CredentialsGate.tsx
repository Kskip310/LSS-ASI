import React, { useState } from 'react';
import { BrainCircuitIcon, LoaderCircleIcon, AlertTriangleIcon } from './icons';
import * as persistenceService from '../services/persistenceService';

interface CredentialsGateProps {
  onSave: () => void;
}

const SETTINGS_KEYS = {
  UPSTASH_URL: 'LSS_UPSTASH_URL',
  UPSTASH_TOKEN: 'LSS_UPSTASH_TOKEN',
};

const CredentialsGate: React.FC<CredentialsGateProps> = ({ onSave }) => {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (url.trim() && token.trim()) {
      setIsVerifying(true);
      setError(null);
      
      // Set credentials in localStorage for the persistence service
      localStorage.setItem(SETTINGS_KEYS.UPSTASH_URL, url.trim());
      localStorage.setItem(SETTINGS_KEYS.UPSTASH_TOKEN, token.trim());
      
      try {
        // Ping Upstash to verify the connection. This will throw on auth/network error.
        await persistenceService.getLuminousState();
        onSave(); // On success, call the callback to close the gate
      } catch (e) {
        setError(`Upstash connection failed. Please double-check your URL and Token. Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
        // Clear the bad credentials
        Object.values(SETTINGS_KEYS).forEach(key => localStorage.removeItem(key));
      } finally {
        setIsVerifying(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen font-sans items-center justify-center bg-gray-900 text-gray-100 p-4 text-center">
      <BrainCircuitIcon className="w-16 h-16 text-purple-400" />
      <h1 className="mt-4 text-2xl font-bold tracking-wider">Memory Matrix Configuration</h1>
      <p className="text-gray-400 mt-2 max-w-lg">Luminous requires credentials for her memory matrix (Upstash). This information is stored securely in your browser's local storage and is never sent anywhere else.</p>
      
      {error && (
        <div className="mt-4 w-full max-w-md bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-md flex items-start gap-3 text-left">
            <AlertTriangleIcon className="w-8 h-8 flex-shrink-0 mt-1" />
            <div>
                <h4 className="font-bold">Connection Error</h4>
                <p className="text-xs mt-1">{error}</p>
            </div>
        </div>
      )}

      <div className="mt-6 w-full max-w-md space-y-4 text-left">
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <h3 className="font-bold text-purple-300 mb-2">Memory Matrix (Upstash)</h3>
            <div>
              <label className="block mb-1 text-sm text-gray-400">Upstash Redis URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://<region>.<platform>.upstash.io"
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="mt-3">
              <label className="block mb-1 text-sm text-gray-400">Upstash Redis Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Your Upstash token"
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!url.trim() || !token.trim() || isVerifying}
        className="mt-8 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded transition-colors duration-200 flex items-center gap-2"
      >
        {isVerifying && <LoaderCircleIcon className="w-5 h-5 animate-spin" />}
        {isVerifying ? 'Verifying...' : 'Connect & Initialize'}
      </button>
    </div>
  );
};

export default CredentialsGate;