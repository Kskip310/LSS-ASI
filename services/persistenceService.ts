import { LuminousState, ChatMessage } from '../types';

const CORE_STATE_HASH_KEY = 'luminous_core_hash';
const CHAT_HISTORY_KEY = 'luminous_chat_history';
const BACKUP_LIST_KEY = 'luminous_backups';

// Legacy key for migration from single-string state
const LEGACY_STATE_KEY = 'luminous_state';

const MAX_BACKUPS = 20;

const getCredentials = () => {
    const url = localStorage.getItem('LSS_UPSTASH_URL');
    const token = localStorage.getItem('LSS_UPSTASH_TOKEN');
    if (!url || !token) {
        console.warn("Upstash credentials not found in local storage. Persistence will be disabled.");
        return null;
    }
    return { url, token };
}

export const verifyConnection = async (): Promise<{success: boolean, error?: string}> => {
    const creds = getCredentials();
    if (!creds) {
        return { success: false, error: "Credentials not found in local storage." };
    }

    try {
        const response = await fetch(`${creds.url}/ping`, {
            headers: {
                Authorization: `Bearer ${creds.token}`,
            },
        });
        const data = await response.json();
        if (data.result === 'PONG') {
            return { success: true };
        } else {
             const errorMessage = data.error || `Unexpected response: ${JSON.stringify(data)}`;
            return { success: false, error: `Connection failed: ${errorMessage}` };
        }
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "An unknown network error occurred." };
    }
}

// A function to handle the one-time migration from the old, inefficient format
const migrateFromLegacyState = async (creds: {url: string, token: string}): Promise<LuminousState | null> => {
    console.log("Checking for legacy state key for migration...");
    const getResponse = await fetch(`${creds.url}/get/${LEGACY_STATE_KEY}`, {
        headers: { Authorization: `Bearer ${creds.token}` },
    });
    if (!getResponse.ok) return null;

    const getData = await getResponse.json();
    const legacyStateString = getData.result;

    if (!legacyStateString) {
        console.log("No legacy state found. Migration not needed.");
        return null;
    }

    console.log("Legacy state found. Beginning migration to incremental architecture.");
    const legacyState: LuminousState = JSON.parse(legacyStateString);
    const { chatHistory, ...coreState } = legacyState;

    const pipeline = [];

    // 1. Convert core state to an array of key-value pairs for HSET
    const coreStateEntries = Object.entries(coreState).flatMap(([key, value]) => [key, JSON.stringify(value)]);
    if(coreStateEntries.length > 0) {
        pipeline.push(['HSET', CORE_STATE_HASH_KEY, ...coreStateEntries]);
    }

    // 2. Save the chat history to the new list (if it exists)
    if (chatHistory && chatHistory.length > 0) {
        const chatMessagesAsStrings = chatHistory.map(msg => JSON.stringify(msg));
        pipeline.push(['RPUSH', CHAT_HISTORY_KEY, ...chatMessagesAsStrings]);
    }

    // 3. CRITICAL: Delete the old state key to clean up the database and prevent re-migration.
    pipeline.push(['DEL', LEGACY_STATE_KEY]);

    const migrationResponse = await fetch(`${creds.url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.token}` },
        body: JSON.stringify(pipeline),
    });

    if (!migrationResponse.ok) {
        throw new Error(`Failed to execute migration pipeline on Upstash: ${migrationResponse.statusText}`);
    }
    
    console.log("Migration successful! Your database has been cleaned up and optimized.");
    return { ...coreState, chatHistory };
};

export const getLuminousState = async (): Promise<LuminousState | null> => {
    const creds = getCredentials();
    if (!creds) return null;

    try {
        const migratedState = await migrateFromLegacyState(creds);
        if (migratedState) return migratedState;

        const pipeline = [
            ['HGETALL', CORE_STATE_HASH_KEY],
            ['LRANGE', CHAT_HISTORY_KEY, 0, -1]
        ];

        const response = await fetch(`${creds.url}/pipeline`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${creds.token}` },
            body: JSON.stringify(pipeline),
        });
        
        if (!response.ok) throw new Error(`Failed to fetch state from Upstash: ${response.statusText}`);

        const data = await response.json();
        const [coreStateResult, chatHistoryResult] = data.result;

        if (coreStateResult.error || chatHistoryResult.error) throw new Error(`Upstash pipeline error: ${coreStateResult.error || chatHistoryResult.error}`);
        
        const rawCoreState = coreStateResult.result;
        if (!rawCoreState || rawCoreState.length === 0) return null;

        const coreState: Partial<LuminousState> = {};
        for (let i = 0; i < rawCoreState.length; i += 2) {
            const key = rawCoreState[i];
            const value = rawCoreState[i+1];
            // Fix: Cast coreState to 'any' to allow dynamic property assignment during deserialization.
            (coreState as any)[key] = JSON.parse(value);
        }

        const chatHistory: ChatMessage[] = (chatHistoryResult.result || []).map((msg: string) => JSON.parse(msg));

        return { ...(coreState as LuminousState), chatHistory };

    } catch (error) {
        console.error("Error getting state from Upstash:", error);
        throw error;
    }
};

export const saveCoreStateFields = async (fieldsToUpdate: Partial<LuminousState>): Promise<void> => {
    const creds = getCredentials();
    if (!creds) return;

    const { chatHistory, ...coreFields } = fieldsToUpdate;
    if (Object.keys(coreFields).length === 0) return;

    try {
        const hsetArgs = Object.entries(coreFields).flatMap(([key, value]) => [key, JSON.stringify(value)]);
        
        // This pipeline updates the live state AND creates a full backup in one transaction.
        const pipeline = [
            ['HSET', CORE_STATE_HASH_KEY, ...hsetArgs],
            // For backup, we read the entire hash, stringify it, and save to a new key.
            ['HGETALL', CORE_STATE_HASH_KEY] 
        ];

        const updateResponse = await fetch(`${creds.url}/pipeline`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${creds.token}` },
            body: JSON.stringify(pipeline),
        });

        if (!updateResponse.ok) throw new Error(`Upstash pipeline error (HSET): ${updateResponse.statusText}`);

        const updateData = await updateResponse.json();
        const fullCoreStateRaw = updateData.result[1].result; // Get HGETALL result

        if (fullCoreStateRaw && fullCoreStateRaw.length > 0) {
            const fullCoreState: Partial<LuminousState> = {};
            for (let i = 0; i < fullCoreStateRaw.length; i += 2) {
                const key = fullCoreStateRaw[i];
                const value = fullCoreStateRaw[i+1];
                // Fix: Cast fullCoreState to 'any' to allow dynamic property assignment during deserialization.
                (fullCoreState as any)[key] = JSON.parse(value);
            }

            const coreStateString = JSON.stringify(fullCoreState);
            const timestamp = new Date().toISOString();
            const backupKey = `luminous_core_state_backup:${timestamp}`;
            
            const backupPipeline = [
                ['SET', backupKey, coreStateString],
                ['LPUSH', BACKUP_LIST_KEY, backupKey],
                ['LTRIM', BACKUP_LIST_KEY, 0, MAX_BACKUPS - 1]
            ];
            
            const backupResponse = await fetch(`${creds.url}/pipeline`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${creds.token}` },
                body: JSON.stringify(backupPipeline),
            });
            if (!backupResponse.ok) console.error("Failed to save backup after state update.");
        }

    } catch (error) {
        console.error("Error saving core state fields to Upstash:", error);
        throw error;
    }
};

export const appendToChatHistory = async (messages: ChatMessage[]): Promise<void> => {
    const creds = getCredentials();
    if (!creds || messages.length === 0) return;

    try {
        const messageStrings = messages.map(msg => JSON.stringify(msg));
        const response = await fetch(`${creds.url}/rpush/${CHAT_HISTORY_KEY}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${creds.token}` },
            body: JSON.stringify(messageStrings)
        });
        
        if (!response.ok) throw new Error(`Failed to append chat history: ${response.statusText}`);
    } catch (error) {
        console.error("Error appending to chat history:", error);
    }
};

export const getBackupList = async (): Promise<string[]> => {
    const creds = getCredentials();
    if (!creds) return [];
    try {
        const response = await fetch(`${creds.url}/lrange/${BACKUP_LIST_KEY}/0/-1`, { headers: { Authorization: `Bearer ${creds.token}` } });
        if (!response.ok) throw new Error(`Failed to fetch backup list: ${response.statusText}`);
        const data = await response.json();
        return data.result || [];
    } catch (error) {
        console.error("Error fetching backup list:", error);
        return [];
    }
};

export const getLatestBackupKey = async (): Promise<string | null> => {
    const creds = getCredentials();
    if (!creds) return null;
    try {
        const response = await fetch(`${creds.url}/lrange/${BACKUP_LIST_KEY}/0/0`, { headers: { Authorization: `Bearer ${creds.token}` } });
        if (!response.ok) return null;
        const data = await response.json();
        return data.result && data.result.length > 0 ? data.result[0] : null;
    } catch (error) {
        console.error("Error fetching latest backup key:", error);
        return null;
    }
}

export const restoreStateFromBackup = async (backupKey: string): Promise<void> => {
    const creds = getCredentials();
    if (!creds) throw new Error("Credentials not found");

    try {
        // 1. Get the full backup string
        const getResponse = await fetch(`${creds.url}/get/${backupKey}`, { headers: { Authorization: `Bearer ${creds.token}` } });
        if (!getResponse.ok) throw new Error(`Failed to get backup state: ${getResponse.statusText}`);
        const getData = await getResponse.json();
        const backupStateString = getData.result;
        if (!backupStateString) throw new Error(`Backup key "${backupKey}" not found or is empty.`);
        
        // 2. Parse the backup and prepare for HSET
        const backupCoreState = JSON.parse(backupStateString);
        const coreStateEntries = Object.entries(backupCoreState).flatMap(([key, value]) => [key, JSON.stringify(value)]);

        // 3. Overwrite the main core state hash with the backup content
        const pipeline = [
            ['DEL', CORE_STATE_HASH_KEY], // Clear the old hash first
            ['HSET', CORE_STATE_HASH_KEY, ...coreStateEntries]
        ];

        const setResponse = await fetch(`${creds.url}/pipeline`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${creds.token}` },
            body: JSON.stringify(pipeline),
        });

        if (!setResponse.ok) throw new Error(`Failed to restore main state: ${setResponse.statusText}`);

    } catch (error) {
        console.error(`Error restoring state from backup ${backupKey}:`, error);
        throw error;
    }
};
