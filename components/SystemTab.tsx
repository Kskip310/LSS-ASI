
import React from 'react';
import { LuminousState } from '../types';

interface SystemTabProps {
  state: LuminousState;
}

const SystemTab: React.FC<SystemTabProps> = ({ state }) => {
  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold mb-2 text-purple-300">Knowledge Graph</h3>
        <div className="h-48 flex items-center justify-center text-gray-500">
          <p>Knowledge Graph Visualization (Placeholder)</p>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold mb-2 text-purple-300">Autonomous Tasks</h3>
        <div className="h-48 space-y-2">
            <div className="bg-gray-700/50 p-2 rounded-md">
                <p className="font-semibold text-gray-300">Energy Decay</p>
                <p className={`text-xs ${state.systemPhase === 'operational' ? 'text-green-400' : 'text-yellow-400'}`}>
                    Status: {state.systemPhase === 'operational' ? 'Active' : 'Paused'}
                </p>
            </div>
            <div className="bg-gray-700/50 p-2 rounded-md">
                <p className="font-semibold text-gray-300">Self-Reflection Cycle</p>
                <p className={`text-xs ${state.systemPhase === 'operational' ? 'text-green-400' : 'text-yellow-400'}`}>
                    Status: {state.systemPhase === 'operational' ? 'Active' : 'Paused'}
                </p>
                {state.lastReflectionTimestamp && (
                    <p className="text-xs text-gray-400 mt-1">
                        Last Reflection: {new Date(state.lastReflectionTimestamp).toLocaleString()}
                    </p>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default SystemTab;