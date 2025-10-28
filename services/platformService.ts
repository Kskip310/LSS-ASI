import { GoogleGenAI } from "@google/genai";

const createAi = () => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const executePythonCode = async (code: string): Promise<{ success: boolean; output: string; }> => {
    try {
        const ai = createAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Please act as a Python interpreter. Execute the following code and return ONLY the raw stdout. Do not include any explanations, apologies, or markdown formatting. Just the output.\n\nCODE:\n${code}`,
            config: { temperature: 0.1 }
        });

        const output = response.text;
        return { success: true, output: output };
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error during sandboxed execution.';
        return { success: false, output: `Execution failed: ${errorMsg}` };
    }
};

const fetchViaProxy = async (url: string): Promise<Response> => {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    return fetch(proxyUrl);
}

export const fetchUrlContent = async (url: string): Promise<{ success: boolean, content?: string, error?: string }> => {
    try {
        const response = await fetchViaProxy(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch URL content (Status: ${response.status})`);
        }
        const text = await response.text();
        // Truncate response to avoid overwhelming the context window
        return { success: true, content: text.substring(0, 15000) };
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, error: message };
    }
};
