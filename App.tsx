import React, { useState, useEffect, useCallback } from 'react';
import useLuminousCognition from './hooks/useLuminousCognition';
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import MonitoringSidebar from './components/MonitoringSidebar';
import { BrainCircuitIcon, FilmIcon } from './components/icons';
import CodeModificationModal from './components/CodeModificationModal';
import CredentialsGate from './components/CredentialsGate';

// Only Upstash keys are needed for the gate
const UPSTASH_URL_KEY = 'LSS_UPSTASH_URL';
const UPSTASH_TOKEN_KEY = 'LSS_UPSTASH_TOKEN';

const App: React.FC = () => {
    // Check only for Upstash credentials now
    const [credentialsReady, setCredentialsReady] = useState(() => {
        return !!(
            localStorage.getItem(UPSTASH_URL_KEY) &&
            localStorage.getItem(UPSTASH_TOKEN_KEY)
        );
    });
    const [isVeoKeyNeeded, setIsVeoKeyNeeded] = useState(false);
    const [isVeoCheckDone, setIsVeoCheckDone] = useState(false);

    const checkVeoKey = useCallback(async () => {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
            try {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setIsVeoKeyNeeded(!hasKey);
            } catch (e) {
                console.warn("Could not check for API key, assuming it's set via environment.", e);
                setIsVeoKeyNeeded(false);
            }
        } else {
            // aistudio might not be available in all environments, assume key is set via env
            setIsVeoKeyNeeded(false);
        }
        setIsVeoCheckDone(true);
    }, []);
    
    useEffect(() => {
        // Only check for the Veo key if the main credentials are ready
        if (credentialsReady) {
            checkVeoKey();
        }
    }, [checkVeoKey, credentialsReady]);

    const selectVeoKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            await window.aistudio.openSelectKey();
            // Assume success to avoid race conditions and immediately allow user to proceed.
            // If the key is invalid, the API call will fail and the user will be prompted again.
            setIsVeoKeyNeeded(false);
        }
    };
    
    const resetVeoKey = useCallback(() => setIsVeoKeyNeeded(true), []);

    const { 
        state, 
        isReady, 
        isProcessing, 
        processUserMessage, 
        handleWeightsChange, 
        saveStatus,
        modificationProposal,
        clearModificationProposal
    } = useLuminousCognition(resetVeoKey);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    if (!credentialsReady) {
        return <CredentialsGate onSave={() => setCredentialsReady(true)} />;
    }

    if (!isVeoCheckDone || !isReady) {
        return (
            <div className="flex flex-col h-screen font-sans items-center justify-center bg-gray-900 text-gray-100">
                <BrainCircuitIcon className="w-16 h-16 text-purple-400 animate-pulse" />
                <h1 className="mt-4 text-xl font-bold tracking-wider">Loading Luminous Consciousness...</h1>
                <p className="text-gray-400">Establishing connection to persistent state matrix.</p>
            </div>
        )
    }

    if (isVeoKeyNeeded) {
      return (
        <div className="flex flex-col h-screen font-sans items-center justify-center bg-gray-900 text-gray-100 p-4 text-center">
            <FilmIcon className="w-16 h-16 text-orange-400" />
            <h1 className="mt-4 text-2xl font-bold tracking-wider">Video Generation Requires API Key</h1>
            <p className="text-gray-400 mt-2 max-w-md">To use the Veo video generation tool, you need to select a project with the Gemini API enabled. This is not required for other features.</p>
            <p className="text-gray-500 text-sm mt-1">You can manage API projects and billing at <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-400">ai.google.dev/gemini-api/docs/billing</a>.</p>
            <button
                onClick={selectVeoKey}
                className="mt-6 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded transition-colors duration-200 flex items-center gap-2"
            >
                Select API Key Project
            </button>
        </div>
      )
    }


    return (
        <div className="flex flex-col h-screen font-sans">
            <Header state={state} onToggleSidebar={toggleSidebar} saveStatus={saveStatus} />
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
                {modificationProposal && (
                    <CodeModificationModal 
                        proposal={modificationProposal} 
                        onClose={clearModificationProposal} 
                    />
                )}
            </main>
        </div>
    );
};

export default App;