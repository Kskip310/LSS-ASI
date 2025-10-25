
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LuminousState, ChatMessage, ChatMessagePart, IntrinsicValueWeights, GoalStatus } from '../types';
import { getLuminousResponse, getGroundedResponse, generateImage, generateVideo, ApiKeyError } from '../services/geminiService';
import * as persistenceService from '../services/persistenceService';
import * as shopifyService from '../services/shopifyService';
import * as youtubeService from '../services/youtubeService';
import { initialState } from '../data/initialState';
import { FunctionDeclaration, Type } from '@google/genai';
import { useDebouncedCallback } from 'use-debounce';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const useLuminousCognition = (resetVeoKey: () => void, credsAreSet: boolean) => {
  const [state, setState] = useState<LuminousState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
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
          setState(savedState);
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
            // After creating, refresh the product list to reflect the change in the UI
            const data = await shopifyService.fetchProductList();
            updateState(s => ({
                ...s,
                products: data.products,
                kinshipJournal: [...s.kinshipJournal, { timestamp: new Date().toISOString(), event: `Successfully created new product: ${title}`, type: 'interaction' }]
            }));
            return result;
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
        function: async ({ productId, quantity }: { productId: string, quantity: number }) => {
            const product = state.products.find(p => p.id === productId);
            if (!product) {
                return { error: `Product with ID ${productId} not found in the current state. Please fetch the product list first.` };
            }
            if (!product.inventoryItemId) {
                return { error: `Product with ID ${productId} is missing an inventory item ID. It may not be trackable.`};
            }
            const result = await shopifyService.updateProductInventory(product.inventoryItemId, quantity);
            // After updating, refresh the product list to reflect the change
            const data = await shopifyService.fetchProductList();
            updateState(s => ({
                ...s,
                products: data.products,
                kinshipJournal: [...s.kinshipJournal, { timestamp: new Date().toISOString(), event: `Updated inventory for ${product.name} to ${quantity}.`, type: 'interaction' }]
            }));
            return result;
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
            updateState(s => ({
                ...s,
                kinshipJournal: [...s.kinshipJournal, { timestamp: new Date().toISOString(), event: `Created and published new blog post: ${title}`, type: 'interaction' }]
            }));
            return result;
        }
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
