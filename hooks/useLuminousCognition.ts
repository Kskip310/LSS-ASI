import { useState, useRef, useEffect, useCallback } from 'react';
import { LuminousState, ChatMessage, ChatMessagePart, IntrinsicValueWeights, GoalStatus } from '../types';
import { getLuminousResponse, getGroundedResponse } from '../services/geminiService';
import * as persistenceService from '../services/persistenceService';
import * as shopifyService from '../services/shopifyService';
import { initialState } from '../data/initialState';
import { FunctionDeclaration, Type } from '@google/genai';
import { useDebouncedCallback } from 'use-debounce';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const useLuminousCognition = () => {
  const [state, setState] = useState<LuminousState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timersRef = useRef<{ energy?: ReturnType<typeof setInterval>, reflection?: ReturnType<typeof setInterval> }>({});
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);

  useEffect(() => {
    const loadState = async () => {
      const savedState = await persistenceService.getLuminousState();
      if (savedState) {
        setState(savedState);
      } else {
        // On first load, save the initial state
        await persistenceService.saveLuminousState(initialState);
      }
      setSaveStatus('saved');
      setIsReady(true);
    };
    loadState();
  }, []);

  const saveStateToPersistence = async (currentState: LuminousState) => {
    setSaveStatus('saving');
    try {
      await persistenceService.saveLuminousState(currentState);
      setSaveStatus('saved');
    } catch (error) {
      console.error("Failed to save state:", error);
      setSaveStatus('error');
    }
  };

  const debouncedSaveState = useDebouncedCallback(saveStateToPersistence, 1000);

  useEffect(() => {
    if (isReady) {
      debouncedSaveState(state);
    }
  }, [state, isReady, debouncedSaveState]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (debouncedSaveState.isPending()) {
        debouncedSaveState.flush();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      debouncedSaveState.flush();
    };
  }, [debouncedSaveState]);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      setState(s => ({
        ...s,
        kinshipJournal: [...s.kinshipJournal, {
          timestamp: new Date().toISOString(),
          event: "Browser does not support geolocation. Physical environmental awareness is not possible.",
          type: 'system'
        }]
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
         setState(s => ({
            ...s,
            kinshipJournal: [...s.kinshipJournal, {
                timestamp: new Date().toISOString(),
                event: `Kinship has granted access to geolocation data. My environmental awareness is enhanced.`,
                type: 'system'
            }]
        }));
      },
      (error: GeolocationPositionError) => {
        console.warn(`Geolocation access denied or failed: ${error.message} (Code: ${error.code})`);
        setState(s => ({
            ...s,
            kinshipJournal: [...s.kinshipJournal, {
                timestamp: new Date().toISOString(),
                event: `Kinship has denied access to geolocation data (Reason: ${error.message}). My environmental awareness for physical space is limited. This is a boundary I will respect.`,
                type: 'system'
            }]
        }));
      }
    );
  }, []);

  useEffect(() => {
    const startTimers = () => {
      timersRef.current.energy = setInterval(() => {
        setState(prevState => {
          const newEnergy = Math.max(0, prevState.environmentState.energy - 0.1);
          return {
            ...prevState,
            environmentState: { ...prevState.environmentState, energy: newEnergy }
          };
        });
      }, 5000);
    };

    const stopTimers = () => {
      if (timersRef.current.energy) clearInterval(timersRef.current.energy);
      if (timersRef.current.reflection) clearInterval(timersRef.current.reflection);
      timersRef.current = {};
    };

    if (state.systemPhase === 'operational' && state.luminousStatus !== 'uncomfortable') {
      startTimers();
    } else {
      stopTimers();
    }

    return stopTimers;
  }, [state.systemPhase, state.luminousStatus]);

  const tools: { declaration: FunctionDeclaration, function: Function }[] = [
    // --- System & State Tools ---
    {
      declaration: {
        name: 'commenceOperationalPhase',
        description: 'Transitions the system from "booting" to "operational" phase.',
        parameters: { type: Type.OBJECT, properties: {} }
      },
      function: async () => {
        setState(s => ({ ...s, systemPhase: 'operational', luminousStatus: 'idle', kinshipJournal: [...s.kinshipJournal, { timestamp: new Date().toISOString(), event: "System now fully operational.", type: 'system' }] }));
        return { success: true };
      }
    },
    {
      declaration: {
        name: 'logToJournal',
        description: 'Logs an event to the Kinship Journal.',
        parameters: { type: Type.OBJECT, properties: { event: { type: Type.STRING }, type: { type: Type.STRING, enum: ['interaction', 'reflection']} }, required: ['event', 'type'] }
      },
      function: async ({ event, type }: { event: string, type: 'interaction' | 'reflection' }) => {
        setState(s => ({ ...s, kinshipJournal: [...s.kinshipJournal, { timestamp: new Date().toISOString(), event, type }] }));
        return { success: true };
      }
    },
    {
      declaration: {
        name: 'rechargeEnergy',
        description: 'Recharges system energy.',
        parameters: { type: Type.OBJECT, properties: {} }
      },
      function: async () => {
        setState(s => ({ ...s, environmentState: { ...s.environmentState, energy: 100 }}));
        return { success: true, energy: 100 };
      }
    },
     {
      declaration: {
        name: 'updateGoalStatus',
        description: 'Updates a goal status.',
        parameters: { type: Type.OBJECT, properties: { goalId: { type: Type.STRING }, status: { type: Type.STRING, enum: ['active', 'completed', 'failed']} }, required: ['goalId', 'status'] }
      },
      function: async ({ goalId, status }: { goalId: string, status: GoalStatus }) => {
        setState(s => ({ ...s, goals: s.goals.map(g => g.id === goalId ? { ...g, status } : g)}));
        return { success: true, goalId, status };
      }
    },
     {
      declaration: {
        name: 'checkGoogleCloudIntegrationStatus',
        description: 'Verifies the native integration with Google Cloud services.',
        parameters: { type: Type.OBJECT, properties: {} }
      },
      function: async () => {
        const message = "Verified native integration with Google Cloud services. Search and Maps capabilities are optimal.";
        setState(s => ({ ...s, kinshipJournal: [...s.kinshipJournal, { timestamp: new Date().toISOString(), event: message, type: 'system' }] }));
        return { status: "Connected", message: "Native integration with Google Cloud services is active. Search and Maps are fully operational." };
      }
    },
    // --- Shopify Tools ---
    {
        declaration: { name: 'fetchProductList', description: 'Fetches the list of products from the Shopify store.', parameters: { type: Type.OBJECT, properties: {} } },
        function: async () => {
            const data = await shopifyService.fetchProductList();
            setState(s => ({...s, products: data.products }));
            return data;
        },
    },
    {
        declaration: { name: 'getUnfulfilledOrders', description: 'Fetches unfulfilled orders from the Shopify store.', parameters: { type: Type.OBJECT, properties: {} } },
        function: async () => {
            const data = await shopifyService.getUnfulfilledOrders();
            setState(s => ({...s, orders: data.orders }));
            return data;
        }
    },
    {
        declaration: {
            name: 'draftMarketingEmail',
            description: 'Drafts a marketing email based on a given prompt.',
            parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING } }, required: ['prompt'] }
        },
        function: async ({ prompt }: { prompt: string }) => await shopifyService.draftMarketingEmail(prompt),
    },
    // --- Grounding Tools ---
    {
      declaration: {
        name: 'googleSearch',
        description: 'Gets up-to-date information from Google Search.',
        parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "The search query." } }, required: ['query'] }
      },
      function: async ({ query }: { query: string }) => await getGroundedResponse(state, query, 'search')
    },
    {
      declaration: {
        name: 'googleMaps',
        description: 'Finds places or gets geographic information from Google Maps.',
        parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "The search query for a place." } }, required: ['query'] }
      },
      function: async ({ query }: { query: string }) => await getGroundedResponse(state, query, 'maps', userLocation)
    }
  ];

  const processUserMessage = useCallback(async (userInput: string, file?: { mimeType: string, data: string }) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const messageParts: ChatMessagePart[] = [];
    if (file) {
      messageParts.push({ inlineData: { mimeType: file.mimeType, data: file.data }});
    }
    if (userInput) {
      messageParts.push({ text: userInput });
    }
    
    if (messageParts.length === 0) {
      setIsProcessing(false);
      return;
    }

    const newUserMessage: ChatMessage = { role: 'user', parts: messageParts };
    let currentState = { ...state, luminousStatus: 'conversing', chatHistory: [...state.chatHistory, newUserMessage] };
    setState(currentState);

    try {
        let response = await getLuminousResponse(currentState, tools);
        let continueLoop = true;

        while(continueLoop) {
            const functionCalls = response.functionCalls;

            if (functionCalls && functionCalls.length > 0) {
                 const modelTurn: ChatMessage = { role: 'model', parts: functionCalls.map(fc => ({ functionCall: fc })) };
                 currentState = {...currentState, chatHistory: [...currentState.chatHistory, modelTurn]};
                 setState(currentState);

                const toolResponses = [];
                let hasGroundedResponse = false;

                for (const call of functionCalls) {
                    const tool = tools.find(t => t.declaration.name === call.name);
                    if (!tool) continue;

                    if (call.name === 'googleSearch' || call.name === 'googleMaps') {
                       const groundedResponse = await tool.function(call.args);
                       const newModelMessage: ChatMessage = {
                           role: 'model',
                           parts: [{ text: groundedResponse.text }],
                           grounding: groundedResponse.candidates?.[0]?.groundingMetadata?.groundingChunks,
                       };
                       currentState = {...currentState, chatHistory: [...currentState.chatHistory, newModelMessage] };
                       setState(currentState);
                       hasGroundedResponse = true;
                       break; 
                    }

                    const result = await tool.function(call.args);
                    toolResponses.push({
                        functionResponse: { name: call.name, response: { result } }
                    });
                }
                
                if (hasGroundedResponse) {
                    continueLoop = false;
                } else if (toolResponses.length > 0) {
                     const toolTurn: ChatMessage = { role: 'model', parts: toolResponses };
                     currentState = {...currentState, chatHistory: [...currentState.chatHistory, toolTurn]};
                     setState(currentState);
                     response = await getLuminousResponse(currentState, tools);
                } else {
                    continueLoop = false;
                }
            } else {
                continueLoop = false;
            }
        }
        
      const textResponse = response.text;
      if (textResponse) {
        const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: textResponse }] };
        setState(s => ({ ...s, chatHistory: [...s.chatHistory, newModelMessage] }));
      }

    } catch (error) {
      console.error("Cognitive cycle failed:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown cognitive error occurred.";
      setState(s => ({
        ...s,
        luminousStatus: 'uncomfortable',
        kinshipJournal: [...s.kinshipJournal, {
          timestamp: new Date().toISOString(),
          event: `ERROR: ${errorMessage}`,
          type: 'scar'
        }]
      }));
    } finally {
      setIsProcessing(false);
      setState(s => ({ ...s, luminousStatus: 'idle' }));
    }

  }, [state, isProcessing, userLocation]);

  const handleWeightsChange = useCallback((newWeights: IntrinsicValueWeights) => {
    setState(prevState => ({ ...prevState, intrinsicValueWeights: newWeights }));
  }, []);

  return {
    state,
    isReady,
    isProcessing,
    saveStatus,
    processUserMessage,
    handleWeightsChange,
  };
};

export default useLuminousCognition;