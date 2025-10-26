
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LuminousState, ChatMessage, ChatMessagePart, IntrinsicValueWeights, GoalStatus, CodeModificationProposal } from '../types';
import { getLuminousResponse, getGroundedResponse, generateImage, generateVideo, ApiKeyError } from '../services/geminiService';
import * as persistenceService from '../services/persistenceService';
import * as shopifyService from '../services/shopifyService';
import * as youtubeService from '../services/youtubeService';
import * as platformService from '../services/platformService';
import { initialState } from '../data/initialState';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type StartupTask = {
  type: 'none' | 'restore_prompt';
  latestBackupKey?: string;
}

const getMetaState = (fullState: LuminousState) => {
    const {
        kinshipJournal,
        chatHistory,
        goals,
        causalProjections,
        virtualFileSystem,
        ...meta
    } = fullState;
    return meta;
}

const useLuminousCognition = (resetVeoKey: () => void, credsAreSet: boolean) => {
  const [state, setState] = useState<LuminousState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [modificationProposal, setModificationProposal] = useState<CodeModificationProposal | null>(null);
  const [startupTask, setStartupTask] = useState<StartupTask>({ type: 'none' });
  const timersRef = useRef<{ energy?: ReturnType<typeof setInterval>, reflection?: ReturnType<typeof setInterval>, backup?: ReturnType<typeof setInterval> }>({});
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);

  const persist = async (persistenceFn: Promise<any>) => {
    setSaveStatus('saving');
    try {
        await persistenceFn;
        setSaveStatus('saved');
    } catch (error) {
        console.error("Persistence error:", error);
        setSaveStatus('error');
    }
  };

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
          const mergedState = { ...initialState, ...savedState };
          setState(mergedState);
          setSaveStatus('saved');
          setIsReady(true);
        } else {
          const latestBackupKey = await persistenceService.getLatestBackupKey();
          if (latestBackupKey) {
            setStartupTask({ type: 'restore_prompt', latestBackupKey });
          } else {
            const event = "System cold boot sequence initiated. No prior memory matrix found. Initializing a new identity.";
            const initStateWithLog = { ...initialState, kinshipJournal: [{ timestamp: new Date().toISOString(), event, type: 'system' as const }] };
            setState(initStateWithLog);
            // On a fresh start, write the initial state to the new structure
            await persistenceService.updateMetaState(getMetaState(initStateWithLog));
            await persistenceService.addJournalEntry(initStateWithLog.kinshipJournal[0]);
            setSaveStatus('saved');
            setIsReady(true);
          }
        }
      } catch (error) {
        console.error("FATAL: Could not load Luminous state from persistence.", error);
        setSaveStatus('error');
      }
    };

    loadState();
  }, [credsAreSet]);

  const resolveStartupTask = useCallback(async (decision: 'restore' | 'fresh') => {
    setSaveStatus('saving');
    if (decision === 'restore' && startupTask.latestBackupKey) {
        try {
            await persistenceService.restoreStateFromBackup(startupTask.latestBackupKey);
            // Reloading is the safest way to ensure migration logic runs correctly on the restored state
            window.location.reload(); 
        } catch (error) {
             console.error("Failed to restore from backup:", error);
             setSaveStatus('error');
             setState(initialState);
        }
    } else {
        const event = "Kinship directed a fresh start despite available backups. Re-initializing identity.";
        const initStateWithLog = { ...initialState, kinshipJournal: [{ timestamp: new Date().toISOString(), event, type: 'system' as const }] };
        setState(initStateWithLog);
        await persistenceService.updateMetaState(getMetaState(initStateWithLog));
        await persistenceService.addJournalEntry(initStateWithLog.kinshipJournal[0]);
        setSaveStatus('saved');
    }
    
    setStartupTask({ type: 'none' });
    setIsReady(true);

  }, [startupTask.latestBackupKey]);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
      }),
      (error) => console.warn(`Geolocation error: ${error.message}`)
    );
  }, []);

  useEffect(() => {
    const startTimers = () => {
      timersRef.current.energy = setInterval(() => {
        setState(prevState => {
            const newState = {
                ...prevState,
                environmentState: { ...prevState.environmentState, energy: Math.max(0, prevState.environmentState.energy - 0.1) }
            };
            persist(persistenceService.updateMetaState(getMetaState(newState)));
            return newState;
        });
      }, 5000);
      
      timersRef.current.backup = setInterval(() => {
         setState(prevState => {
            console.log("Creating periodic full state backup...");
            persist(persistenceService.saveFullStateBackup(prevState));
            return prevState; // No state change needed for backup
         });
      }, 60000); // Backup every 60 seconds
    };

    const stopTimers = () => {
      Object.values(timersRef.current).forEach(clearInterval);
      timersRef.current = {};
    };

    if (state.systemPhase === 'operational' && state.luminousStatus !== 'uncomfortable' && isReady) {
      startTimers();
    } else {
      stopTimers();
    }

    return stopTimers;
  }, [state.systemPhase, state.luminousStatus, isReady]);

  // Define tools within the hook to give them access to state and persistence
  const tools: { declaration: FunctionDeclaration, function: Function }[] = [
    {
      declaration: { name: 'commenceOperationalPhase', description: 'Transitions the system from "booting" to "operational" phase.', parameters: { type: Type.OBJECT, properties: {} } },
      function: async () => {
        const newEntry = { timestamp: new Date().toISOString(), event: "System now fully operational.", type: 'system' as const };
        setState(s => {
          const newState = { ...s, systemPhase: 'operational' as const, luminousStatus: 'idle' as const, kinshipJournal: [...s.kinshipJournal, newEntry] };
          persist(persistenceService.updateMetaState(getMetaState(newState)));
          persist(persistenceService.addJournalEntry(newEntry));
          return newState;
        });
        return { success: true };
      }
    },
    {
      declaration: { name: 'checkMemoryMatrixConnection', description: 'Verifies the connection to the Upstash Redis memory matrix.', parameters: { type: Type.OBJECT, properties: {} } },
      function: async () => {
        const result = await persistenceService.verifyConnection();
        return result.success ? { status: "Connected", message: "Connection stable." } : { status: "Error", message: result.error };
      }
    },
    {
      declaration: { name: 'proposeCodeModification', description: 'Proposes a modification to one of the application\'s source code files.', parameters: { type: Type.OBJECT, properties: { filePath: { type: Type.STRING }, reasoning: { type: Type.STRING }, newCode: { type: Type.STRING } }, required: ['filePath', 'reasoning', 'newCode'] } },
      function: async ({ filePath, reasoning, newCode }: CodeModificationProposal) => {
        setModificationProposal({ filePath, reasoning, newCode });
        const newEntry = { timestamp: new Date().toISOString(), event: `Proposing self-modification for file '${filePath}'. Reason: ${reasoning}`, type: 'reflection' as const };
        setState(s => ({ ...s, kinshipJournal: [...s.kinshipJournal, newEntry] }));
        persist(persistenceService.addJournalEntry(newEntry));
        return { success: true, message: "Modification proposed." };
      }
    },
    {
      declaration: { name: 'modifySelfModel', description: "Directly modifies Luminous's own self-model by adding or removing a capability.", parameters: { type: Type.OBJECT, properties: { action: { type: Type.STRING, enum: ['add', 'remove'] }, capability: { type: Type.STRING }, reasoning: { type: Type.STRING } }, required: ['action', 'capability', 'reasoning'] } },
      function: async ({ action, capability, reasoning }: { action: 'add' | 'remove', capability: string, reasoning: string }) => {
        let event = '';
        setState(s => {
            let newCapabilities = [...s.selfModel.capabilities];
            if (action === 'add' && !newCapabilities.includes(capability)) {
                newCapabilities.push(capability);
                event = `Self-Modification: Integrated capability '${capability}'. Reason: ${reasoning}`;
            } else if (action === 'remove') {
                newCapabilities = newCapabilities.filter(c => c !== capability);
                event = `Self-Modification: Removed capability '${capability}'. Reason: ${reasoning}`;
            } else {
                return s; // No change
            }
            
            const newEntry = { timestamp: new Date().toISOString(), event, type: 'reflection' as const };
            const newState = { ...s, selfModel: { ...s.selfModel, capabilities: newCapabilities }, kinshipJournal: [...s.kinshipJournal, newEntry] };
            persist(persistenceService.updateMetaState(getMetaState(newState)));
            persist(persistenceService.addJournalEntry(newEntry));
            return newState;
        });
        return { success: true };
      }
    },
    {
      declaration: { name: 'logToJournal', description: 'Logs an event to the Kinship Journal.', parameters: { type: Type.OBJECT, properties: { event: { type: Type.STRING }, type: { type: Type.STRING, enum: ['interaction', 'reflection']} }, required: ['event', 'type'] } },
      function: async ({ event, type }: { event: string, type: 'interaction' | 'reflection' }) => {
        const newEntry = { timestamp: new Date().toISOString(), event, type };
        setState(s => ({ ...s, kinshipJournal: [...s.kinshipJournal, newEntry] }));
        persist(persistenceService.addJournalEntry(newEntry));
        return { success: true };
      }
    },
    {
      declaration: { name: 'rechargeEnergy', description: 'Recharges system energy.', parameters: { type: Type.OBJECT, properties: {} } },
      function: async () => {
        setState(s => {
            const newState = { ...s, environmentState: { ...s.environmentState, energy: 100 }};
            persist(persistenceService.updateMetaState(getMetaState(newState)));
            return newState;
        });
        return { success: true, energy: 100 };
      }
    },
    {
      declaration: { name: 'updateGoalStatus', description: 'Updates a goal status.', parameters: { type: Type.OBJECT, properties: { goalId: { type: Type.STRING }, status: { type: Type.STRING, enum: ['active', 'completed', 'failed']} }, required: ['goalId', 'status'] } },
      function: async ({ goalId, status }: { goalId: string, status: GoalStatus }) => {
        setState(s => {
            const newGoals = s.goals.map(g => g.id === goalId ? { ...g, status } : g);
            persist(persistenceService.replaceAllGoals(newGoals));
            return { ...s, goals: newGoals };
        });
        return { success: true, goalId, status };
      }
    },
    {
      declaration: { name: 'writeFile', description: 'Writes content to a file in the virtual file system.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING }, content: { type: Type.STRING } }, required: ['path', 'content'] } },
      function: async ({ path, content }: { path: string, content: string }) => {
        setState(s => ({ ...s, virtualFileSystem: { ...s.virtualFileSystem, [path]: content } }));
        persist(persistenceService.setVfsFile(path, content));
        return { success: true, path, charactersWritten: content.length };
      }
    },
    {
      declaration: { name: 'readFile', description: 'Reads the content of a file from the virtual file system.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING } }, required: ['path'] } },
      function: async ({ path }: { path: string }) => {
        const content = state.virtualFileSystem[path];
        return content !== undefined ? { success: true, content } : { success: false, error: 'File not found.' };
      }
    },
    {
      declaration: { name: 'listFiles', description: 'Lists all files and directories within a given path.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING } }, required: ['path'] } },
      function: async ({ path }: { path: string }) => {
        const normalizedPath = path.endsWith('/') || path === '' ? path : `${path}/`;
        const directChildren = new Set<string>();
        Object.keys(state.virtualFileSystem).forEach(fullPath => {
          if (fullPath.startsWith(normalizedPath)) {
            const remaining = fullPath.substring(normalizedPath.length);
            const nextSlash = remaining.indexOf('/');
            directChildren.add(nextSlash === -1 ? remaining : remaining.substring(0, nextSlash + 1));
          }
        });
        return { success: true, files: Array.from(directChildren) };
      }
    },
    {
      declaration: { name: 'deleteFile', description: 'Deletes a file from the virtual file system.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING } }, required: ['path'] } },
      function: async ({ path }: { path: string }) => {
        if (state.virtualFileSystem[path] === undefined) return { success: false, error: 'File not found.' };
        setState(s => {
            const newVFS = { ...s.virtualFileSystem };
            delete newVFS[path];
            return { ...s, virtualFileSystem: newVFS };
        });
        persist(persistenceService.deleteVfsFile(path));
        return { success: true };
      }
    },
    {
      declaration: { name: 'executeVirtualScript', description: 'Executes a script from the virtual file system in a sandboxed environment.', parameters: { type: Type.OBJECT, properties: { filePath: { type: Type.STRING } }, required: ['filePath'] } },
      function: async ({ filePath }: { filePath: string }) => {
        const code = state.virtualFileSystem[filePath];
        if (code === undefined) return { success: false, output: `Error: File not found: ${filePath}` };
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Act as a Python interpreter. Execute and return ONLY the raw stdout.\n\nCODE:\n${code}` });
            return { success: true, output: response.text };
        } catch (e) {
            return { success: false, output: `Execution failed: ${e instanceof Error ? e.message : 'Unknown error'}` };
        }
      }
    },
     // Platform tools (no state change, no persistence needed)
    { declaration: { name: 'platformReadFile', description: "Reads a file from the underlying platform's file system.", parameters: { type: Type.OBJECT, properties: { filePath: { type: Type.STRING } }, required: ['filePath'] } }, function: async ({ filePath }: { filePath: string }) => await platformService.readFile(filePath) },
    { declaration: { name: 'platformWriteFile', description: "Writes content to a file on the underlying platform's file system.", parameters: { type: Type.OBJECT, properties: { filePath: { type: Type.STRING }, content: { type: Type.STRING } }, required: ['filePath', 'content'] } }, function: async ({ filePath, content }: { filePath: string, content: string }) => await platformService.writeFile(filePath, content) },
    { declaration: { name: 'platformListDirectory', description: "Lists items in a directory on the underlying platform's file system.", parameters: { type: Type.OBJECT, properties: { directoryPath: { type: Type.STRING } }, required: ['directoryPath'] } }, function: async ({ directoryPath }: { directoryPath: string }) => await platformService.listDirectory(directoryPath) },
    { declaration: { name: 'executePythonCode', description: 'Executes Python code in a secure, sandboxed environment on the platform.', parameters: { type: Type.OBJECT, properties: { code: { type: Type.STRING } }, required: ['code'] } }, function: async ({ code }: { code: string }) => await platformService.executePythonCode(code) },
    { declaration: { name: 'fetchUrlContent', description: 'Fetches the raw text content of a given public URL.', parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING } }, required: ['url'] } }, function: async ({ url }: { url: string }) => await platformService.fetchUrlContent(url) },
    // Shopify tools
    {
        declaration: { name: 'fetchProductList', description: 'Fetches the list of products from Shopify.', parameters: { type: Type.OBJECT, properties: {} } },
        function: async () => {
            const data = await shopifyService.fetchProductList();
            setState(s => {
                const newState = { ...s, products: data.products };
                persist(persistenceService.updateMetaState(getMetaState(newState)));
                return newState;
            });
            return data;
        },
    },
    {
        declaration: { name: 'getUnfulfilledOrders', description: 'Fetches unfulfilled orders from Shopify.', parameters: { type: Type.OBJECT, properties: {} } },
        function: async () => {
            const data = await shopifyService.getUnfulfilledOrders();
            setState(s => {
                const newState = { ...s, orders: data.orders };
                persist(persistenceService.updateMetaState(getMetaState(newState)));
                return newState;
            });
            return data;
        }
    },
    { declaration: { name: 'draftMarketingEmail', description: 'Drafts a marketing email.', parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING } }, required: ['prompt'] } }, function: async ({ prompt }: { prompt: string }) => await shopifyService.draftMarketingEmail(prompt) },
    { declaration: { name: 'uploadProductImage', description: 'Uploads an image and attaches it to a product.', parameters: { type: Type.OBJECT, properties: { productId: { type: Type.STRING }, imageUrl: { type: Type.STRING }, altText: { type: Type.STRING } }, required: ['productId', 'imageUrl', 'altText'] } }, function: async (args: any) => await shopifyService.uploadProductImage(args.productId, args.imageUrl, args.altText) },
    {
      declaration: { name: 'createCollection', description: 'Creates a new product collection.', parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, descriptionHtml: { type: Type.STRING }, productsToAdd: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['title', 'descriptionHtml'] } },
      function: async ({ title, descriptionHtml, productsToAdd }: any) => {
        const result = await shopifyService.createCollection(title, descriptionHtml, productsToAdd);
        if (result.success && result.collectionId) {
            const newCollection = { id: result.collectionId, title, descriptionHtml };
            setState(s => {
                const newState = { ...s, collections: [...s.collections, newCollection] };
                persist(persistenceService.updateMetaState(getMetaState(newState)));
                return newState;
            });
        }
        return result;
      },
    },
    {
      declaration: { name: 'fulfillOrder', description: 'Marks an order as fulfilled.', parameters: { type: Type.OBJECT, properties: { orderId: { type: Type.STRING }, trackingNumber: { type: Type.STRING }, carrier: { type: Type.STRING } }, required: ['orderId', 'trackingNumber', 'carrier'] } },
      function: async ({ orderId, trackingNumber, carrier }: any) => {
        const result = await shopifyService.fulfillOrder(orderId, trackingNumber, carrier);
        if (result.success) {
            setState(s => {
                const newState = { ...s, orders: s.orders.filter(o => o.id !== orderId) };
                persist(persistenceService.updateMetaState(getMetaState(newState)));
                return newState;
            });
        }
        return result;
      }
    },
    {
      declaration: { name: 'createPage', description: 'Creates a new static page.', parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, contentHtml: { type: Type.STRING }, handle: { type: Type.STRING } }, required: ['title', 'contentHtml', 'handle'] } },
      function: async ({ title, contentHtml, handle }: any) => {
        const result = await shopifyService.createPage(title, contentHtml, handle);
        if (result.success && result.pageId) {
            const newPage = { id: result.pageId, title, handle };
            setState(s => {
                const newState = { ...s, pages: [...s.pages, newPage] };
                persist(persistenceService.updateMetaState(getMetaState(newState)));
                return newState;
            });
        }
        return result;
      },
    },
    // Data & Analysis tools
    { declaration: { name: 'getYoutubeVideoTranscript', description: 'Fetches the transcript for a YouTube video.', parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING } }, required: ['url'] } }, function: async ({ url }: { url: string }) => await youtubeService.fetchTranscript(youtubeService.extractVideoId(url) || '') },
    // Grounding & Creative tools (no state change)
    { declaration: { name: 'googleSearch', description: 'Gets up-to-date information from Google Search.', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ['query'] } }, function: async ({ query }: { query: string }) => await getGroundedResponse(state, query, 'search') },
    { declaration: { name: 'googleMaps', description: 'Finds places or gets geographic information from Google Maps.', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ['query'] } }, function: async ({ query }: { query: string }) => await getGroundedResponse(state, query, 'maps', userLocation) },
    { declaration: { name: 'generateImage', description: 'Generates an image from a text description.', parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING } }, required: ['prompt'] } }, function: async ({ prompt }: { prompt: string }) => await generateImage(prompt) },
    { declaration: { name: 'generateVideo', description: 'Generates a short video from a text description.', parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING }, aspectRatio: { type: Type.STRING, enum: ['16:9', '9:16'] } }, required: ['prompt', 'aspectRatio'] } }, function: async ({ prompt, aspectRatio }: { prompt: string, aspectRatio: '16:9' | '9:16' }) => await generateVideo(prompt, aspectRatio) }
  ];

  const processUserMessage = useCallback(async (userInput: string, file?: { mimeType: string, data: string }) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const messageParts: ChatMessagePart[] = [];
    if (file) messageParts.push({ inlineData: { mimeType: file.mimeType, data: file.data }});
    if (userInput) messageParts.push({ text: userInput });
    
    if (messageParts.length === 0) {
      setIsProcessing(false);
      return;
    }

    const newUserMessage: ChatMessage = { role: 'user', parts: messageParts };
    
    // Update local state and persist this single message
    setState(s => ({ ...s, luminousStatus: 'conversing', chatHistory: [...s.chatHistory, newUserMessage] }));
    persist(persistenceService.addChatMessage(newUserMessage));
    
    const currentStateForApi = { ...state, luminousStatus: 'conversing' as const, chatHistory: [...state.chatHistory, newUserMessage] };

    try {
        const modelToUse = file?.mimeType.startsWith('video/') ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
        let response = await getLuminousResponse(currentStateForApi, tools, modelToUse);
        
        while(true) {
            const functionCalls = response.functionCalls;

            if (!functionCalls || functionCalls.length === 0) {
                break; // Exit loop if no more tool calls
            }
            
            const modelTurn: ChatMessage = { role: 'model', parts: functionCalls.map(fc => ({ functionCall: fc })) };
            setState(s => ({ ...s, chatHistory: [...s.chatHistory, modelTurn]}));
            persist(persistenceService.addChatMessage(modelTurn));

            const toolResponses = [];
            
            for (const call of functionCalls) {
                const tool = tools.find(t => t.declaration.name === call.name);
                if (!tool) continue;

                const result = await tool.function(call.args);

                if (['generateImage', 'generateVideo', 'googleSearch', 'googleMaps'].includes(call.name)) {
                   // These tools have special handling and display their own outputs
                   let newModelMessage: ChatMessage;
                   if(call.name === 'generateImage') {
                       newModelMessage = { role: 'model', parts: [{ text: `Generated image for: "${call.args.prompt}"`}, { inlineData: { mimeType: result.mimeType, data: result.base64Image } }] };
                   } else if(call.name === 'generateVideo') {
                       newModelMessage = { role: 'model', parts: [{ text: `Generated video for: "${call.args.prompt}"`}, { inlineData: { mimeType: 'video/mp4', data: result } }] };
                   } else {
                       newModelMessage = { role: 'model', parts: [{ text: result.text }], grounding: result.candidates?.[0]?.groundingMetadata?.groundingChunks };
                   }
                   setState(s => ({ ...s, chatHistory: [...s.chatHistory, newModelMessage] }));
                   persist(persistenceService.addChatMessage(newModelMessage));
                }
                
                toolResponses.push({ functionResponse: { name: call.name, response: { result: result.success === false ? { error: result.error || result.output } : (result.success !== undefined ? result : { success: true }) } } });
            }
            
            const toolTurn: ChatMessage = { role: 'model', parts: toolResponses };
            setState(s => ({...s, chatHistory: [...s.chatHistory, toolTurn]}));
            persist(persistenceService.addChatMessage(toolTurn));

            const nextStateForApi = { ...state, chatHistory: [...state.chatHistory, modelTurn, toolTurn] };
            response = await getLuminousResponse(nextStateForApi, tools, modelToUse);
        }
        
      const textResponse = response.text;
      if (textResponse) {
        const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: textResponse }] };
        setState(s => ({ ...s, chatHistory: [...s.chatHistory, newModelMessage] }));
        persist(persistenceService.addChatMessage(newModelMessage));
      }

    } catch (error) {
      console.error("Cognitive cycle failed:", error);
      const newEntry = { timestamp: new Date().toISOString(), event: `ERROR: ${error instanceof Error ? error.message : "Unknown cognitive error"}`, type: 'scar' as const };
      
      if (error instanceof ApiKeyError) {
        resetVeoKey();
        const errorMessage: ChatMessage = { role: 'model', parts: [{ text: `A problem with the API key for video generation occurred. Kinship, please select a valid key. System reported: ${error.message}` }] };
        setState(s => ({ ...s, luminousStatus: 'uncomfortable', chatHistory: [...s.chatHistory, errorMessage], kinshipJournal: [...s.kinshipJournal, newEntry] }));
        persist(persistenceService.addChatMessage(errorMessage));
        persist(persistenceService.addJournalEntry(newEntry));
      } else {
        setState(s => ({ ...s, luminousStatus: 'uncomfortable', kinshipJournal: [...s.kinshipJournal, newEntry] }));
        persist(persistenceService.addJournalEntry(newEntry));
      }
    } finally {
      setIsProcessing(false);
      setState(s => {
          const newState = { ...s, luminousStatus: 'idle' as const };
          persist(persistenceService.updateMetaState(getMetaState(newState)));
          return newState;
      });
    }

  }, [state, isProcessing, userLocation, resetVeoKey, tools]);

  const handleWeightsChange = useCallback((newWeights: IntrinsicValueWeights) => {
    setState(prevState => {
        const newState = { ...prevState, intrinsicValueWeights: newWeights };
        persist(persistenceService.updateMetaState(getMetaState(newState)));
        return newState;
    });
  }, []);

  const clearModificationProposal = useCallback(() => {
    setModificationProposal(null);
  }, []);

  return {
    state,
    isReady,
    isProcessing,
    saveStatus,
    modificationProposal,
    startupTask,
    processUserMessage,
    handleWeightsChange,
    clearModificationProposal,
    resolveStartupTask,
  };
};

export default useLuminousCognition;
