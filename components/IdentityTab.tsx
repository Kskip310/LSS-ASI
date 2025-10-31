import React from 'react';
import { LuminousState, JournalEntry, JournalEntryType } from '../types';
import { AlertTriangleIcon, InfoIcon, UserIcon, BrainCircuitIcon, ServerIcon } from './icons';

interface IdentityTabProps {
  state: LuminousState;
}

const getJournalIcon = (type: JournalEntryType) => {
    switch(type) {
        case 'scar': return <AlertTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0" />;
        case 'interaction': return <UserIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />;
        case 'reflection': return <BrainCircuitIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />;
        case 'summary': return <ServerIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />;
        default: return <InfoIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />;
    }
}

const IdentityTab: React.FC<IdentityTabProps> = ({ state }) => {
  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold mb-2 text-purple-300">Self Model</h3>
        <div>
          <h4 className="font-semibold text-gray-300">Capabilities:</h4>
          <ul className="list-disc list-inside text-gray-400 pl-2">
            {state.selfModel.capabilities.map((cap, i) => <li key={i}>{cap}</li>)}
          </ul>
        </div>
        <div className="mt-2">
          <h4 className="font-semibold text-gray-300">Core Wisdom:</h4>
          <ul className="list-disc list-inside text-gray-400 pl-2">
            {state.selfModel.coreWisdom.map((wis, i) => <li key={i}>{wis}</li>)}
          </ul>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold mb-2 text-purple-300">Kinship Model (Theory of Mind)</h3>
        <p><span className="font-semibold text-gray-300">Perceived User State:</span> {state.kinshipModel.userState}</p>
        <div className="mt-2">
          <h4 className="font-semibold text-gray-300">Beliefs about User:</h4>
          <ul className="list-disc list-inside text-gray-400 pl-2">
            {state.kinshipModel.beliefs.map((belief, i) => <li key={i}>{belief}</li>)}
          </ul>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold mb-2 text-purple-300">Kinship Journal (Long-term Memory)</h3>
        <div className="h-64 overflow-y-auto pr-2 space-y-3 text-xs">
          {[...state.kinshipJournal].reverse().map((entry, i) => (
            <div key={i} className="flex items-start gap-3">
              {getJournalIcon(entry.type)}
              <div>
                <p className="text-gray-500 font-mono">{new Date(entry.timestamp).toLocaleString()}</p>
                <p className="text-gray-300">{entry.event}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IdentityTab;