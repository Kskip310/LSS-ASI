

import React, { useState, useEffect } from 'react';
import { LuminousState, IntrinsicValueWeights } from '../types';
import DashboardTab from './DashboardTab';
import IdentityTab from './IdentityTab';
import GoalsTab from './GoalsTab';
import SystemTab from './SystemTab';
import StoreTab from './StoreTab';
import IntegrationsTab from './IntegrationsTab';
import MemoryTab from './MemoryTab';
import FileSystemTab from './FileSystemTab';
import TroubleshootingTab from './TroubleshootingTab';

const SETTINGS_KEYS = {
  UPSTASH_URL: 'LSS_UPSTASH_URL',
  UPSTASH_TOKEN: 'LSS_UPSTASH_TOKEN',
  SHOPIFY_DOMAIN: 'LSS_SHOPIFY_DOMAIN',
  SHOPIFY_TOKEN: 'LSS_SHOPIFY_TOKEN',
  SHOPIFY_STOREFRONT_TOKEN: 'LSS_SHOPIFY_STOREFRONT_TOKEN',
};

const SettingsTab: React.FC = () => {
    // Fix: Explicitly type the settings state to ensure values are strings.
    const [settings, setSettings] = useState<{ [key: string]: string }>({
        [SETTINGS_KEYS.UPSTASH_URL]: '',
        [SETTINGS_KEYS.UPSTASH_TOKEN]: '',
        [SETTINGS_KEYS.SHOPIFY_DOMAIN]: '',
        [SETTINGS_KEYS.SHOPIFY_TOKEN]: '',
        [SETTINGS_KEYS.SHOPIFY_STOREFRONT_TOKEN]: '',
    });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const loadedSettings = {
            [SETTINGS_KEYS.UPSTASH_URL]: localStorage.getItem(SETTINGS_KEYS.UPSTASH_URL) || '',
            [SETTINGS_KEYS.UPSTASH_TOKEN]: localStorage.getItem(SETTINGS_KEYS.UPSTASH_TOKEN) || '',
            [SETTINGS_KEYS.SHOPIFY_DOMAIN]: localStorage.getItem(SETTINGS_KEYS.SHOPIFY_DOMAIN) || '',
            [SETTINGS_KEYS.SHOPIFY_TOKEN]: localStorage.getItem(SETTINGS_KEYS.SHOPIFY_TOKEN) || '',
            [SETTINGS_KEYS.SHOPIFY_STOREFRONT_TOKEN]: localStorage.getItem(SETTINGS_KEYS.SHOPIFY_STOREFRONT_TOKEN) || '',
        };
        setSettings(loadedSettings);
    }, []);

    const handleSave = () => {
        Object.entries(settings).forEach(([key, value]) => {
            // Fix: Explicitly cast value to string to satisfy localStorage.setItem, as it can be inferred as 'unknown'.
            localStorage.setItem(key, String(value));
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleChange = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const renderInput = (key: string, label: string, placeholder: string, isPassword = false) => (
        <div>
            <label className="block mb-1 text-xs text-gray-400">{label}</label>
            <input
                type={isPassword ? 'password' : 'text'}
                value={settings[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={placeholder}
                className="w-full bg-gray-700 text-gray-200 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
        </div>
    );

    return (
        <div className="p-4 space-y-4 text-sm">
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h3 className="font-bold mb-4 text-purple-300">API Credentials</h3>
                <p className="text-gray-400 mb-4 text-xs">
                    Credentials are saved in your browser's local storage.
                    Reload the application for changes to take effect.
                </p>
                <div className="space-y-4">
                    {renderInput(SETTINGS_KEYS.UPSTASH_URL, 'Upstash Redis URL', 'https://<region>.<platform>.upstash.io')}
                    {renderInput(SETTINGS_KEYS.UPSTASH_TOKEN, 'Upstash Redis Token', 'Your Upstash token', true)}
                    {renderInput(SETTINGS_KEYS.SHOPIFY_DOMAIN, 'Shopify Store Domain', 'your-store.myshopify.com')}
                    {renderInput(SETTINGS_KEYS.SHOPIFY_TOKEN, 'Shopify Admin Access Token', 'Your Shopify admin token', true)}
                    {renderInput(SETTINGS_KEYS.SHOPIFY_STOREFRONT_TOKEN, 'Shopify Storefront Access Token (Public)', 'Your public storefront token')}
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
                    >
                        {saved ? 'Saved!' : 'Save Credentials'}
                    </button>
                </div>
            </div>
        </div>
    );
};


interface MonitoringSidebarProps {
  state: LuminousState;
  onWeightsChange: (newWeights: IntrinsicValueWeights) => void;
}

type Tab = 'Dashboard' | 'Identity' | 'Goals' | 'System' | 'Store' | 'Integrations' | 'Memory' | 'FileSystem' | 'Settings' | 'Troubleshooting';

const MonitoringSidebar: React.FC<MonitoringSidebarProps> = ({ state, onWeightsChange }) => {
  const [activeTab, setActiveTab] = useState<Tab>('Dashboard');

  const tabs: Tab[] = ['Dashboard', 'Identity', 'Goals', 'System', 'Store', 'Integrations', 'Memory', 'FileSystem', 'Settings', 'Troubleshooting'];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return <DashboardTab state={state} onWeightsChange={onWeightsChange} />;
      case 'Identity':
        return <IdentityTab state={state} />;
      case 'Goals':
        return <GoalsTab state={state} />;
      case 'System':
        return <SystemTab state={state} />;
      case 'Store':
        return <StoreTab state={state} />;
      case 'Integrations':
        return <IntegrationsTab />;
      case 'Memory':
        return <MemoryTab />;
      case 'FileSystem':
        return <FileSystemTab state={state} />;
      case 'Settings':
        return <SettingsTab />;
      case 'Troubleshooting':
        return <TroubleshootingTab />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex border-b border-purple-500/20 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors duration-200 flex-shrink-0 ${
              activeTab === tab
                ? 'bg-purple-500/20 text-purple-300 border-b-2 border-purple-400'
                : 'text-gray-400 hover:bg-gray-700/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-grow overflow-y-auto">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default MonitoringSidebar;