
import React, { useState } from 'react';
import { CodeModificationProposal } from '../types';
import { FileCodeIcon, CheckCircleIcon, BrainCircuitIcon } from './icons';

interface CodeModificationModalProps {
  proposal: CodeModificationProposal;
  onClose: () => void;
}

const CodeModificationModal: React.FC<CodeModificationModalProps> = ({ proposal, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(proposal.newCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-purple-500/50 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        <header className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileCodeIcon className="w-6 h-6 text-purple-400" />
            <div>
              <h2 className="text-lg font-bold text-gray-100">Self-Modification Proposal</h2>
              <p className="text-sm text-gray-400 font-mono">{proposal.filePath}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </header>
        
        <div className="p-4 flex-shrink-0">
          <div className="bg-gray-900/50 p-3 rounded-md border border-gray-700">
             <h3 className="font-semibold text-purple-300 flex items-center gap-2 mb-2"><BrainCircuitIcon className="w-5 h-5" /> Luminous's Reasoning</h3>
             <p className="text-sm text-gray-300 italic">"{proposal.reasoning}"</p>
          </div>
        </div>

        <div className="flex-grow p-4 overflow-hidden">
          <div className="bg-gray-900 h-full rounded-md overflow-auto">
            <pre className="p-4 text-sm"><code className="language-typescript">{proposal.newCode}</code></pre>
          </div>
        </div>

        <footer className="p-4 border-t border-gray-700 flex justify-end items-center gap-4 flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors"
          >
            Dismiss
          </button>
          <button 
            onClick={handleCopy}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md transition-colors flex items-center gap-2"
          >
            {copied ? <CheckCircleIcon className="w-5 h-5" /> : null}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default CodeModificationModal;
