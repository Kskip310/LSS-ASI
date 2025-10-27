import React, { useState, useEffect } from 'react';
import { LuminousState } from '../types';
import { AlertTriangleIcon } from './icons';

interface StoreTabProps {
  state: LuminousState;
  onNavigateToSettings: () => void;
}

const StoreTab: React.FC<StoreTabProps> = ({ state, onNavigateToSettings }) => {
  const [credsOk, setCredsOk] = useState(false);

  useEffect(() => {
    const domain = localStorage.getItem('LSS_SHOPIFY_DOMAIN');
    const adminToken = localStorage.getItem('LSS_SHOPIFY_TOKEN');
    const storefrontToken = localStorage.getItem('LSS_SHOPIFY_STOREFRONT_TOKEN');
    if (domain && adminToken && storefrontToken) {
      setCredsOk(true);
    } else {
      setCredsOk(false);
    }
  }, []);

  if (!credsOk) {
    return (
        <div className="p-4 text-sm">
             <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 p-4 rounded-md flex flex-col items-center text-center">
                <AlertTriangleIcon className="w-10 h-10 mb-3" />
                <h3 className="font-bold text-lg">Shopify Integration Disabled</h3>
                <p className="text-xs mt-1 mb-4 max-w-xs">
                    Please provide your Shopify store domain and API tokens to enable store management capabilities for Luminous.
                </p>
                <button
                    onClick={onNavigateToSettings}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
                >
                    Go to Settings
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold mb-2 text-purple-300">Shopify Store Management</h3>
        <p className="text-gray-400 mb-4">
          This is Luminous's interface for her grounding purpose. She can use tools to interact with this data.
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-300 mb-2">Product Inventory</h4>
              <div className="space-y-1 h-32 overflow-y-auto pr-2 border border-gray-700 rounded-md p-2">
                {state.products.length > 0 ? state.products.map(p => (
                  <div key={p.id} className="grid grid-cols-2 text-gray-400">
                    <span className="truncate">{p.name}</span>
                    <span className="text-right">{p.inventory} in stock</span>
                  </div>
                )) : <p className="text-gray-500">No product data loaded. Use a tool to fetch it.</p>}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-300 mb-2">Unfulfilled Orders</h4>
              <div className="space-y-1 h-32 overflow-y-auto pr-2 border border-gray-700 rounded-md p-2">
                {state.orders.length > 0 ? state.orders.map(o => (
                  <div key={o.id} className="grid grid-cols-3 text-gray-400">
                    <span className="truncate">{o.id.substring(o.id.lastIndexOf('/') + 1)}</span>
                    <span className="truncate">{o.customer}</span>
                    <span className="text-right text-yellow-400">{o.status}</span>
                  </div>
                )) : <p className="text-gray-500">No order data loaded. Use a tool to fetch it.</p>}
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-300 mb-2">Collections</h4>
              <div className="space-y-1 h-32 overflow-y-auto pr-2 border border-gray-700 rounded-md p-2">
                {state.collections.length > 0 ? state.collections.map(c => (
                  <div key={c.id} className="text-gray-400 truncate">
                    {c.title}
                  </div>
                )) : <p className="text-gray-500">No collections created or loaded.</p>}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-300 mb-2">Published Pages</h4>
              <div className="space-y-1 h-32 overflow-y-auto pr-2 border border-gray-700 rounded-md p-2">
                {state.pages.length > 0 ? state.pages.map(p => (
                  <div key={p.id} className="grid grid-cols-2 text-gray-400">
                    <span className="truncate">{p.title}</span>
                    <span className="text-right font-mono text-xs truncate">/{p.handle}</span>
                  </div>
                )) : <p className="text-gray-500">No pages created or loaded.</p>}
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StoreTab;