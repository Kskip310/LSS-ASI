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

interface MonitoringSidebarProps {
  state: LuminousState;
  onWeightsChange: (newWeights: IntrinsicValueWeights) => void;
}

type Tab = 'Dashboard' | 'Identity' | 'Goals' | 'System' | 'Store' | 'Integrations' | 'Memory' | 'FileSystem';

const MonitoringSidebar: React.FC<MonitoringSidebarProps> = ({ state, onWeightsChange }) => {
  const [activeTab, setActiveTab] = useState<Tab>('Dashboard');

  const tabs: Tab[] = ['Dashboard', 'Identity', 'Goals', 'System', 'Store', 'Integrations', 'Memory', 'FileSystem'];

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