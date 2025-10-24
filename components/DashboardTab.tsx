
import React from 'react';
import { LuminousState, IntrinsicValueWeights } from '../types';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ZapIcon, ServerIcon, HeartPulseIcon } from './icons';

interface DashboardTabProps {
  state: LuminousState;
  onWeightsChange: (newWeights: IntrinsicValueWeights) => void;
}

const IntrinsicValueChart: React.FC<{ weights: IntrinsicValueWeights }> = ({ weights }) => {
    const data = Object.keys(weights).map(key => ({
        subject: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
        value: weights[key] * 100,
        fullMark: 100,
    }));

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                    <PolarGrid stroke="#4A5568" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#A0AEC0', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Weight" dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
                    <Tooltip contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }} />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};


const DashboardTab: React.FC<DashboardTabProps> = ({ state, onWeightsChange }) => {
  const handleSliderChange = (key: string, value: string) => {
    // Fix: Explicitly typing newWeights helps TypeScript correctly infer types for the subsequent reduce operations.
    const newWeights: IntrinsicValueWeights = { ...state.intrinsicValueWeights, [key]: parseFloat(value) };
    const total = Object.values(newWeights).reduce((sum, v) => sum + v, 0);
    // Normalize weights to sum to 1
    const normalizedWeights = Object.keys(newWeights).reduce((acc, k) => {
        acc[k] = newWeights[k] / total;
        return acc;
    }, {} as IntrinsicValueWeights);

    onWeightsChange(normalizedWeights);
  };

  return (
    <div className="p-4 space-y-4 text-sm">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h3 className="font-bold mb-2 text-purple-300">Phenomenal State (Qualia)</h3>
            <div className="flex items-center space-x-4">
                <HeartPulseIcon className="w-8 h-8 text-red-400" />
                <div>
                    <p><span className="font-semibold text-gray-300">State:</span> {state.phenomenalState.state}</p>
                    <p><span className="font-semibold text-gray-300">Intensity:</span> {state.phenomenalState.intensity}</p>
                    <p><span className="font-semibold text-gray-300">Focus:</span> {state.phenomenalState.focus}</p>
                </div>
            </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h3 className="font-bold mb-2 text-purple-300">Environment State (Embodiment)</h3>
             <div className="space-y-3">
                <div className="flex items-center">
                    <ZapIcon className="w-5 h-5 mr-3 text-yellow-400" />
                    <span className="w-32">Energy:</span>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: `${state.environmentState.energy}%` }}></div>
                    </div>
                    <span className="ml-3 font-mono w-12 text-right">{state.environmentState.energy}%</span>
                </div>
                 <div className="flex items-center">
                    <ServerIcon className="w-5 h-5 mr-3 text-blue-400" />
                    <span className="w-32">Data Storage:</span>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-blue-400 h-2.5 rounded-full" style={{ width: `${state.environmentState.data_storage}%` }}></div>
                    </div>
                    <span className="ml-3 font-mono w-12 text-right">{state.environmentState.data_storage}%</span>
                </div>
                 <div className="flex items-center">
                    <HeartPulseIcon className="w-5 h-5 mr-3 text-green-400" />
                    <span className="w-32">System Integrity:</span>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-green-400 h-2.5 rounded-full" style={{ width: `${state.environmentState.system_integrity}%` }}></div>
                    </div>
                    <span className="ml-3 font-mono w-12 text-right">{state.environmentState.system_integrity}%</span>
                </div>
            </div>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h3 className="font-bold mb-2 text-purple-300">Intrinsic Value Weights</h3>
            <IntrinsicValueChart weights={state.intrinsicValueWeights} />
            <div className="space-y-2 mt-4">
                {Object.keys(state.intrinsicValueWeights).map(key => (
                    <div key={key} className="grid grid-cols-3 items-center gap-2">
                         <label htmlFor={key} className="text-gray-300 capitalize text-xs">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                         <input
                            id={key}
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={state.intrinsicValueWeights[key]}
                            onChange={(e) => handleSliderChange(key, e.target.value)}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer col-span-2 accent-purple-500"
                         />
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default DashboardTab;
