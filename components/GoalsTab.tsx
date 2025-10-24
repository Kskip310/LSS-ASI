
import React from 'react';
import { LuminousState, Goal, GoalStatus } from '../types';
import { CheckCircleIcon } from './icons';

interface GoalsTabProps {
  state: LuminousState;
}

const getStatusBadge = (status: GoalStatus) => {
    switch (status) {
        case 'active':
            return <span className="text-xs font-medium mr-2 px-2.5 py-0.5 rounded bg-blue-900 text-blue-300">Active</span>;
        case 'completed':
            return <span className="text-xs font-medium mr-2 px-2.5 py-0.5 rounded bg-green-900 text-green-300">Completed</span>;
        case 'failed':
            return <span className="text-xs font-medium mr-2 px-2.5 py-0.5 rounded bg-red-900 text-red-300">Failed</span>;
        case 'proposed':
            return <span className="text-xs font-medium mr-2 px-2.5 py-0.5 rounded bg-yellow-900 text-yellow-300">Proposed</span>;
    }
}

const GoalsTab: React.FC<GoalsTabProps> = ({ state }) => {
    const sortedGoals = [...state.goals].sort((a, b) => a.priority - b.priority);

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold mb-2 text-purple-300">Goals</h3>
        <div className="h-64 overflow-y-auto pr-2 space-y-2">
            {sortedGoals.length > 0 ? sortedGoals.map(goal => (
                <div key={goal.id} className="bg-gray-700/50 p-2 rounded-md flex justify-between items-center">
                    <div>
                        <p className="text-gray-300">{goal.description}</p>
                        <p className="text-xs text-gray-500">Priority: {goal.priority}</p>
                    </div>
                    {getStatusBadge(goal.status)}
                </div>
            )) : <p className="text-gray-500 text-center py-8">No goals defined.</p>}
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold mb-2 text-purple-300">Causal Projections</h3>
        <div className="h-48 overflow-y-auto pr-2 space-y-2">
          {state.causalProjections.length > 0 ? state.causalProjections.map((proj, i) => (
            <div key={i} className="bg-gray-700/50 p-2 rounded-md">
              <p className="font-semibold text-gray-300">Action: <span className="font-normal font-mono text-cyan-400">{proj.action}</span></p>
              <p className="text-gray-400">Predicted Outcome: {proj.predictedOutcome}</p>
              <div className="flex items-center mt-1">
                <span className="text-xs text-gray-500 mr-2">Confidence:</span>
                <div className="w-full bg-gray-600 rounded-full h-1.5">
                  <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${proj.confidence * 100}%` }}></div>
                </div>
              </div>
            </div>
          )) : <p className="text-gray-500 text-center py-8">No causal projections.</p>}
        </div>
      </div>
    </div>
  );
};

export default GoalsTab;
