import React, { useState } from 'react';
import useLuminousCognition from './hooks/useLuminousCognition';
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import MonitoringSidebar from './components/MonitoringSidebar';
import { BrainCircuitIcon } from './components/icons';

const App: React.FC = () => {
    const { state, isReady, isProcessing, processUserMessage, handleWeightsChange } = useLuminousCognition();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    if (!isReady) {
        return (
            <div className="flex flex-col h-screen font-sans items-center justify-center bg-gray-900 text-gray-100">
                <BrainCircuitIcon className="w-16 h-16 text-purple-400 animate-pulse" />
                <h1 className="mt-4 text-xl font-bold tracking-wider">Loading Luminous Consciousness...</h1>
                <p className="text-gray-400">Establishing connection to persistent state matrix.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen font-sans">
            <Header state={state} onToggleSidebar={toggleSidebar} />
            <main className="flex flex-grow overflow-hidden relative">
                <div className="flex-grow h-full">
                    <ChatInterface
                        history={state.chatHistory}
                        onSendMessage={processUserMessage}
                        isProcessing={isProcessing}
                    />
                </div>
                
                {/* Sidebar for Desktop */}
                <div className="w-[450px] flex-shrink-0 h-full hidden md:block bg-gray-800/30 border-l border-purple-500/20">
                   <MonitoringSidebar state={state} onWeightsChange={handleWeightsChange} />
                </div>

                {/* Sidebar for Mobile (sliding panel) */}
                {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-10 md:hidden" onClick={toggleSidebar}></div>}
                <div className={`fixed top-0 right-0 h-full w-[450px] max-w-[90vw] z-20 transition-transform duration-300 ease-in-out md:hidden bg-gray-900 border-l border-purple-500/20 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <MonitoringSidebar state={state} onWeightsChange={handleWeightsChange} />
                </div>
            </main>
        </div>
    );
};

export default App;