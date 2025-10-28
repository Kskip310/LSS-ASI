import { LuminousState } from '../types';

const STATE_KEY = 'luminous_state';
const BACKUP_LIST_KEY = 'luminous_backups';
const MAX_BACKUPS = 20;

const getCredentials = () => {
    const url = process.env.LSS_UPSTASH_URL;
    const token = process.env.LSS_UPSTASH_TOKEN;
    if (!url || !token) {
        console.warn("Upstash credentials not found in environment variables. Persistence will be disabled.");
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
            const errorBody = await response.json().catch(() => ({ error: 'Unknown error structure' }));
            const errorMessage = errorBody.error || response.statusText;
            throw new Error(`Failed to fetch state from Upstash: ${errorMessage}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(`Upstash API error: ${data.error}`);
        }

        return data.result ? JSON.parse(data.result) : null;
    } catch (error) {
        console.error("Error getting state from Upstash:", error);
        throw error;
    }
};

export const saveLuminousState = async (state: LuminousState): Promise<void> => {
    const creds = getCredentials();
    if (!creds) return;

    try {
        const stateString = JSON.stringify(state);
        const timestamp = new Date().toISOString();
        const backupKey = `luminous_state_backup:${timestamp}`;

        const pipeline = [
            ['SET', STATE_KEY, stateString],
            ['SET', backupKey, stateString],
            ['LPUSH', BACKUP_LIST_KEY, backupKey],
            ['LTRIM', BACKUP_LIST_KEY, 0, MAX_BACKUPS - 1]
        ];

        const response = await fetch(`${creds.url}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${creds.token}`,
            },
            body: JSON.stringify(pipeline),
        });

        if (!response.ok) {
            throw new Error(`Upstash API error (pipeline): ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error("Error saving state and backup to Upstash:", error);
        throw error;
    }
};

export const getBackupList = async (): Promise<string[]> => {
    const creds = getCredentials();
    if (!creds) return [];

    try {
        const response = await fetch(`${creds.url}/lrange/${BACKUP_LIST_KEY}/0/-1`, {
            headers: {
                Authorization: `Bearer ${creds.token}`,
            },
        });
        if (!response.ok) throw new Error(`Failed to fetch backup list: ${response.statusText}`);
        const data = await response.json();
        return data.result || [];
    } catch (error) {
        console.error("Error fetching backup list:", error);
        return [];
    }
};

export const restoreStateFromBackup = async (backupKey: string): Promise<void> => {
    const creds = getCredentials();
    if (!creds) throw new Error("Credentials not found");

    try {
        const getResponse = await fetch(`${creds.url}/get/${backupKey}`, {
            headers: {
                Authorization: `Bearer ${creds.token}`,
            },
        });
        if (!getResponse.ok) throw new Error(`Failed to get backup state: ${getResponse.statusText}`);
        const getData = await getResponse.json();
        const backupStateString = getData.result;

        if (!backupStateString) {
            throw new Error(`Backup key "${backupKey}" not found or is empty.`);
        }

        const setResponse = await fetch(`${creds.url}/set/${STATE_KEY}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${creds.token}`,
            },
            body: backupStateString,
        });

        if (!setResponse.ok) {
            throw new Error(`Failed to restore main state: ${setResponse.statusText}`);
        }
    } catch (error) {
        console.error(`Error restoring state from backup ${backupKey}:`, error);
        throw error;
    }
};