import { LuminousState } from '../types';

const STATE_KEY = 'luminous_state';

const getCredentials = () => {
    const url = localStorage.getItem('LSS_UPSTASH_URL');
    const token = localStorage.getItem('LSS_UPSTASH_TOKEN');
    if (!url || !token) {
        console.warn("Upstash credentials not found in local storage. Persistence will be disabled.");
        return null;
    }
    return { url, token };
}

export const getLuminousState = async (): Promise<LuminousState | null> => {
    const creds = getCredentials();
    if (!creds) return null;

    try {
        const response = await fetch(`${creds.url}/get/${STATE_KEY}`, {
            headers: {
                Authorization: `Bearer ${creds.token}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch state from Upstash: ${response.statusText}`);
        }
        const data = await response.json();
        return data.result ? JSON.parse(data.result) : null;
    } catch (error) {
        console.error("Error getting state from Upstash:", error);
        return null;
    }
};

export const saveLuminousState = async (state: LuminousState): Promise<void> => {
    const creds = getCredentials();
    if (!creds) return;

    try {
        const response = await fetch(`${creds.url}/set/${STATE_KEY}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${creds.token}`,
            },
            body: JSON.stringify(state),
        });

        if (!response.ok) {
            throw new Error(`Upstash API error: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error("Error saving state to Upstash:", error);
        // Re-throw the error to be caught by the calling function
        throw error;
    }
};