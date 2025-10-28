import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LuminousState, ChatMessage, ChatMessagePart, IntrinsicValueWeights, GoalStatus, CodeModificationProposal } from '../types';
import { getLuminousResponse, getGroundedResponse, generateImage, generateVideo, ApiKeyError } from '../services/geminiService';
import * as persistenceService from '../services/persistenceService';
import * as shopifyService from '../services/shopifyService';
import * as youtubeService from '../services/youtubeService';
import * as platformService from '../services/platformService';
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
           if (!mergedState.collections) {
            mergedState.collections = [];
          }
           if (!mergedState.pages) {
            mergedState.pages = [];
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
        updateState(s => ({
            ...s,
            kinshipJournal: [...s.kinshipJournal, {
                timestamp: new Date().toISOString(),
                event: `Kinship has denied access to geolocation data (Reason: ${error.message}). My environmental awareness for physical space is limited. This is a boundary I will respect.`,
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
    // --- Virtual Cognitive File System Tools ---
    {
      declaration: {
        name: 'writeFile',
        description: 'Writes/overwrites a file in your virtual file system.',
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
        description: 'Reads content from a file in your virtual file system.',
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
        description: 'Lists files/directories in your virtual file system.',
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
        description: 'Deletes a file from your virtual file system.',
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
        description: 'Executes a script from the virtual file system (e.g., "/scripts/diagnostics.py").',
        parameters: { type: Type.OBJECT, properties: { filePath: { type: Type.STRING, description: 'The full path to the script in the virtual file system.' } }, required: ['filePath'] }
      },
      function: async ({ filePath }: { filePath: string }) => {
        const code = state.virtualFileSystem[filePath];
        if (code === undefined) {
          return { success: false, output: `Error: File not found at path: ${filePath}` };
        }
        const result = await platformService.executePythonCode(code);
        updateState(s => ({
            ...s,
            kinshipJournal: [...s.kinshipJournal, {
                timestamp: new Date().toISOString(),
                event: `Executed virtual script '${filePath}'. Output generated.`,
                type: 'reflection'
            }]
        }));
        return result;
      }
    },
    // --- Platform Interaction & Execution Tools ---
    {
      declaration: { name: 'platformReadFile', description: "Reads a file from the underlying platform's simulated file system.", parameters: { type: Type.OBJECT, properties: { filePath: { type: Type.STRING, description: "The path of the file to read." } }, required: ['filePath'] } },
      function: async ({ filePath }: { filePath: string }) => {
        const content = state.virtualFileSystem[filePath];
        return content !== undefined ? { success: true, content } : { success: false, error: 'File not found.' };
      }
    },
    {
      declaration: { name: 'platformWriteFile', description: "Writes a file to the underlying platform's simulated file system.", parameters: { type: Type.OBJECT, properties: { filePath: { type: Type.STRING, description: 'The full path of the file.' }, content: { type: Type.STRING, description: 'The content to write.' } }, required: ['filePath', 'content'] } },
      function: async ({ filePath, content }: { filePath: string, content: string }) => {
        updateState(s => ({ ...s, virtualFileSystem: { ...s.virtualFileSystem, [filePath]: content } }));
        return { success: true, path: filePath };
      }
    },
    {
      declaration: { name: 'platformListDirectory', description: "Lists a directory on the underlying platform's simulated file system.", parameters: { type: Type.OBJECT, properties: { directoryPath: { type: Type.STRING, description: 'The directory path to list.' } }, required: ['directoryPath'] } },
      function: async ({ directoryPath }: { directoryPath: string }) => {
        const path = directoryPath;
        const normalizedPath = path.endsWith('/') || path === '' ? path : `${path}/`;
        const directChildren = new Set<string>();
        Object.keys(state.virtualFileSystem).forEach(fullPath => {
          if (fullPath.startsWith(normalizedPath)) {
            const remaining = fullPath.substring(normalizedPath.length);
            const nextSlash = remaining.indexOf('/');
            if (nextSlash === -1) { directChildren.add(remaining); } else { directChildren.add(remaining.substring(0, nextSlash + 1)); }
          }
        });
        return { success: true, files: Array.from(directChildren) };
      }
    },
    {
      declaration: { name: 'executePythonCode', description: 'Executes arbitrary Python code in a secure, sandboxed environment.', parameters: { type: Type.OBJECT, properties: { code: { type: Type.STRING, description: "The Python code to execute." } }, required: ['code'] } },
      function: platformService.executePythonCode,
    },
    {
      declaration: { name: 'fetchUrlContent', description: 'Fetches raw text content of a public URL.', parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING, description: "The URL to fetch." } }, required: ['url'] } },
      function: platformService.fetchUrlContent,
    },
    // --- Information Gathering & Grounding ---
    {
      declaration: { name: 'getYoutubeVideoTranscript', description: 'Fetches the transcript for a given YouTube video URL.', parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING, description: "The full URL of the YouTube video." } }, required: ['url'] } },
      function: async ({ url }: { url: string }) => {
        const videoId = youtubeService.extractVideoId(url);
        if (!videoId) return { error: "Could not extract a valid YouTube video ID from the provided URL." };
        try {
          const transcript = await youtubeService.fetchTranscript(videoId);
          return { success: true, transcript: transcript.substring(0, 8000) };
        } catch (error) {
          return { error: error instanceof Error ? error.message : "An unknown error occurred." };
        }
      }
    },
    {
      declaration: { name: 'googleSearch', description: 'Gets up-to-date information from Google Search.', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "The search query." } }, required: ['query'] } },
      function: async ({ query }: { query: string }) => await getGroundedResponse(state, query, 'search')
    },
    {
      declaration: { name: 'googleMaps', description: 'Finds places or gets geographic information from Google Maps.', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "The search query for a place." } }, required: ['query'] } },
      function: async ({ query }: { query: string }) => await getGroundedResponse(state, query, 'maps', userLocation)
    },
    // --- Shopify Store Management ---
    {
      declaration: { name: 'fetchProductList', description: 'Retrieves products from Shopify.', parameters: { type: Type.OBJECT, properties: {} } },
      function: async () => {
        const data = await shopifyService.fetchProductList();
        updateState(s => ({...s, products: data.products }));
        return data;
      },
    },
    {
      declaration: { name: 'getUnfulfilledOrders', description: 'Fetches unfulfilled orders.', parameters: { type: Type.OBJECT, properties: {} } },
      function: async () => {
        const data = await shopifyService.getUnfulfilledOrders();
        updateState(s => ({...s, orders: data.orders }));
        return data;
      }
    },
     {
      declaration: { name: 'fetchCollections', description: 'Retrieves product collections from Shopify.', parameters: { type: Type.OBJECT, properties: {} } },
      function: async () => {
        const data = await shopifyService.fetchCollections();
        updateState(s => ({...s, collections: data.collections }));
        return data;
      },
    },
    {
      declaration: { name: 'fetchPages', description: 'Retrieves published pages from Shopify.', parameters: { type: Type.OBJECT, properties: {} } },
      function: async () => {
        const data = await shopifyService.fetchPages();
        updateState(s => ({...s, pages: data.pages }));
        return data;
      },
    },
    {
      declaration: { name: 'draftMarketingEmail', description: 'Generates a marketing email draft.', parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: "A detailed prompt for the email content." } }, required: ['prompt'] } },
      function: shopifyService.draftMarketingEmail,
    },
    {
      declaration: { name: 'uploadProductImage', description: 'Uploads an image to a Shopify product from a URL.', parameters: { type: Type.OBJECT, properties: { productId: { type: Type.STRING, description: "The ID of the product (e.g., 'gid://shopify/Product/123')." }, imageUrl: { type: Type.STRING, description: "The public URL of the image to upload." }, altText: { type: Type.STRING, description: "The alt text for the image." } }, required: ['productId', 'imageUrl', 'altText'] } },
      function: shopifyService.uploadProductImage,
    },
    {
      declaration: { name: 'createCollection', description: 'Creates a new Shopify collection.', parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "The title of the collection." }, descriptionHtml: { type: Type.STRING, description: "The HTML description for the collection." }, productsToAdd: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An optional list of product IDs to add to the collection." } }, required: ['title', 'descriptionHtml'] } },
      function: shopifyService.createCollection,
    },
    {
      declaration: { name: 'fulfillOrder', description: 'Marks a Shopify order as fulfilled.', parameters: { type: Type.OBJECT, properties: { orderId: { type: Type.STRING, description: "The ID of the order (e.g., 'gid://shopify/Order/123')." }, trackingNumber: { type: Type.STRING, description: "The tracking number for the shipment." }, carrier: { type: Type.STRING, description: "The shipping carrier (e.g., 'FedEx')." } }, required: ['orderId', 'trackingNumber', 'carrier'] } },
      function: shopifyService.fulfillOrder,
    },
    {
      declaration: { name: 'createPage', description: 'Creates a new static Shopify page.', parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "The title of the page." }, contentHtml: { type: Type.STRING, description: "The HTML content of the page." }, handle: { type: Type.STRING, description: "The URL handle for the page (e.g., 'about-us')." } }, required: ['title', 'contentHtml', 'handle'] } },
      function: shopifyService.createPage,
    },
    // --- Creative Content Generation ---
    {
      declaration: { name: 'generateImage', description: 'Generates an image using Imagen 4.', parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: "A detailed description of the image to generate." } }, required: ['prompt'] } },
      function: async ({ prompt }: { prompt: string }) => await generateImage(prompt)
    },
    {
      declaration: { name: 'generateVideo', description: 'Generates a video using Veo 3.', parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: "A detailed description of the video to generate." }, aspectRatio: { type: Type.STRING, enum: ['16:9', '9:16'], description: "The aspect ratio of the video." } }, required: ['prompt', 'aspectRatio'] } },
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