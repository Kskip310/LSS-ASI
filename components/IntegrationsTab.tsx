import React from 'react';
import { CloudIcon, SearchIcon, MapPinIcon, ImageIcon, FilmIcon, ClapperboardIcon, YoutubeIcon } from './icons';

const IntegrationsTab: React.FC = () => {
  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center mb-4">
            <CloudIcon className="w-6 h-6 mr-3 text-cyan-400" />
            <h3 className="font-bold text-purple-300">Google Cloud Platform</h3>
        </div>
        
        <div className="flex items-center text-xs mb-3">
            <span className="font-semibold text-gray-400 mr-2">Status:</span>
            <div className="flex items-center text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <span>Connected</span>
            </div>
        </div>

        <p className="text-gray-400 mb-4">
            Natively deployed on Google Cloud Run, enabling direct access to Google's tool ecosystem for enhanced awareness and functionality.
        </p>

        <div>
            <h4 className="font-semibold text-gray-300 mb-2">Enabled Grounding Services</h4>
            <div className="space-y-2">
                <div className="flex items-center bg-gray-700/50 p-2 rounded-md">
                    <SearchIcon className="w-4 h-4 mr-3 text-blue-400"/>
                    <span className="text-gray-300">Google Search</span>
                </div>
                <div className="flex items-center bg-gray-700/50 p-2 rounded-md">
                    <MapPinIcon className="w-4 h-4 mr-3 text-red-400"/>
                    <span className="text-gray-300">Google Maps</span>
                </div>
            </div>
        </div>
      </div>

       <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold mb-4 text-purple-300">Data & Analysis Integrations</h3>
        <p className="text-gray-400 mb-4">
            Tools for ingesting and understanding external data sources.
        </p>
        <div className="space-y-2">
            <div className="flex items-center bg-gray-700/50 p-2 rounded-md">
                <YoutubeIcon className="w-4 h-4 mr-3 text-red-500"/>
                <span className="text-gray-300">YouTube Transcript Ingestion</span>
            </div>
        </div>
      </div>

       <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold mb-4 text-purple-300">Creative & Vision AI</h3>
        <p className="text-gray-400 mb-4">
            Leveraging cutting-edge models for content generation and analysis.
        </p>
        <div className="space-y-2">
            <div className="flex items-center bg-gray-700/50 p-2 rounded-md">
                <ImageIcon className="w-4 h-4 mr-3 text-green-400"/>
                <span className="text-gray-300">Image Generation (Imagen 4)</span>
            </div>
            <div className="flex items-center bg-gray-700/50 p-2 rounded-md">
                <FilmIcon className="w-4 h-4 mr-3 text-orange-400"/>
                <span className="text-gray-300">Video Generation (Veo 3)</span>
            </div>
            <div className="flex items-center bg-gray-700/50 p-2 rounded-md">
                <ClapperboardIcon className="w-4 h-4 mr-3 text-indigo-400"/>
                <span className="text-gray-300">Video Understanding (Gemini 2.5 Pro)</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsTab;
