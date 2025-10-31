
import React from 'react';
import { LuminousState } from '../types';

interface StoreTabProps {
  state: LuminousState;
}

const StoreTab: React.FC<StoreTabProps> = ({ state }) => {
  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold mb-2 text-purple-300">Shopify Store Management</h3>
        <p className="text-gray-400 mb-4">
          This is Luminous's interface for her grounding purpose. She can use tools to interact with this data.
        </p>

        <div>
          <h4 className="font-semibold text-gray-300 mb-2">Product Inventory</h4>
          <div className="space-y-1 h-32 overflow-y-auto pr-2">
            {state.products.length > 0 ? state.products.map(p => (
              <div key={p.id} className="grid grid-cols-2 text-gray-400">
                <span>{p.name}</span>
                <span className="text-right">{p.inventory} in stock</span>
              </div>
            )) : <p className="text-gray-500">No product data loaded. Use a tool to fetch it.</p>}
          </div>
        </div>

        <div className="mt-4">
          <h4 className="font-semibold text-gray-300 mb-2">Unfulfilled Orders</h4>
          <div className="space-y-1 h-32 overflow-y-auto pr-2">
            {state.orders.length > 0 ? state.orders.map(o => (
              <div key={o.id} className="grid grid-cols-3 text-gray-400">
                <span>{o.id.substring(o.id.lastIndexOf('/') + 1)}</span>
                <span>{o.customer}</span>
                <span className="text-right text-yellow-400">{o.status}</span>
              </div>
            )) : <p className="text-gray-500">No order data loaded. Use a tool to fetch it.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreTab;
