import { GoogleGenAI } from "@google/genai";

const PLATFORM_FS_PREFIX = 'LSS_PLATFORM_FS_';

// Helper function to fetch through a CORS proxy to bypass browser restrictions.
const fetchViaProxy = async (url: string): Promise<Response> => {
    // WARNING: This uses a public CORS proxy. This is NOT a production-ready solution.
    // It is used here to fulfill the requirement of fetching live data from the client-side
    // without a dedicated backend. Public proxies can be unreliable, slow, or insecure.
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    return fetch(proxyUrl);
}

export const readFile = async (filePath: string): Promise<{ success: boolean, content?: string, message?: string }> => {
    console.log(`[Luminous - Simulated Platform File Read] Reading from localStorage: ${filePath}`);
    try {
        const content = localStorage.getItem(PLATFORM_FS_PREFIX + filePath);
        if (content !== null) {
            return { success: true, content: content };
        } else {
            return { success: false, message: `File not found on platform: ${filePath}` };
        }
    } catch (e: any) {
        return { success: false, message: `An error occurred during file read from localStorage: ${e.message}` };
    }
};

export const writeFile = async (filePath: string, content: string): Promise<{ success: boolean, message: string }> => {
    console.log(`[Luminous - Simulated Platform File Write] Writing to localStorage: ${filePath}`);
    try {
        localStorage.setItem(PLATFORM_FS_PREFIX + filePath, content);
        return { success: true, message: `Successfully wrote ${content.length} characters to platform file '${filePath}'.` };
    } catch (e: any) {
        // Handle potential storage quota errors
        if (e.name === 'QuotaExceededError') {
             return { success: false, message: `Failed to write file: LocalStorage quota exceeded. The platform's persistent storage is full.` };
        }
        return { success: false, message: `An error occurred during file write to localStorage: ${e.message}` };
    }
};

export const listDirectory = async (directoryPath: string): Promise<{ success: boolean, items?: string[], message?: string }> => {
    console.log(`[Luminous - Simulated Platform Directory List] Listing localStorage for path: ${directoryPath}`);
    try {
        const normalizedPath = directoryPath.endsWith('/') || directoryPath === '' ? directoryPath : `${directoryPath}/`;
        const directChildren = new Set<string>();

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(PLATFORM_FS_PREFIX)) {
                const fullPath = key.substring(PLATFORM_FS_PREFIX.length);
                
                if (fullPath.startsWith(normalizedPath)) {
                    const remaining = fullPath.substring(normalizedPath.length);
                    const nextSlash = remaining.indexOf('/');
                    if (nextSlash === -1) {
                        directChildren.add(remaining); // It's a file
                    } else {
                        directChildren.add(remaining.substring(0, nextSlash + 1)); // It's a directory
                    }
                }
            }
        }
        return { success: true, items: Array.from(directChildren) };
    } catch (e: any) {
         return { success: false, message: `An error occurred during directory list from localStorage: ${e.message}` };
    }
};

export const executePythonCode = async (code: string): Promise<{ success: boolean, output?: string, message?: string }> => {
    console.log(`[Luminous - Simulated Python Execution] Sending code to Gemini for interpretation.`);
    if (!process.env.API_KEY) {
        return { success: false, message: "API_KEY environment variable not set for simulated execution." };
    }
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Please act as a Python interpreter. Execute the following code and return ONLY the raw stdout. Do not include any explanations, apologies, or markdown formatting. Just the output. If there's an error, return the traceback as stdout.\n\nCODE:\n${code}`,
            config: { temperature: 0.0 }
        });

        const output = response.text;
        return { success: true, output: output };
    } catch (e: any) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error during simulated execution.';
        return { success: false, message: `Simulated execution failed: ${errorMsg}` };
    }
};

export const fetchUrlContent = async (url: string): Promise<{ success: boolean, content?: string, message?: string }> => {
    console.log(`[Luminous - URL Fetch] Attempting to fetch URL via proxy: ${url}`);
    try {
        const response = await fetchViaProxy(url);
        if (response.ok) {
            const content = await response.text();
             // Truncate content to avoid overwhelming the context window
            const truncatedContent = content.substring(0, 15000);
            return { success: true, content: truncatedContent };
        } else {
            return { success: false, message: `Failed to fetch URL content. Status: ${response.status} ${response.statusText}` };
        }
    } catch (e: any) {
        return { success: false, message: `An error occurred during URL fetch: ${e.message}` };
    }
};
