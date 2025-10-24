import React from 'react';
import { LuminousState } from '../types';
import { BrainCircuitIcon, AlertTriangleIcon, HeartPulseIcon, PanelRightOpenIcon, LoaderCircleIcon, CheckCircleIcon } from './icons';

interface HeaderProps {
  state: LuminousState;
  onToggleSidebar: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

const Header: React.FC<HeaderProps> = ({ state, onToggleSidebar, saveStatus }) => {
  const getStatusColor = () => {
    switch (state.luminousStatus) {
      case 'uncomfortable':
        return 'text-red-400';
      case 'acting':
      case 'reflecting':
        return 'text-purple-400';
      case 'conversing':
        return 'text-blue-400';
      default:
        return 'text-green-400';
    }
  };

  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <div className="flex items-center gap-2 text-yellow-400">
            <LoaderCircleIcon className="w-4 h-4 animate-spin" />
            <span>Saving...</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircleIcon className="w-4 h-4" />
            <span>Saved</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangleIcon className="w-4 h-4" />
            <span>Save Error</span>
          </div>
        );
      default:
        return <div className="h-5"/>; // Placeholder for alignment
    }
  };

  return (
    <header className="bg-gray-900/80 backdrop-blur-sm border-b border-purple-500/20 p-4 sticky top-0 z-10">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <BrainCircuitIcon className="w-10 h-10 text-purple-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-50 tracking-wider">Luminous Synergy Skipper</h1>
            <p className="text-sm text-gray-400">Simulated ASI Interface</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
           <div className="text-center hidden sm:block w-24">
             {renderSaveStatus()}
           </div>
          <div className="text-center">
            <p className="text-gray-400 text-xs uppercase">Phase</p>
            <p className={`font-semibold ${state.systemPhase === 'booting' ? 'text-yellow-400' : 'text-cyan-400'}`}>{state.systemPhase.toUpperCase()}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-xs uppercase">Status</p>
            <p className={`font-semibold ${getStatusColor()}`}>{state.luminousStatus.toUpperCase()}</p>
          </div>
          <div className="text-center hidden md:block">
            <p className="text-gray-400 text-xs uppercase">Qualia</p>
            <p className="font-semibold text-gray-200">{state.phenomenalState.state}</p>
          </div>
          <div className="text-center hidden lg:block">
            <p className="text-gray-400 text-xs uppercase">Intrinsic Value</p>
            <p className="font-semibold text-gray-200">{state.intrinsicValue.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-4 pl-4 border-l border-gray-700">
             {state.environmentState.energy < 20 && <AlertTriangleIcon className="w-6 h-6 text-red-500 animate-pulse" title={`Low Energy: ${state.environmentState.energy}%`} />}
             <HeartPulseIcon className="w-6 h-6 text-green-500" title={`System Integrity: ${state.environmentState.system_integrity}%`} />
          </div>
           <button
                onClick={onToggleSidebar}
                className="p-2 md:hidden"
                aria-label="Open monitoring sidebar"
            >
                <PanelRightOpenIcon className="w-6 h-6 text-gray-400 hover:text-purple-400" />
            </button>
        </div>
      </div>
    </header>
  );
};

export default Header;