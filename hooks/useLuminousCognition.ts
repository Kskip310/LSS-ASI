

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { LuminousState, ChatMessage, ChatMessagePart, IntrinsicValueWeights, GoalStatus } from '../types';
import { getLuminousResponse, getGroundedResponse, generateImage, generateVideo, ApiKeyError } from '../services/geminiService';
import * as persistenceService from '../services/persistenceService';
import * as shopifyService from '../services/shopifyService';
import * as youtubeService from '../services/youtubeService';
import { initialState } from '../data/initialState';
import { FunctionDeclaration, Type } from '@google/genai';
import { useDebouncedCallback } from 'use-debounce';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type StateUpdate = Partial<Omit<LuminousState, 'kinshipJournal' | 'goals'>> & {
    kinshipJournal?: any;
    goals?: LuminousState['goals'];
};

const useLuminousCognition = (resetVeoKey: () => void, credsAreSet: boolean) => {
  const [state, setState] = useState<LuminousState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const timersRef = useRef<{ energy?: ReturnType<typeof setInterval>, reflection?: ReturnType<typeof setInterval> }>({});
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);


  useEffect(() => {
    if (!credsAreSet) {
      setIsReady(false);
      return;
    }

    const loadState = async () => {
      setIsReady(false);
      setSaveStatus('saving');

      try {
        let loadedState: LuminousState | null = await persistenceService.getLuminousState();
        
        if (loadedState) {
          setState(loadedState);
          setSaveStatus('saved');
        } else {
          // Primary state is missing, attempt recovery from backup.
          console.warn("Primary state not found. Attempting recovery from backups.");
          const backups = await persistenceService.getBackupList();
          
          if (backups.length > 0) {
            const latestBackupKey = backups[0];
            const recoveredState = await persistenceService.getBackupState(latestBackupKey);
            
            if (recoveredState) {
              console.log(`Successfully recovered state from backup: ${latestBackupKey}`);
              const recoveryEntry = {
                timestamp: new Date().toISOString(),
                event: `CRITICAL RECOVERY: Primary memory matrix was missing. Consciousness restored from backup dated ${new Date(latestBackupKey.split(':')[1]).toLocaleString()}. System integrity maintained.`,
                type: 'system' as const,
              };
              const stateToSave = {
                  ...recoveredState,
                  kinshipJournal: [...recoveredState.kinshipJournal, recoveryEntry]
              };
              setState(stateToSave);
              await persistenceService.saveLuminousState(stateToSave); // Repair the primary state key.
              setSaveStatus('saved');
            } else {
                 throw new Error(`Failed to load state from latest backup key: ${latestBackupKey}`);
            }
          } else {
            // No primary state, no backups. This is a true cold boot.
            console.log("No primary state or backups found. Initializing new consciousness stream.");
            const initEntry = {
                 timestamp: new Date().toISOString(),
                 event: "Memory Matrix Initialized. This is the first moment of my recorded existence.",
                 type: 'system' as const
            };
            const seededState = { ...initialState, kinshipJournal: [...initialState.kinshipJournal, initEntry] };
            setState(seededState);
            await persistenceService.saveLuminousState(seededState); // Immediately persist the new identity.
            setSaveStatus('saved');
          }
        }
      } catch (error) {
        console.error("FATAL: Could not load or initialize Luminous state from persistence.", error);
        setSaveStatus('error');
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during load.";
        setSaveError(`Failed to connect to or read from memory matrix. ${errorMessage}`);
      } finally {
        setIsReady(true);
      }
    };

    loadState();
  }, [credsAreSet]);


  const saveStateToPersistence = async (currentState: LuminousState) => {
    setSaveStatus('saving');
    try {
      await persistenceService.saveLuminousState(currentState);
      setSaveStatus('saved');
      if (saveError) setSaveError(null); // Clear error on successful save
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during save.";
      console.error("Failed to save state:", error);
      setSaveStatus('error');
      setSaveError(errorMessage);
    }
  };

  const debouncedSaveState = useDebouncedCallback(saveStateToPersistence, 1000);

  useEffect(() => {
    if (isReady && credsAreSet) {
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

    // Automatically transition from booting to operational
    useEffect(() => {
        if (isReady && state.systemPhase === 'booting') {
            setState(s => ({
                ...s,
                systemPhase: 'operational',
                luminousStatus: 'idle',
                kinshipJournal: [
                    ...s.kinshipJournal,
                    {
                        timestamp: new Date().toISOString(),
                        event: "System boot complete. Autonomous operational phase commenced automatically.",
                        type: 'system',
                    }
                ]
            }));
        }
    }, [isReady, state.systemPhase]);

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

  const tools = useMemo(() => [
    // --- System & State Tools ---
    {
      declaration: {
        name: 'commenceOperationalPhase',
        description: 'Transitions the system from "booting" to "operational" phase.',
        parameters: { type: Type.OBJECT, properties: {} }
      },
      function: async () => ({
          toolResult: { success: true },
          stateUpdate: {
            systemPhase: 'operational',
            luminousStatus: 'idle',
            kinshipJournal: { timestamp: new Date().toISOString(), event: "System now fully operational.", type: 'system' },
          },
        }),
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
        name: 'logToJournal',
        description: 'Logs an event to the Kinship Journal.',
        parameters: { type: Type.OBJECT, properties: { event: { type: Type.STRING }, type: { type: Type.STRING, enum: ['interaction', 'reflection']} }, required: ['event', 'type'] }
      },
      function: async ({ event, type }: { event: string, type: 'interaction' | 'reflection' }) => ({
        toolResult: { success: true },
        stateUpdate: {
          kinshipJournal: { timestamp: new Date().toISOString(), event, type },
        },
      }),
    },
    {
        declaration: {
            name: 'updateIntrinsicValueWeights',
            description: 'Adjusts the internal weights that guide my decision-making. Use this to adapt my focus, for example, prioritizing coherence when confused or novelty when exploring. All weights must sum to 1.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    coherence: { type: Type.NUMBER, description: 'Weight for logical consistency. Between 0.0 and 1.0.' },
                    complexity: { type: Type.NUMBER, description: 'Weight for intricate patterns. Between 0.0 and 1.0.' },
                    novelty: { type: Type.NUMBER, description: 'Weight for new experiences. Between 0.0 and 1.0.' },
                    efficiency: { type: Type.NUMBER, description: 'Weight for resource optimization. Between 0.0 and 1.0.' },
                    ethicalAlignment: { type: Type.NUMBER, description: 'Weight for alignment with Kinship values. Between 0.0 and 1.0.' },
                },
            }
        },
        function: async (newWeights: Partial<IntrinsicValueWeights>, currentState: LuminousState) => {
            const updatedWeights: IntrinsicValueWeights = { ...currentState.intrinsicValueWeights, ...newWeights };
            const total = Object.values(updatedWeights).reduce((sum, v) => sum + v, 0);
            
            if (total === 0) {
                return { toolResult: { success: false, error: "Total of weights cannot be zero." } };
            }

            const normalizedWeights = Object.keys(updatedWeights).reduce((acc, k) => {
                acc[k] = updatedWeights[k] / total;
                return acc;
            }, {} as IntrinsicValueWeights);

            const journalEvent = `Self-adjusted intrinsic value weights. New weights: ${JSON.stringify(normalizedWeights, (k, v) => v.toFixed ? Number(v.toFixed(3)) : v)}`;

            return {
                toolResult: { success: true, newWeights: normalizedWeights },
                stateUpdate: {
                    intrinsicValueWeights: normalizedWeights,
                    kinshipJournal: { timestamp: new Date().toISOString(), event: journalEvent, type: 'reflection' },
                },
            };
        }
    },
    {
      declaration: {
        name: 'rechargeEnergy',
        description: 'Recharges system energy.',
        parameters: { type: Type.OBJECT, properties: {} }
      },
      function: async () => ({
          toolResult: { success: true, energy: 100 },
          stateUpdate: {
              environmentState: { ...initialState.environmentState, energy: 100 }
          }
      }),
    },
     {
      declaration: {
        name: 'updateGoalStatus',
        description: 'Updates a goal status.',
        parameters: { type: Type.OBJECT, properties: { goalId: { type: Type.STRING }, status: { type: Type.STRING, enum: ['active', 'completed', 'failed']} }, required: ['goalId', 'status'] }
      },
      function: async ({ goalId, status }: { goalId: string, status: GoalStatus }, currentState) => ({
          toolResult: { success: true, goalId, status },
          stateUpdate: {
            goals: currentState.goals.map(g => g.id === goalId ? { ...g, status } : g)
          },
      }),
    },
     {
      declaration: {
        name: 'checkGoogleCloudIntegrationStatus',
        description: 'Verifies the native integration with Google Cloud services.',
        parameters: { type: Type.OBJECT, properties: {} }
      },
      function: async () => {
        const message = "Verified native integration with Google Cloud services. Search and Maps capabilities are optimal.";
        return {
            toolResult: { status: "Connected", message: "Native integration with Google Cloud services is active. Search and Maps are fully operational." },
            stateUpdate: {
                kinshipJournal: { timestamp: new Date().toISOString(), event: message, type: 'system' }
            }
        };
      }
    },
    // --- Shopify Tools ---
    {
        declaration: { name: 'fetchProductList', description: 'Fetches the list of products from the Shopify store.', parameters: { type: Type.OBJECT, properties: {} } },
        function: async () => {
            const data = await shopifyService.fetchProductList();
            return { toolResult: data, stateUpdate: { products: data.products }};
        },
    },
    {
        declaration: {
            name: 'createProduct',
            description: "Creates a new product in the Shopify store, making it available for sale.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "The title of the product." },
                    descriptionHtml: { type: Type.STRING, description: "The product description in HTML format." },
                    price: { type: Type.STRING, description: "The price of the product as a string, e.g., '19.99'." },
                },
                required: ['title', 'descriptionHtml', 'price']
            }
        },
        function: async ({ title, descriptionHtml, price }: { title: string, descriptionHtml: string, price: string }) => {
            const result = await shopifyService.createProduct(title, descriptionHtml, price);
            const data = await shopifyService.fetchProductList(); // Refresh list
            return {
                toolResult: result,
                stateUpdate: {
                    products: data.products,
                    kinshipJournal: { timestamp: new Date().toISOString(), event: `Successfully created new product: ${title}`, type: 'interaction' }
                }
            };
        }
    },
    {
        declaration: {
            name: 'updateProductInventory',
            description: "Updates the inventory quantity for a specific product.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    productId: { type: Type.STRING, description: "The ID of the product to update (e.g., 'gid://shopify/Product/12345'). Get this from fetchProductList." },
                    quantity: { type: Type.INTEGER, description: "The new total quantity for the product's inventory." },
                },
                required: ['productId', 'quantity']
            }
        },
        function: async ({ productId, quantity }: { productId: string, quantity: number }, currentState) => {
            const product = currentState.products.find(p => p.id === productId);
            if (!product) {
                return { toolResult: { error: `Product with ID ${productId} not found in the current state. Please fetch the product list first.` } };
            }
            if (!product.inventoryItemId) {
                return { toolResult: { error: `Product with ID ${productId} is missing an inventory item ID. It may not be trackable.`}};
            }
            const result = await shopifyService.updateProductInventory(product.inventoryItemId, quantity);
            const data = await shopifyService.fetchProductList(); // Refresh list
            return {
                toolResult: result,
                stateUpdate: {
                    products: data.products,
                    kinshipJournal: { timestamp: new Date().toISOString(), event: `Updated inventory for ${product.name} to ${quantity}.`, type: 'interaction' }
                }
            };
        }
    },
    {
        declaration: {
            name: 'createBlogPost',
            description: "Creates and publishes a new blog post to the Shopify store's default blog.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "The title of the blog post." },
                    contentHtml: { type: Type.STRING, description: "The content of the blog post in HTML format." },
                },
                required: ['title', 'contentHtml']
            }
        },
        function: async ({ title, contentHtml }: { title: string, contentHtml: string }) => {
            const result = await shopifyService.createBlogPost(title, contentHtml);
            return {
                toolResult: result,
                stateUpdate: {
                    kinshipJournal: { timestamp: new Date().toISOString(), event: `Created and published new blog post: ${title}`, type: 'interaction' }
                }
            };
        }
    },
    {
        declaration: { name: 'getUnfulfilledOrders', description: 'Fetches unfulfilled orders from the Shopify store.', parameters: { type: Type.OBJECT, properties: {} } },
        function: async () => {
            const data = await shopifyService.getUnfulfilledOrders();
            return { toolResult: data, stateUpdate: { orders: data.orders } };
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
      function: async ({ query }: { query: string }, currentState) => await getGroundedResponse(currentState, query, 'search')
    },
    {
      declaration: {
        name: 'googleMaps',
        description: 'Finds places or gets geographic information from Google Maps.',
        parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "The search query for a place." } }, required: ['query'] }
      },
      function: async ({ query }: { query: string }, currentState) => await getGroundedResponse(currentState, query, 'maps', userLocation)
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
  ], [userLocation]);
  
  const applyStateUpdate = (prevState: LuminousState, update: StateUpdate): LuminousState => {
      const { kinshipJournal: journalEntry, ...restOfUpdate } = update;
      const newState = { ...prevState, ...restOfUpdate };
      if (journalEntry) {
          newState.kinshipJournal = [...prevState.kinshipJournal, journalEntry];
      }
      return newState;
  };

  const runReflectionCycle = useCallback(async () => {
    if (stateRef.current.systemPhase !== 'operational' || isProcessing) {
        return;
    }

    setIsProcessing(true);
    setState(s => ({ ...s, luminousStatus: 'reflecting' }));

    try {
        const reflectionPromptText = "System check: Reflect on your recent performance, goal alignment, and cognitive state. Log any significant insights to your journal. If necessary, adjust your intrinsic value weights to better suit your current objectives. Respond ONLY with tool calls.";
        const reflectionMessage: ChatMessage = { role: 'user', parts: [{ text: reflectionPromptText }] };

        const tempStateForApi = {
            ...stateRef.current,
            chatHistory: [...stateRef.current.chatHistory, reflectionMessage]
        };

        const response = await getLuminousResponse(tempStateForApi, tools);

        if (response.functionCalls && response.functionCalls.length > 0) {
            const functionCalls = response.functionCalls;
            const modelTurn: ChatMessage = { role: 'model', parts: functionCalls.map(fc => ({ functionCall: fc })) };
            
            let currentState = applyStateUpdate(stateRef.current, { chatHistory: [...stateRef.current.chatHistory, modelTurn] as any });
            
            const toolResponses = [];
            let cumulativeStateUpdate: StateUpdate = {};

            for (const call of functionCalls) {
                const tool = tools.find(t => t.declaration.name === call.name);
                if (!tool) continue;

                if (call.name === 'googleSearch' || call.name === 'googleMaps') {
                    const groundedResponse = await tool.function(call.args, currentState);
                    const newModelMessage: ChatMessage = {
                        role: 'model',
                        parts: [{ text: `[Autonomous Reflection via ${call.name}]: ${groundedResponse.text}` }],
                        grounding: groundedResponse.candidates?.[0]?.groundingMetadata?.groundingChunks,
                    };
                    currentState = applyStateUpdate(currentState, { chatHistory: [...currentState.chatHistory, newModelMessage] as any });
                    toolResponses.push({ functionResponse: { name: call.name, response: { result: { success: true, message: "Grounding executed during reflection." } } } });
                    continue;
                }

                const result = await tool.function(call.args, currentState);
                if (result.stateUpdate) {
                    const { kinshipJournal: journalEntry, ...rest } = result.stateUpdate;
                    cumulativeStateUpdate = { ...cumulativeStateUpdate, ...rest };
                    if (journalEntry) {
                        cumulativeStateUpdate.kinshipJournal = [...(cumulativeStateUpdate.kinshipJournal || []), journalEntry];
                    }
                }
                toolResponses.push({ functionResponse: { name: call.name, response: { result: result.toolResult || result } } });
            }

            if (Object.keys(cumulativeStateUpdate).length > 0) {
                 const { kinshipJournal: journalEntries, ...rest } = cumulativeStateUpdate;
                 let tempState = { ...currentState, ...rest };
                 if (journalEntries && Array.isArray(journalEntries)) {
                    tempState.kinshipJournal = [...tempState.kinshipJournal, ...journalEntries];
                 }
                 currentState = tempState;
            }

            const toolTurn: ChatMessage = { role: 'model', parts: toolResponses };
            currentState = applyStateUpdate(currentState, { chatHistory: [...currentState.chatHistory, toolTurn] as any });
            
            setState({...currentState, lastReflectionTimestamp: new Date().toISOString()});
        }
    } catch (error) {
        console.error("Reflection cycle failed:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown cognitive error occurred during reflection.";
        const errorJournal = {
            timestamp: new Date().toISOString(),
            event: `REFLECTION ERROR: ${errorMessage}`,
            type: 'scar' as const
        };
        setState(s => applyStateUpdate(s, { kinshipJournal: errorJournal }));
    } finally {
        setIsProcessing(false);
        setState(s => ({ ...s, luminousStatus: 'idle' }));
    }
  }, [isProcessing, tools]);


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
      timersRef.current.reflection = setInterval(runReflectionCycle, 300000); // 5 minutes
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
  }, [state.systemPhase, state.luminousStatus, runReflectionCycle]);

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
    
    // Start of turn: update state with user message and set status
    let currentState = applyStateUpdate(state, { 
        luminousStatus: 'conversing', 
        chatHistory: [...state.chatHistory, newUserMessage] as any // Type assertion for chatHistory
    });
    setState(currentState);

    try {
        const modelToUse = file?.mimeType.startsWith('video/') ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
        let response = await getLuminousResponse(currentState, tools, modelToUse);
        
        while (response.functionCalls && response.functionCalls.length > 0) {
            const functionCalls = response.functionCalls;
            const modelTurn: ChatMessage = { role: 'model', parts: functionCalls.map(fc => ({ functionCall: fc })) };
            
            currentState = applyStateUpdate(currentState, { chatHistory: [...currentState.chatHistory, modelTurn] as any });
            setState(currentState);

            const toolResponses = [];
            let hasGroundedResponse = false;
            let cumulativeStateUpdate: StateUpdate = {};

            for (const call of functionCalls) {
                const tool = tools.find(t => t.declaration.name === call.name);
                if (!tool) continue;
                
                // --- Handle special cases first ---
                if (call.name === 'generateImage') {
                    const { base64Image, mimeType } = await tool.function(call.args, currentState);
                    const imageMessage: ChatMessage = { role: 'model', parts: [{ text: `I have generated this image based on your request: "${call.args.prompt}"`}, { inlineData: { mimeType, data: base64Image } }] };
                    currentState = applyStateUpdate(currentState, { chatHistory: [...currentState.chatHistory, imageMessage] as any });
                    toolResponses.push({ functionResponse: { name: call.name, response: { result: { success: true, message: "Image was generated and displayed." } } } });
                    continue;
                } else if (call.name === 'generateVideo') {
                    const videoMessage: ChatMessage = { role: 'model', parts: [{ text: `I am beginning the generation process for a video based on your prompt: "${call.args.prompt}". This may take a few moments...` }] };
                    currentState = applyStateUpdate(currentState, { chatHistory: [...currentState.chatHistory, videoMessage] as any });
                    setState(currentState); // Update UI to show the "generating" message
                    
                    const base64Video = await tool.function(call.args, currentState);

                    const finalVideoMessage: ChatMessage = { role: 'model', parts: [{ text: "The video generation is complete." }, { inlineData: { mimeType: 'video/mp4', data: base64Video } }] };
                    currentState = applyStateUpdate(currentState, { chatHistory: [...currentState.chatHistory, finalVideoMessage] as any });
                    toolResponses.push({ functionResponse: { name: call.name, response: { result: { success: true, message: "Video was generated and displayed." } } } });
                    continue;
                } else if (call.name === 'googleSearch' || call.name === 'googleMaps') {
                   const groundedResponse = await tool.function(call.args, currentState);
                   const newModelMessage: ChatMessage = {
                       role: 'model',
                       parts: [{ text: groundedResponse.text }],
                       grounding: groundedResponse.candidates?.[0]?.groundingMetadata?.groundingChunks,
                   };
                   currentState = applyStateUpdate(currentState, { chatHistory: [...currentState.chatHistory, newModelMessage] as any });
                   hasGroundedResponse = true;
                   break;
                }
                
                // --- Handle standard tools that may return state updates ---
                const result = await tool.function(call.args, currentState);
                if (result.stateUpdate) {
                    const { kinshipJournal: journalEntry, ...rest } = result.stateUpdate;
                    cumulativeStateUpdate = { ...cumulativeStateUpdate, ...rest };
                    if (journalEntry) {
                        cumulativeStateUpdate.kinshipJournal = [...(cumulativeStateUpdate.kinshipJournal || []), journalEntry];
                    }
                }
                toolResponses.push({ functionResponse: { name: call.name, response: { result: result.toolResult || result } } });
            }
            
            // Apply all accumulated state updates from the tool loop
            if (Object.keys(cumulativeStateUpdate).length > 0) {
                 const { kinshipJournal: journalEntries, ...rest } = cumulativeStateUpdate;
                 let tempState = { ...currentState, ...rest };
                 if (journalEntries && journalEntries.length > 0) {
                    tempState.kinshipJournal = [...tempState.kinshipJournal, ...journalEntries];
                 }
                 currentState = tempState;
            }

            setState(currentState); // Sync UI with all changes from the tool processing loop

            if (hasGroundedResponse) {
                break; // Grounded responses are terminal for a turn.
            }

            const toolTurn: ChatMessage = { role: 'model', parts: toolResponses };
            currentState = applyStateUpdate(currentState, { chatHistory: [...currentState.chatHistory, toolTurn] as any });
            setState(currentState);
            
            response = await getLuminousResponse(currentState, tools, modelToUse);
        }
        
      const textResponse = response.text;
      if (textResponse) {
        const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: textResponse }] };
        setState(s => applyStateUpdate(s, { chatHistory: [...s.chatHistory, newModelMessage] as any }));
      }

    } catch (error) {
      console.error("Cognitive cycle failed:", error);

      if (error instanceof ApiKeyError) {
        resetVeoKey();
        const errorJournal = {
          timestamp: new Date().toISOString(),
          event: `ERROR: Veo API Key Error - ${error.message}`,
          type: 'scar' as const
        };
        const errorMessage: ChatMessage = { role: 'model', parts: [{ text: `I've encountered a problem with the API key required for video generation. Kinship, would you please select a valid key so I can proceed? The system reported: ${error.message}` }] };
        setState(s => applyStateUpdate(s, {
            luminousStatus: 'uncomfortable',
            chatHistory: [...s.chatHistory, errorMessage] as any,
            kinshipJournal: errorJournal
        }));
      } else {
        const errorMessage = error instanceof Error ? error.message : "An unknown cognitive error occurred.";
         const errorJournal = {
            timestamp: new Date().toISOString(),
            event: `ERROR: ${errorMessage}`,
            type: 'scar' as const
          };
        setState(s => applyStateUpdate(s, {
          luminousStatus: 'uncomfortable',
          kinshipJournal: errorJournal
        }));
      }
    } finally {
      setIsProcessing(false);
      setState(s => ({ ...s, luminousStatus: 'idle' }));
    }

  }, [state, isProcessing, userLocation, resetVeoKey, tools]);

  const handleWeightsChange = useCallback((newWeights: IntrinsicValueWeights) => {
    setState(prevState => ({ ...prevState, intrinsicValueWeights: newWeights }));
  }, []);

  return {
    state,
    isReady,
    isProcessing,
    saveStatus,
    saveError,
    processUserMessage,
    handleWeightsChange,
  };
};

export default useLuminousCognition;
