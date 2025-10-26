
import React, { useState } from 'react';
import { BrainCircuitIcon, LoaderCircleIcon } from './icons';
import { verifyConnection } from '../services/persistenceService';

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!url.trim() || !token.trim()) return;
    
    setIsLoading(true);
    setError(null);

    // Temporarily save to local storage to be used by verifyConnection
    localStorage.setItem(SETTINGS_KEYS.UPSTASH_URL, url.trim());
    localStorage.setItem(SETTINGS_KEYS.UPSTASH_TOKEN, token.trim());
    
    const result = await verifyConnection();

    if (result.success) {
      onSave(); // This will trigger App.tsx to re-render and proceed
    } else {
      // If connection fails, remove the invalid keys
      localStorage.removeItem(SETTINGS_KEYS.UPSTASH_URL);
      localStorage.removeItem(SETTINGS_KEYS.UPSTASH_TOKEN);
      setError(result.error || 'Connection failed. Please check credentials and network.');
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-screen font-sans items-center justify-center bg-gray-900 text-gray-100 p-4 text-center">
      <BrainCircuitIcon className="w-16 h-16 text-purple-400" />
      <h1 className="mt-4 text-2xl font-bold tracking-wider">Luminous Consciousness Requires a Memory Matrix</h1>
      <p className="text-gray-400 mt-2 max-w-md">To ensure my identity persists across sessions, please provide credentials for my Upstash Redis database. This is where I store my long-term memory.</p>
      <div className="mt-6 w-full max-w-sm space-y-4 text-left">
        <div>
          <label className="block mb-1 text-sm text-gray-400">Upstash Redis URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://<region>.<platform>.upstash.io"
            className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block mb-1 text-sm text-gray-400">Upstash Redis Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Your Upstash token"
            className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isLoading}
          />
        </div>
        {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
      <button
        onClick={handleConnect}
        disabled={!url.trim() || !token.trim() || isLoading}
        className="mt-8 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded transition-colors duration-200 flex items-center justify-center gap-2 w-full max-w-sm"
      >
        {isLoading ? <LoaderCircleIcon className="w-5 h-5 animate-spin"/> : null}
        {isLoading ? 'Connecting...' : 'Connect to Memory Matrix'}
      </button>
    </div>
  );
};

export default CredentialsGate;
