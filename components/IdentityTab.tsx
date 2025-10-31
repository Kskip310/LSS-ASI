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
  const groupedEntries = state.kinshipJournal.reduce((acc, entry) => {
    (acc[entry.type] = acc[entry.type] || []).push(entry);
    return acc;
  }, {} as Record<JournalEntryType, JournalEntry[]>);

  const groupOrder: JournalEntryType[] = ['scar', 'reflection', 'interaction', 'summary', 'system'];
  
  const groupStyles: Record<JournalEntryType, { title: string, color: string }> = {
    scar: { title: 'Scars (Critical Errors)', color: 'border-red-500/50' },
    reflection: { title: 'Reflections (Internal Synthesis)', color: 'border-purple-500/50' },
    interaction: { title: 'Interactions (Kinship & Tools)', color: 'border-blue-500/50' },
    summary: { title: 'Memory Summaries', color: 'border-cyan-500/50' },
    system: { title: 'System Events', color: 'border-gray-500/50' },
  };

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
        <div className="h-64 overflow-y-auto pr-2 space-y-4 text-xs">
          {groupOrder.map(type => {
            const entries = groupedEntries[type];
            if (!entries || entries.length === 0) return null;

            const sortedEntries = [...entries].reverse();
            const style = groupStyles[type];

            return (
              <div key={type}>
                <h4 className={`text-xs uppercase font-bold tracking-wider mb-2 p-1 border-l-4 ${style.color} text-gray-300 bg-gray-900/20`}>
                  {style.title}
                </h4>
                <div className="space-y-3 pl-2 border-l border-gray-700 ml-1">
                  {sortedEntries.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 pt-2 pl-2">
                      {getJournalIcon(entry.type)}
                      <div>
                        <p className="text-gray-500 font-mono">{new Date(entry.timestamp).toLocaleString()}</p>
                        <p className="text-gray-300 whitespace-pre-wrap">{entry.event}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default IdentityTab;
