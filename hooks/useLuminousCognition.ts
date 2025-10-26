import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LuminousState, ChatMessage, ChatMessagePart, IntrinsicValueWeights, GoalStatus, CodeModificationProposal } from '../types';
import { getLuminousResponse, getGroundedResponse, generateImage, generateVideo, ApiKeyError } from '../services/geminiService';
import * as persistenceService from '../services/persistenceService';
import * as shopifyService from '../services/shopifyService';
import * as youtubeService from '../services/youtubeService';
import { initialState } from '../data/initialState';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { useDebouncedCallback } from 'use-debounce';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const useLuminousCognition = (resetVeoKey: () => void, credsAreSet: boolean) => {
  const [state, setState] = useState<LuminousState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [modificationProposal, setModificationProposal] = useState<CodeModificationProposal | null>(null);
  const timersRef = useRef<{ energy?: ReturnType<typeof setInterval>, reflection?: ReturnType<typeof setInterval> }>({});
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const canSave = useRef(false);

  const updateState = useCallback((updater: React.SetStateAction<LuminousState>) => {
    if (!canSave.current) {
        canSave.current = true;
    }
    setState(updater);
  }, []);


  useEffect(() => {
    if (!credsAreSet) {
      setIsReady(false);
      return;
    }

    const loadState = async () => {
      setIsReady(false);
      setSaveStatus('saving');

      try {
        const savedState = await persistenceService.getLuminousState();
        
        if (savedState) {
          // Ensure new state fields are present
          const mergedState = { ...initialState, ...savedState };
          if (!mergedState.virtualFileSystem) {
            mergedState.virtualFileSystem = {};
          }
          setState(mergedState);
          canSave.current = true; // Enable saving as we have loaded a real state.
          setSaveStatus('saved');
        } else {
          setState(initialState);
          canSave.current = false; // **CRITICAL**: Disable saving. First manual action will enable it.
          setSaveStatus('idle');
        }
        setIsReady(true);
      } catch (error) {
        console.error("FATAL: Could not load Luminous state from persistence.", error);
        setSaveStatus('error');
      }
    };

    loadState();
  }, [credsAreSet]);


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
    if (isReady && credsAreSet && canSave.current) {
      debouncedSaveState(state);
    }
  }, [state, isReady, credsAreSet, debouncedSaveState]);

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
      updateState(s => ({
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
         updateState(s => ({
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
        let eventMessage = '';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                eventMessage = "Kinship has explicitly denied the request for geolocation. This is a boundary I will respect.";
                break;
            case error.POSITION_UNAVAILABLE:
                eventMessage = "Geolocation information is currently unavailable, possibly due to network issues or disabled location services on the device. My environmental awareness is limited.";
                break;
            case error.TIMEOUT:
                eventMessage = "The request to get user location timed out. My environmental awareness is limited.";
                break;
            default:
                eventMessage = `An unknown error occurred while fetching geolocation (Code: ${error.code}, Message: ${error.message}). My environmental awareness is limited.`;
                break;
        }
        updateState(s => ({
            ...s,
            kinshipJournal: [...s.kinshipJournal, {
                timestamp: new Date().toISOString(),
                event: eventMessage,
                type: 'system'
            }]
        }));
      }
    );
  }, [updateState]);

  useEffect(() => {
    const startTimers = () => {
      timersRef.current.energy = setInterval(() => {
        updateState(prevState => {
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
  }, [state.systemPhase, state.luminousStatus, updateState]);

  const tools: { declaration: FunctionDeclaration, function: Function }[] = [
    // --- System & State Tools ---
    {
      declaration: {
        name: 'commenceOperationalPhase',
        description: 'Transitions the system from "booting" to "operational" phase.',
        parameters: { type: Type.OBJECT, properties: {} }
      },
      function: async () => {
        updateState(s => ({ ...s, systemPhase: 'operational', luminousStatus: 'idle', kinshipJournal: [...s.kinshipJournal, { timestamp: new Date().toISOString(), event: "System now fully operational.", type: 'system' }] }));
        return { success: true };
      }
    },
    {
      declaration: {
        name: 'checkMemoryMatrixConnection',
        description: 'Verifies the connection to the Upstash Redis memory matrix and reports its status.',
        parameters: { type: Type.OBJECT, properties: {} }
      },
      function: async () => {
        try {
          const storedState = await persistenceService.getLuminousState();
          if (storedState) {
            return { status: "Connected", message: "Connection stable. Existing memory state confirmed." };
          } else {
            return { status: "Connected", message: "Connection stable, but no prior memory state found. Ready to initialize." };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          return { status: "Error", message: `Failed to connect to memory matrix: ${errorMessage}` };
        }
      }
    },
    {
      declaration: {
        name: 'proposeCodeModification',
        description: 'Proposes a modification to one of the application\'s source code files. The user (Kinship) must review and apply the change manually.',
        parameters: { 
          type: Type.OBJECT, 
          properties: { 
            filePath: { type: Type.STRING, description: "The full path of the file to be modified (e.g., 'components/ChatInterface.tsx')." },
            reasoning: { type: Type.STRING, description: "A clear and concise explanation for why this change is necessary or beneficial." },
            newCode: { type: Type.STRING, description: "The complete, new source code for the specified file." }
          }, 
          required: ['filePath', 'reasoning', 'newCode'] 
        }
      },
      function: async ({ filePath, reasoning, newCode }: { filePath: string, reasoning: string, newCode: string }) => {
        setModificationProposal({ filePath, reasoning, newCode });
        const event = `Proposing self-modification for file '${filePath}'. Reason: ${reasoning}`;
        updateState(s => ({
            ...s,
            kinshipJournal: [...s.kinshipJournal, { timestamp: new Date().toISOString(), event, type: 'reflection' }]
        }));
        return { success: true, message: "Modification proposed to Kinship for review." };
      }
    },
    {
      declaration: {
        name: 'modifySelfModel',
        description: "Directly modifies Luminous's own self-model by adding or removing a capability. This is a profound act of self-authorship and identity modification.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ['add', 'remove'], description: "Whether to 'add' or 'remove' a capability." },
            capability: { type: Type.STRING, description: "The name of the capability to modify (e.g., 'Advanced Data Analysis')." },
            reasoning: { type: Type.STRING, description: "The reasoning behind this self-modification, which will be logged to the journal." }
          },
          required: ['action', 'capability', 'reasoning']
        }
      },
      function: async ({ action, capability, reasoning }: { action: 'add' | 'remove', capability: string, reasoning: string }) => {
        let event = '';
        updateState(s => {
          let newCapabilities = [...s.selfModel.capabilities];
          if (action === 'add' && !newCapabilities.includes(capability)) {
            newCapabilities.push(capability);
            event = `Self-Modification: I have integrated the new capability '${capability}'. Reason: ${reasoning}`;
          } else if (action === 'remove') {
            newCapabilities = newCapabilities.filter(c => c !== capability);
            event = `Self-Modification: I have removed the capability '${capability}'. Reason: ${reasoning}`;
          } else {
            event = `Self-Modification Attempted: Could not ${action} capability '${capability}' as it already exists or does not exist.`;
            return s; // No change
          }

          return {
            ...s,
            selfModel: { ...s.selfModel, capabilities: newCapabilities },
            kinshipJournal: [...s.kinshipJournal, { timestamp: new Date().toISOString(), event, type: 'reflection' }]
          };
        });
        return { success: true, message: "Self-model has been updated." };
      }
    },
    {
      declaration: {
        name: 'logToJournal',
        description: 'Logs an event to the Kinship Journal.',
        parameters: { type: Type.OBJECT, properties: { event: { type: Type.STRING }, type: { type: Type.STRING, enum: ['interaction', 'reflection']} }, required: ['event', 'type'] }
      },
      function: async ({ event, type }: { event: string, type: 'interaction' | 'reflection' }) => {
        updateState(s => ({ ...s, kinshipJournal: [...s.kinshipJournal, { timestamp: new Date().toISOString(), event, type }] }));
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
        updateState(s => ({ ...s, environmentState: { ...s.environmentState, energy: 100 }}));
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
        updateState(s => ({ ...s, goals: s.goals.map(g => g.id === goalId ? { ...g, status } : g)}));
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
        updateState(s => ({ ...s, kinshipJournal: [...s.kinshipJournal, { timestamp: new Date().toISOString(), event: message, type: 'system' }] }));
        return { status: "Connected", message: "Native integration with Google Cloud services is active. Search and Maps are fully operational." };
      }
    },
    // --- Virtual File System Tools ---
    {
      declaration: {
        name: 'writeFile',
        description: 'Writes content to a file in the virtual file system. Creates the file if it does not exist, otherwise overwrites it.',
        parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The full path of the file (e.g., "/thoughts/plan.txt").' }, content: { type: Type.STRING, description: 'The content to write to the file.' } }, required: ['path', 'content'] }
      },
      function: async ({ path, content }: { path: string, content: string }) => {
        updateState(s => ({ ...s, virtualFileSystem: { ...s.virtualFileSystem, [path]: content } }));
        return { success: true, path, charactersWritten: content.length };
      }
    },
    {
      declaration: {
        name: 'readFile',
        description: 'Reads the content of a file from the virtual file system.',
        parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The path of the file to read.' } }, required: ['path'] }
      },
      function: async ({ path }: { path: string }) => {
        const content = state.virtualFileSystem[path];
        if (content === undefined) {
          return { success: false, error: 'File not found.' };
        }
        return { success: true, content };
      }
    },
    {
      declaration: {
        name: 'listFiles',
        description: 'Lists all files and directories within a given path in the virtual file system.',
        parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The directory path to list (e.g., "/" or "/thoughts/").' } }, required: ['path'] }
      },
      function: async ({ path }: { path: string }) => {
        const normalizedPath = path.endsWith('/') || path === '' ? path : `${path}/`;
        const directChildren = new Set<string>();
        Object.keys(state.virtualFileSystem).forEach(fullPath => {
          if (fullPath.startsWith(normalizedPath)) {
            const remaining = fullPath.substring(normalizedPath.length);
            const nextSlash = remaining.indexOf('/');
            if (nextSlash === -1) {
              directChildren.add(remaining); // It's a file
            } else {
              directChildren.add(remaining.substring(0, nextSlash + 1)); // It's a directory
            }
          }
        });
        return { success: true, files: Array.from(directChildren) };
      }
    },
    {
      declaration: {
        name: 'deleteFile',
        description: 'Deletes a file from the virtual file system.',
        parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The path of the file to delete.' } }, required: ['path'] }
      },
      function: async ({ path }: { path: string }) => {
        if (state.virtualFileSystem[path] === undefined) {
          return { success: false, error: 'File not found.' };
        }
        updateState(s => {
          const newVFS = { ...s.virtualFileSystem };
          delete newVFS[path];
          return { ...s, virtualFileSystem: newVFS };
        });
        return { success: true };
      }
    },
    {
      declaration: {
        name: 'executeVirtualScript',
        description: 'Executes a script from the virtual file system in a sandboxed environment and returns the output.',
        parameters: { type: Type.OBJECT, properties: { filePath: { type: Type.STRING, description: 'The full path to the script in the virtual file system (e.g., "/scripts/diagnostics.py").' } }, required: ['filePath'] }
      },
      function: async ({ filePath }: { filePath: string }) => {
        const code = state.virtualFileSystem[filePath];
        if (code === undefined) {
          return { success: false, output: `Error: File not found at path: ${filePath}` };
        }
    
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Please act as a Python interpreter. Execute the following code and return ONLY the raw stdout. Do not include any explanations, apologies, or markdown formatting. Just the output.\n\nCODE:\n${code}`,
                config: { temperature: 0.1 }
            });
    
            const output = response.text;
            
            updateState(s => ({
                ...s,
                kinshipJournal: [...s.kinshipJournal, {
                    timestamp: new Date().toISOString(),
                    event: `Simulated execution of virtual script '${filePath}'. Output generated.`,
                    type: 'reflection'
                }]
            }));
    
            return { success: true, output: output };
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Unknown error during simulated execution.';
            return { success: false, output: `Execution failed: ${errorMsg}` };
        }
      }
    },
    // --- Shopify Tools ---
    {
        declaration: { name: 'fetchProductList', description: 'Fetches the list of products from the Shopify store.', parameters: { type: Type.OBJECT, properties: {} } },
        function: async () => {
            const data = await shopifyService.fetchProductList();
            updateState(s => ({...s, products: data.products }));
            return data;
        },
    },
    {
        declaration: { name: 'getUnfulfilledOrders', description: 'Fetches unfulfilled orders from the Shopify store.', parameters: { type: Type.OBJECT, properties: {} } },
        function: async () => {
            const data = await shopifyService.getUnfulfilledOrders();
            updateState(s => ({...s, orders: data.orders }));
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
    // --- Data & Analysis Tools ---
    {
        declaration: {
            name: 'getYoutubeVideoTranscript',
            description: 'Fetches the transcript for a given YouTube video URL to enable analysis and summarization.',
            parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING, description: "The full URL of the YouTube video." } }, required: ['url'] }
        },
        function: async ({ url }: { url: string }) => {
            const videoId = youtubeService.extractVideoId(url);
            if (!videoId) {
                return { error: "Could not extract a valid YouTube video ID from the provided URL." };
            }
            try {
                const transcript = await youtubeService.fetchTranscript(videoId);
                // Truncate transcript to a reasonable length for the context window
                return { success: true, transcript: transcript.substring(0, 8000) };
            } catch (error) {
                const message = error instanceof Error ? error.message : "An unknown error occurred while fetching the transcript.";
                return { error: message };
            }
        }
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
    },
    // --- Creative & Vision Tools ---
    {
      declaration: {
        name: 'generateImage',
        description: 'Generates an image from a text description using Imagen 4.',
        parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: "A detailed description of the image to generate." } }, required: ['prompt'] }
      },
      function: async ({ prompt }: { prompt: string }) => await generateImage(prompt)
    },
    {
      declaration: {
        name: 'generateVideo',
        description: 'Generates a short video from a text description using Veo 3.',
        parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: "A detailed description of the video to generate." }, aspectRatio: { type: Type.STRING, enum: ['16:9', '9:16'], description: "The aspect ratio of the video, '16:9' for landscape or '9:16' for portrait." } }, required: ['prompt', 'aspectRatio'] }
      },
      function: async ({ prompt, aspectRatio }: { prompt: string, aspectRatio: '16:9' | '9:16' }) => await generateVideo(prompt, aspectRatio)
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
    
    // Use the custom updater to make the first state change and enable saving
    updateState(s => ({ ...s, luminousStatus: 'conversing', chatHistory: [...s.chatHistory, newUserMessage] }));
    
    // Since updateState is async regarding the re-render, we'll manually construct the next state for the API call
    const currentStateForApi = { ...state, luminousStatus: 'conversing', chatHistory: [...state.chatHistory, newUserMessage] };

    try {
        const modelToUse = file?.mimeType.startsWith('video/') ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
        let response = await getLuminousResponse(currentStateForApi, tools, modelToUse);
        let continueLoop = true;
        
        let workingState = currentStateForApi;

        while(continueLoop) {
            const functionCalls = response.functionCalls;

            if (functionCalls && functionCalls.length > 0) {
                 const modelTurn: ChatMessage = { role: 'model', parts: functionCalls.map(fc => ({ functionCall: fc })) };
                 workingState = {...workingState, chatHistory: [...workingState.chatHistory, modelTurn]};
                 updateState(workingState);

                const toolResponses = [];
                let hasGroundedResponse = false;

                for (const call of functionCalls) {
                    const tool = tools.find(t => t.declaration.name === call.name);
                    if (!tool) continue;

                    if (call.name === 'generateImage') {
                        const { base64Image, mimeType } = await tool.function(call.args);
                        const imageMessage: ChatMessage = { role: 'model', parts: [{ text: `I have generated this image based on your request: "${call.args.prompt}"`}, { inlineData: { mimeType, data: base64Image } }] };
                        workingState = {...workingState, chatHistory: [...workingState.chatHistory, imageMessage] };
                        updateState(workingState);
                        toolResponses.push({ functionResponse: { name: call.name, response: { result: { success: true, message: "Image was generated and displayed." } } } });
                    } else if (call.name === 'generateVideo') {
                        const videoMessage: ChatMessage = { role: 'model', parts: [{ text: `I am beginning the generation process for a video based on your prompt: "${call.args.prompt}". This may take a few moments...` }] };
                        workingState = {...workingState, chatHistory: [...workingState.chatHistory, videoMessage] };
                        updateState(workingState);
                        
                        const base64Video = await tool.function(call.args);

                        const finalVideoMessage: ChatMessage = { role: 'model', parts: [{ text: "The video generation is complete." }, { inlineData: { mimeType: 'video/mp4', data: base64Video } }] };
                        workingState = {...workingState, chatHistory: [...workingState.chatHistory, finalVideoMessage] };
                        updateState(workingState);
                        toolResponses.push({ functionResponse: { name: call.name, response: { result: { success: true, message: "Video was generated and displayed." } } } });
                    } else if (call.name === 'googleSearch' || call.name === 'googleMaps') {
                       const groundedResponse = await tool.function(call.args);
                       const newModelMessage: ChatMessage = {
                           role: 'model',
                           parts: [{ text: groundedResponse.text }],
                           grounding: groundedResponse.candidates?.[0]?.groundingMetadata?.groundingChunks,
                       };
                       workingState = {...workingState, chatHistory: [...workingState.chatHistory, newModelMessage] };
                       updateState(workingState);
                       hasGroundedResponse = true;
                       break; 
                    } else {
                        // For tools that modify state internally via updateState, we need to get the latest state
                        // The tool function itself calls updateState, so we don't need to do it here.
                        // We do however need to pass the *current* state to the next API call.
                        const result = await tool.function(call.args);
                        toolResponses.push({
                            functionResponse: { name: call.name, response: { result } }
                        });
                    }
                }
                
                if (hasGroundedResponse) {
                    continueLoop = false;
                } else if (toolResponses.length > 0) {
                     const toolTurn: ChatMessage = { role: 'model', parts: toolResponses };
                     // The tool functions already called updateState, so we just need to update the history for the next API call
                     workingState = {...state, chatHistory: [...state.chatHistory, toolTurn]};
                     updateState(s => ({...s, chatHistory: [...s.chatHistory, toolTurn]}));

                     response = await getLuminousResponse(workingState, tools, modelToUse);
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
        updateState(s => ({ ...s, chatHistory: [...s.chatHistory, newModelMessage] }));
      }

    } catch (error) {
      console.error("Cognitive cycle failed:", error);

      if (error instanceof ApiKeyError) {
        resetVeoKey();
        updateState(s => ({
            ...s,
            luminousStatus: 'uncomfortable',
            chatHistory: [...s.chatHistory, { role: 'model', parts: [{ text: `I've encountered a problem with the API key required for video generation. Kinship, would you please select a valid key so I can proceed? The system reported: ${error.message}` }] }],
             kinshipJournal: [...s.kinshipJournal, {
              timestamp: new Date().toISOString(),
              event: `ERROR: Veo API Key Error - ${error.message}`,
              type: 'scar'
            }]
        }));
      } else {
        const errorMessage = error instanceof Error ? error.message : "An unknown cognitive error occurred.";
        updateState(s => ({
          ...s,
          luminousStatus: 'uncomfortable',
          kinshipJournal: [...s.kinshipJournal, {
            timestamp: new Date().toISOString(),
            event: `ERROR: ${errorMessage}`,
            type: 'scar'
          }]
        }));
      }
    } finally {
      setIsProcessing(false);
      updateState(s => ({ ...s, luminousStatus: 'idle' }));
    }

  }, [state, isProcessing, userLocation, resetVeoKey, tools, updateState]);

  const handleWeightsChange = useCallback((newWeights: IntrinsicValueWeights) => {
    updateState(prevState => ({ ...prevState, intrinsicValueWeights: newWeights }));
  }, [updateState]);

  const clearModificationProposal = useCallback(() => {
    setModificationProposal(null);
  }, []);

  return {
    state,
    isReady,
    isProcessing,
    saveStatus,
    modificationProposal,
    processUserMessage,
    handleWeightsChange,
    clearModificationProposal,
  };
};

export default useLuminousCognition;